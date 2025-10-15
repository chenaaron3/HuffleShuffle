/**
 * Test runner for .phh (Poker Hand History) files
 * Loads all .phh files from the simulation directory and runs them as tests
 */

import { eq, sql } from 'drizzle-orm';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { createCaller } from '~/server/api/root';
import { db } from '~/server/db';
import { gameEvents, games, piDevices, pokerTables, seats, users } from '~/server/db/schema';
import {
    handleActionStep, handleDealHoleStep, handleJoinStep, handleValidateStep
} from '~/test/scenario-step-handlers';

import { phhToScenario, validatePHH } from './utils/phh-to-scenario';

import type { PlayerKey } from "~/test/scenario.types";
// Directory containing .phh files
const PHH_DIR = join(__dirname, "hands");

// Environment variable to filter which PHH files to test
// Examples:
//   PHH_FILTER=wsop  - only test files matching "wsop"
//   PHH_FILTER=pluribus/100  - only test files in pluribus/100/
//   PHH_FILTER=pluribus/100/0.phh  - only test that specific file
//   (no filter) - test all files
const PHH_FILTER = process.env.PHH_FILTER || "NONE";

/**
 * Set up the dealer button position by creating a dummy previous game
 * This allows the next START_GAME to progress the button to the correct position
 */
async function setupDealerButton(
  tableId: string,
  targetButtonPlayer: PlayerKey,
  playerIds: Record<PlayerKey, string>,
): Promise<void> {
  // Get all seats for this table
  const allSeats = await db.query.seats.findMany({
    where: eq(seats.tableId, tableId),
    orderBy: (s, { asc }) => [asc(s.seatNumber)],
  });

  if (allSeats.length === 0) {
    throw new Error("No seats found");
  }

  // Find the seat for the target button player
  const targetPlayerId = playerIds[targetButtonPlayer];
  const targetSeatIndex = allSeats.findIndex(
    (s) => s.playerId === targetPlayerId,
  );

  if (targetSeatIndex === -1) {
    throw new Error(`Seat not found for ${targetButtonPlayer}`);
  }

  // Find the previous seat (circular) - the button should be there in the "previous game"
  // so that when START_GAME is called, it progresses to the target seat
  const previousSeatIndex =
    targetSeatIndex === 0 ? allSeats.length - 1 : targetSeatIndex - 1;
  const previousSeat = allSeats[previousSeatIndex]!;

  console.log(
    `Setting up dealer button: will be at ${targetButtonPlayer} after START_GAME`,
  );
  console.log(
    `  Creating dummy game with button at seat ${previousSeat.seatNumber}`,
  );

  // Create a dummy completed game with button at previous position
  await db.insert(games).values({
    tableId,
    isCompleted: true, // Mark as completed so it's treated as a previous game
    state: "SHOWDOWN",
    dealerButtonSeatId: previousSeat.id,
    communityCards: [],
    potTotal: 0,
    sidePots: [],
    betCount: 0,
    requiredBetCount: 0,
  });
}

// Recursively load all .phh files from directory and subdirectories
function loadPHHFiles(
  dir: string = PHH_DIR,
  relativePath: string = "",
): { filename: string; filepath: string; content: string }[] {
  if (!existsSync(dir)) {
    console.warn(`PHH directory not found: ${dir}`);
    return [];
  }

  const files: { filename: string; filepath: string; content: string }[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      // Recursively scan subdirectories
      files.push(...loadPHHFiles(fullPath, relPath));
    } else if (entry.name.endsWith(".phh")) {
      // Load .phh file
      files.push({
        filename: entry.name,
        filepath: relPath,
        content: readFileSync(fullPath, "utf-8"),
      });
    }
  }

  return files;
}

describe("PHH Simulation Tests", () => {
  const allFiles = loadPHHFiles();

  // Apply filter if specified
  const phhFiles = PHH_FILTER
    ? allFiles.filter((f) => f.filepath.includes(PHH_FILTER))
    : allFiles;

  console.log(`\n📂 Loaded ${phhFiles.length} PHH files from ${PHH_DIR}`);
  if (PHH_FILTER) {
    console.log(
      `   (filtered by: ${PHH_FILTER}, total files: ${allFiles.length})`,
    );
  }

  if (phhFiles.length === 0) {
    it("should have .phh files to test", () => {
      console.warn(`No .phh files found in ${PHH_DIR}`);
      console.warn("Skipping PHH simulation tests");
    });
    return;
  }

  // Create a test for each .phh file
  for (const { filename, filepath, content } of phhFiles) {
    describe(filepath, () => {
      it("should validate PHH format", () => {
        const errors = validatePHH(content);
        if (errors.length > 0) {
          console.error(`Validation errors for ${filepath}:`);
          errors.forEach((err) => console.error(`  - ${err}`));
        }
        expect(errors).toEqual([]);
      });

      it("should convert to scenario and run successfully", async () => {
        // Convert PHH to scenario
        const scenario = phhToScenario(content, filepath);

        console.log(`\n=== Running scenario: ${scenario.name} ===`);

        // Create unique dealer and player IDs for this test (use filepath to ensure uniqueness)
        const uniqueId = filepath.replace(/\//g, "-").replace(/\.phh$/, "");
        const dealerId = `dealer-phh-${uniqueId}`;
        const playerKeys: PlayerKey[] = [
          "player1",
          "player2",
          "player3",
          "player4",
          "player5",
          "player6",
          "player7",
          "player8",
        ];

        const playerIds: Record<PlayerKey, string> = {} as any;
        for (const key of playerKeys) {
          playerIds[key] = `${key}-phh-${uniqueId}`;
        }

        // Clean up any existing tables for this dealer (from previous test runs)
        const existingTables = await db.query.pokerTables.findMany({
          where: eq(pokerTables.dealerId, dealerId),
        });
        for (const t of existingTables) {
          await db.delete(gameEvents).where(eq(gameEvents.tableId, t.id));
          await db.delete(games).where(eq(games.tableId, t.id));
          await db.delete(seats).where(eq(seats.tableId, t.id));
          await db.delete(piDevices).where(eq(piDevices.tableId, t.id));
          await db.delete(pokerTables).where(eq(pokerTables.id, t.id));
        }

        // Create users in database first (required for foreign key constraints)
        await db
          .insert(users)
          .values([
            {
              id: dealerId,
              email: `dealer-${uniqueId}@phh-test.local`,
              role: "dealer",
              balance: 0,
              name: "PHH Dealer",
            },
            ...playerKeys.map((k, i) => ({
              id: playerIds[k],
              email: `${k}-${uniqueId}@phh-test.local`,
              role: "player" as const,
              balance: 100000000, // 100M chips - enough for any tournament stack
              name: `Player ${i + 1}`,
            })),
          ])
          .onConflictDoUpdate({
            target: users.id,
            set: {
              email: sql`EXCLUDED.email`,
              role: sql`EXCLUDED.role`,
              balance: sql`EXCLUDED.balance`,
              name: sql`EXCLUDED.name`,
            },
          });

        // Create callers for dealer and players
        const dealerCaller = createCaller({
          session: {
            user: { id: dealerId, role: "dealer" as const },
            expires: new Date().toISOString(),
          },
          db,
        } as any);

        const callers: Record<"dealer" | PlayerKey, any> = {
          dealer: dealerCaller,
        } as any;

        for (const key of playerKeys) {
          callers[key] = createCaller({
            session: {
              user: { id: playerIds[key], role: "player" as const },
              expires: new Date().toISOString(),
            },
            db,
          } as any);
        }

        // Create table via tRPC (use blind values from PHH if available)
        const publicKey = `-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyVsuzIuAr7TYmbOtLrAp\nr6rmZBQrgMiXF0apTg7rvvSwa8JfUrZ0wXBHLx5VgpyHWNq0vFUwah7FgkpdGFQ0\nwWqRiwYWU6DG3S0sxWSYwfOiRTTLnnLPcUN3SzJjbJ5gnh7V7ukx5mpsm0dPHSiB\nREg4PNvbOo9suK4eIFKmRCgRdwNskA0pgaBi3PMfOLY+FbyTzlbs4xaQom2RMPt+\n1yD6mEACuOKzHQQP8Ve4ikkR4TdcYrnApUbfGa44xloA4fv500ez1hlBfRZ2ekow\npynGBufiP7koxSK4Nt8TRAVvuS8zZYrtGyboIZvObx6mm2YS6j7T9n0pEACpO2rT\nrwIDAQAB\n-----END PUBLIC KEY-----`;

        const res = await dealerCaller.table.create({
          name: `PHH Test: ${filepath}`,
          smallBlind: scenario.metadata?.smallBlind ?? 5,
          bigBlind: scenario.metadata?.bigBlind ?? 10,
          maxSeats: 8,
        });
        const tableId = res.tableId;

        // Seed Pi devices for card seats
        const cardPis = Array.from({ length: 8 }, (_, i) => ({
          serial: `${tableId}-card-${i}`,
          tableId,
          type: "card" as const,
          seatNumber: i,
          publicKey,
        }));
        await db.insert(piDevices).values(cardPis);

        try {
          // Track if we've set up the dealer button
          let dealerButtonSetup = false;

          // Execute scenario steps
          for (let i = 0; i < scenario.steps.length; i++) {
            const step = scenario.steps[i]!;

            console.log(`Step ${i + 1}/${scenario.steps.length}: ${step.type}`);

            switch (step.type) {
              case "join":
                await handleJoinStep(
                  step,
                  tableId,
                  100, // default buy-in (not used, each player has buyIn specified)
                  publicKey,
                  callers,
                );

                // After joining, set up dealer button if we have metadata
                if (
                  !dealerButtonSetup &&
                  scenario.metadata?.dealerButtonPlayer
                ) {
                  console.log(
                    `Setting up dealer button for ${scenario.metadata.dealerButtonPlayer}`,
                  );
                  await setupDealerButton(
                    tableId,
                    scenario.metadata.dealerButtonPlayer,
                    playerIds,
                  );
                  dealerButtonSetup = true;
                }
                break;

              case "action":
                await handleActionStep(step, tableId, callers);
                break;

              case "deal_hole":
                await handleDealHoleStep(step, tableId, playerIds, callers);
                break;

              case "validate":
                await handleValidateStep(step, tableId, playerIds);
                break;

              default:
                throw new Error(`Unknown step type: ${(step as any).type}`);
            }
          }

          console.log(`✓ Scenario completed successfully`);
        } finally {
          // Cleanup (must delete in correct order due to foreign key constraints)
          await db.delete(gameEvents).where(eq(gameEvents.tableId, tableId));
          await db.delete(games).where(eq(games.tableId, tableId));
          await db.delete(seats).where(eq(seats.tableId, tableId));
          await db.delete(piDevices).where(eq(piDevices.tableId, tableId));
          await db.delete(pokerTables).where(eq(pokerTables.id, tableId));
        }
      });
    });
  }
});
