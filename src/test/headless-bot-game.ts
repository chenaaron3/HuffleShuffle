/**
 * Headless table driver: in-process tRPC (createCaller) + addBot + DEAL_CARD (NODE_ENV=test).
 * Used by headless-bot-game.runner.test.ts for stress / fuzz runs without a browser or SQS.
 */

import { eq, sql } from 'drizzle-orm';
import { appendFileSync, closeSync, fsyncSync, mkdirSync, openSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { triggerBotActions } from '~/server/api/game-logic';
import { createCaller } from '~/server/api/root';
import { db } from '~/server/db';
import { gameEvents, games, piDevices, pokerTables, seats, users } from '~/server/db/schema';

export const HEADLESS_BOT_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyVsuzIuAr7TYmbOtLrAp\nr6rmZBQrgMiXF0apTg7rvvSwa8JfUrZ0wXBHLx5VgpyHWNq0vFUwah7FgkpdGFQ0\nwWqRiwYWU6DG3S0sxWSYwfOiRTTLnnLPcUN3SzJjbJ5gnh7V7ukx5mpsm0dPHSiB\nREg4PNvbOo9suK4eIFKmRCgRdwNskA0pgaBi3PMfOLY+FbyTzlbs4xaQom2RMPt+\n1yD6mEACuOKzHQQP8Ve4ikkR4TdcYrnApUbfGa44xloA4fv500ez1hlBfRZ2ekow\npynGBufiP7koxSK4Nt8TRAVvuS8zZYrtGyboIZvObx6mm2YS6j7T9n0pEACpO2rT\nrwIDAQAB\n-----END PUBLIC KEY-----`;

const RANKS = [
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "T",
  "J",
  "Q",
  "K",
  "A",
] as const;
const SUITS = ["s", "h", "d", "c"] as const;

export function buildFullDeck(): string[] {
  const deck: string[] = [];
  for (const r of RANKS) {
    for (const s of SUITS) {
      deck.push(`${r}${s}`);
    }
  }
  return deck;
}

/** Fisher–Yates shuffle (in-place). */
export function shuffleDeck(deck: string[], random = Math.random): void {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j]!, deck[i]!];
  }
}

export function freshShuffledDeck(random = Math.random): string[] {
  const d = buildFullDeck();
  shuffleDeck(d, random);
  return d;
}

function cardToDealParams(card: string): { rank: string; suit: string } {
  const suit = card.slice(-1);
  const rank = card.slice(0, -1);
  if (!rank || !suit) throw new Error(`Invalid card code: ${card}`);
  return { rank, suit };
}

export type HeadlessDealerCaller = ReturnType<typeof createCaller>;

export async function cleanupHeadlessTablesForDealer(dealerId: string) {
  const tables = await db.query.pokerTables.findMany({
    where: eq(pokerTables.dealerId, dealerId),
  });
  for (const t of tables) {
    await db.delete(gameEvents).where(eq(gameEvents.tableId, t.id));
    await db.delete(games).where(eq(games.tableId, t.id));
    await db.delete(seats).where(eq(seats.tableId, t.id));
    await db.delete(piDevices).where(eq(piDevices.tableId, t.id));
    await db.delete(pokerTables).where(eq(pokerTables.id, t.id));
  }
}

function errorMessageChain(e: unknown): string {
  if (e instanceof Error) {
    let m = e.message;
    if ("cause" in e && e.cause instanceof Error) {
      m += ` ${e.cause.message}`;
    }
    return m;
  }
  return String(e);
}

function isInsufficientPlayersForNewGameError(e: unknown): boolean {
  return errorMessageChain(e).includes("Need at least 2 players with chips");
}

/**
 * Remove all bots from seats `0 .. numBots - 1` and add them back with the same buy-in.
 * Uses `table.removeBot` / `table.addBot` (no raw seat updates). Requires no active hand.
 */
export async function reseatHeadlessBotsViaApi(
  dealerCaller: HeadlessDealerCaller,
  tableId: string,
  numBots: number,
  buyIn: number,
): Promise<void> {
  if (numBots < 2 || numBots > 8) {
    throw new Error("numBots must be between 2 and 8");
  }
  if (!Number.isFinite(buyIn) || buyIn < 1) {
    throw new Error(
      `buyIn must be a positive finite number (got ${String(buyIn)})`,
    );
  }
  for (let seat = 0; seat < numBots; seat++) {
    await dealerCaller.table.removeBot({ tableId, seatNumber: seat });
  }
  for (let seat = 0; seat < numBots; seat++) {
    await dealerCaller.table.addBot({ tableId, seatNumber: seat, buyIn });
  }
}

/** Dealer IDs whose tables should be removed on process exit (SIGINT / SIGTERM). */
const exitCleanupDealerIds = new Set<string>();
let exitCleanupHandlersInstalled = false;

/**
 * Run `cleanupHeadlessTablesForDealer` when the process receives SIGINT or SIGTERM
 * (e.g. Ctrl+C during a long headless run). Idempotent per `dealerId`.
 *
 * Does not run on SIGKILL (`kill -9`) — nothing can.
 */
export function registerHeadlessCleanupOnExit(dealerId: string): void {
  exitCleanupDealerIds.add(dealerId);
  if (exitCleanupHandlersInstalled) return;
  exitCleanupHandlersInstalled = true;

  let shuttingDown = false;

  const onSignal = (signal: NodeJS.Signals) => {
    if (shuttingDown) {
      console.error(
        "[headless-bot] second interrupt — exiting without waiting for cleanup",
      );
      process.exit(1);
    }
    shuttingDown = true;
    console.error(
      `[headless-bot] ${signal} — cleaning up headless table rows…`,
    );
    void (async () => {
      for (const id of exitCleanupDealerIds) {
        try {
          await cleanupHeadlessTablesForDealer(id);
        } catch (e) {
          console.error(`[headless-bot] cleanup failed for dealer ${id}`, e);
        }
      }
      const code = signal === "SIGINT" ? 130 : signal === "SIGTERM" ? 143 : 1;
      process.exit(code);
    })();
  };

  // Vitest sends SIGTERM to workers on normal shutdown — do not hook SIGTERM there
  // or we would exit mid-teardown and fight the test runner. Ctrl+C is SIGINT.
  process.on("SIGINT", () => onSignal("SIGINT"));
  const vitest = Boolean(process.env.VITEST);
  if (!vitest || process.env.HEADLESS_CLEANUP_ON_SIGTERM === "1") {
    process.on("SIGTERM", () => onSignal("SIGTERM"));
  }
}

export async function upsertHeadlessDealerUser(dealerId: string) {
  await db
    .insert(users)
    .values({
      id: dealerId,
      email: `${dealerId}@headless.local`,
      role: "dealer",
      balance: 0,
      name: "Headless Dealer",
      displayName: "Headless Dealer",
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email: sql`EXCLUDED.email`,
        role: sql`EXCLUDED.role`,
        balance: sql`EXCLUDED.balance`,
        name: sql`EXCLUDED.name`,
        displayName: sql`EXCLUDED."displayName"`,
      },
    });
}

export function createHeadlessDealerCaller(
  dealerId: string,
): HeadlessDealerCaller {
  return createCaller({
    session: {
      user: { id: dealerId, role: "dealer" as const },
      expires: new Date().toISOString(),
    },
    db,
  } as any);
}

export type SetupHeadlessBotTableOptions = {
  dealerId: string;
  /** Number of bot seats to fill (seat numbers 0 .. numBots-1). Min 2. */
  numBots: number;
  smallBlind: number;
  bigBlind: number;
  buyIn?: number;
  tableName?: string;
};

/**
 * Creates a table, seeds Pi devices (card seats 0..7), adds bots via `table.addBot`.
 * Requires NODE_ENV=test so subsequent DEAL_CARD uses in-process `dealCard` (no SQS).
 */
export async function setupHeadlessBotTable(
  options: SetupHeadlessBotTableOptions,
): Promise<{ tableId: string; dealerCaller: HeadlessDealerCaller }> {
  const {
    dealerId,
    numBots,
    smallBlind,
    bigBlind,
    buyIn,
    tableName = "Headless Bot Table",
  } = options;
  if (numBots < 2 || numBots > 8) {
    throw new Error("numBots must be between 2 and 8");
  }

  registerHeadlessCleanupOnExit(dealerId);

  await upsertHeadlessDealerUser(dealerId);
  const dealerCaller = createHeadlessDealerCaller(dealerId);

  const { tableId } = await dealerCaller.table.create({
    name: tableName,
    smallBlind,
    bigBlind,
    maxSeats: 8,
  });

  const cardPis = Array.from({ length: 8 }, (_, i) => ({
    serial: `${tableId}-card-${i}`,
    tableId,
    type: "card" as const,
    seatNumber: i,
    publicKey: HEADLESS_BOT_PUBLIC_KEY,
  }));
  await db.insert(piDevices).values(cardPis);

  for (let seat = 0; seat < numBots; seat++) {
    await dealerCaller.table.addBot({
      tableId,
      seatNumber: seat,
      buyIn: buyIn ?? bigBlind * 20,
    });
  }

  return { tableId, dealerCaller };
}

export async function getLatestGame(tableId: string) {
  return db.query.games.findFirst({
    where: eq(games.tableId, tableId),
    orderBy: (g, { desc: d }) => [d(g.createdAt)],
  });
}

function appendHeadlessActionLog(logPath: string, message: string) {
  appendFileSync(logPath, `[headless] ${message}\n`, "utf8");
}

/** Sync the action log to disk (e.g. after each hand so `tail -f` stays current if the run dies). */
function flushHeadlessActionLogFile(logPath: string): void {
  const fd = openSync(logPath, "a");
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

/** Default log filename under `process.cwd()` (see `.gitignore`). */
export const DEFAULT_HEADLESS_ACTION_LOG = "headless-bot-actions.log";

/**
 * Single env: `HEADLESS_ACTION_LOG`. Unset → default file; `0` / `false` / `off` → no file;
 * otherwise → path (relative to cwd or absolute).
 */
export function resolveHeadlessActionLogFromEnv(): string | undefined {
  const raw = process.env.HEADLESS_ACTION_LOG;
  if (raw === "0" || raw === "false" || raw === "off") return undefined;
  if (raw === undefined || raw === "") return DEFAULT_HEADLESS_ACTION_LOG;
  return raw;
}

function resolveHeadlessActionLogPath(pathOrRelative: string): string {
  return isAbsolute(pathOrRelative)
    ? pathOrRelative
    : join(process.cwd(), pathOrRelative);
}

/**
 * Play one full hand: assumes the table is ready for a new hand (call `START_GAME` before this).
 * Deals from `deck` in order until the latest game is completed.
 */
export async function runOneHandFromDeck(
  dealerCaller: HeadlessDealerCaller,
  tableId: string,
  deck: string[],
  driverOptions?: { actionLogPath?: string },
): Promise<void> {
  const actionLogPath = driverOptions?.actionLogPath;
  let deckIdx = 0;
  const dealNext = async (phase: string) => {
    if (deckIdx >= deck.length) {
      throw new Error("Deck exhausted before hand completed");
    }
    const card = deck[deckIdx++]!;
    const { rank, suit } = cardToDealParams(card);
    await dealerCaller.table.action({
      tableId,
      action: "DEAL_CARD",
      params: { rank: rank as any, suit: suit as any },
    });
    if (actionLogPath) {
      appendHeadlessActionLog(
        actionLogPath,
        `DEAL_CARD phase=${phase} card=${card}`,
      );
    }
  };

  const maxSteps = Number(process.env.HEADLESS_BOT_MAX_STEPS ?? "20000");
  for (let step = 0; step < maxSteps; step++) {
    const game = await getLatestGame(tableId);
    if (!game) throw new Error("No game row for table");
    if (game.isCompleted) return;

    if (
      game.state === "DEAL_HOLE_CARDS" ||
      game.state === "DEAL_FLOP" ||
      game.state === "DEAL_TURN" ||
      game.state === "DEAL_RIVER"
    ) {
      await dealNext(game.state);
      continue;
    }

    if (game.state === "BETTING") {
      await triggerBotActions(
        db,
        tableId,
        actionLogPath
          ? {
              onBotAction: (e) => {
                const suffix = e.raiseTo != null ? ` to=${e.raiseTo}` : "";
                appendHeadlessActionLog(
                  actionLogPath,
                  `BOT_ACTION seat=${e.seatNumber} ${e.action}${suffix}`,
                );
              },
            }
          : undefined,
      );
      continue;
    }

    throw new Error(`Unhandled game state in headless driver: ${game.state}`);
  }

  throw new Error(
    `Headless hand exceeded HEADLESS_BOT_MAX_STEPS (${maxSteps}); possible infinite loop`,
  );
}

export type RunManyHandsOptions = {
  numHands: number;
  /**
   * When `START_GAME` fails because fewer than two non-eliminated players have chips,
   * remove bots for seats `0..numBots-1` and re-add them with `buyIn`, then retry `START_GAME` once.
   */
  replenish?: { numBots: number; buyIn: number };
  /** Called before each hand after the first (each hand starts with START_GAME). */
  onHandComplete?: (handIndex: number) => void | Promise<void>;
  /**
   * Append one UTF-8 line per `DEAL_CARD` / bot action (`[headless] ...\\n`).
   * File is truncated when `runManyBotHands` starts; `fsync` runs after each hand.
   * Relative paths are under `process.cwd()`.
   */
  actionLogPath?: string;
};

/**
 * Runs `numHands` consecutive hands: `START_GAME`, then deal/play until complete.
 * Uses a fresh shuffled deck per hand.
 */
export async function runManyBotHands(
  dealerCaller: HeadlessDealerCaller,
  tableId: string,
  options: RunManyHandsOptions,
): Promise<void> {
  const {
    numHands,
    onHandComplete,
    replenish,
    actionLogPath: logOpt,
  } = options;
  if (!Number.isFinite(numHands) || numHands < 1) {
    throw new Error(
      `numHands must be a positive finite number (got ${String(numHands)})`,
    );
  }

  const actionLogPath = logOpt
    ? resolveHeadlessActionLogPath(logOpt)
    : undefined;
  if (actionLogPath) {
    mkdirSync(dirname(actionLogPath), { recursive: true });
    writeFileSync(actionLogPath, "", "utf8");
  }

  const random = Math.random;

  for (let h = 0; h < numHands; h++) {
    try {
      await startGameWithOptionalReplenish(dealerCaller, tableId, replenish);
      const deck = freshShuffledDeck(random);
      await runOneHandFromDeck(dealerCaller, tableId, deck, { actionLogPath });
      await onHandComplete?.(h);
    } finally {
      if (actionLogPath) {
        flushHeadlessActionLogFile(actionLogPath);
      }
    }
  }
}

async function startGameWithOptionalReplenish(
  dealerCaller: HeadlessDealerCaller,
  tableId: string,
  replenish: RunManyHandsOptions["replenish"],
): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await dealerCaller.table.action({ tableId, action: "START_GAME" });
      return;
    } catch (e) {
      if (
        attempt === 0 &&
        replenish !== undefined &&
        isInsufficientPlayersForNewGameError(e)
      ) {
        await reseatHeadlessBotsViaApi(
          dealerCaller,
          tableId,
          replenish.numBots,
          replenish.buyIn,
        );
        continue;
      }
      throw e;
    }
  }
}
