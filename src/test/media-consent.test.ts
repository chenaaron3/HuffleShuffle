import { eq, inArray, sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createCaller } from "~/server/api/root";
import { MEDIA_CONSENT_REQUIRED_ERROR } from "~/server/api/routers/table";
import { db } from "~/server/db";
import {
  gameEvents,
  games,
  piDevices,
  pokerTables,
  seats,
  users,
  waitlist,
} from "~/server/db/schema";
import { ensureTestWalletBalance } from "~/test/ledger-test-utils";

const DEALER_ID = "dealer-consent-vitest";
const PLAYER_ID = "player-consent-vitest";
const TABLE_NAME = "media-consent-vitest";
const WAITLIST_EMAILS = ["spam1@consent-vitest.local", "real@consent-vitest.local"];

const publicKey = `-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyVsuzIuAr7TYmbOtLrAp\nr6rmZBQrgMiXF0apTg7rvvSwa8JfUrZ0wXBHLx5VgpyHWNq0vFUwah7FgkpdGFQ0\nwWqRiwYWU6DG3S0sxWSYwfOiRTTLnnLPcUN3SzJjbJ5gnh7V7ukx5mpsm0dPHSiB\nREg4PNvbOo9suK4eIFKmRCgRdwNskA0pgaBi3PMfOLY+FbyTzlbs4xaQom2RMPt+\n1yD6mEACuOKzHQQP8Ve4ikkR4TdcYrnApUbfGa44xloA4fv500ez1hlBfRZ2ekow\npynGBufiP7koxSK4Nt8TRAVvuS8zZYrtGyboIZvObx6mm2YS6j7T9n0pEACpO2rT\nrwIDAQAB\n-----END PUBLIC KEY-----`;

function callerFor(userId: string, role: "dealer" | "player") {
  return createCaller({
    session: {
      user: { id: userId, role },
      expires: new Date().toISOString(),
    },
    db,
  } as any);
}

describe("media consent", () => {
  const dealer = callerFor(DEALER_ID, "dealer");
  const player = callerFor(PLAYER_ID, "player");
  let tableId = "";

  const cleanup = async () => {
    const tables = await db.query.pokerTables.findMany({
      where: eq(pokerTables.name, TABLE_NAME),
    });
    for (const t of tables) {
      await db.delete(gameEvents).where(eq(gameEvents.tableId, t.id));
      await db.delete(games).where(eq(games.tableId, t.id));
      await db.delete(seats).where(eq(seats.tableId, t.id));
      await db.delete(piDevices).where(eq(piDevices.tableId, t.id));
      await db.delete(pokerTables).where(eq(pokerTables.id, t.id));
    }
    await db.delete(waitlist).where(inArray(waitlist.email, WAITLIST_EMAILS));
  };

  beforeEach(async () => {
    await cleanup();
    await db
      .insert(users)
      .values([
        {
          id: DEALER_ID,
          email: "dealer-consent@vitest.local",
          role: "dealer",
          name: "Dealer",
          displayName: "Dealer",
        },
        {
          id: PLAYER_ID,
          email: "player-consent@vitest.local",
          role: "player",
          name: "Player",
          displayName: "Player",
          mediaConsent: false,
          mediaConsentUpdatedAt: null,
        },
      ])
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: sql`EXCLUDED.email`,
          role: sql`EXCLUDED.role`,
          mediaConsent: sql`EXCLUDED."mediaConsent"`,
          mediaConsentUpdatedAt: sql`EXCLUDED."mediaConsentUpdatedAt"`,
        },
      });
    await ensureTestWalletBalance(PLAYER_ID, 1000);

    const created = await dealer.table.create({
      name: TABLE_NAME,
      smallBlind: 5,
      bigBlind: 10,
      maxSeats: 8,
    });
    tableId = created.tableId;
    await db.insert(piDevices).values(
      Array.from({ length: 8 }, (_, i) => ({
        serial: `${tableId}-card-${i}`,
        tableId,
        type: "card" as const,
        seatNumber: i,
        publicKey,
      })),
    );
  });

  afterEach(cleanup);

  const join = () =>
    player.table.join({ tableId, buyIn: 300, userPublicKey: publicKey });

  it("blocks joining until the player opts in", async () => {
    expect((await player.user.getConsent()).mediaConsent).toBe(false);
    await expect(join()).rejects.toThrow(MEDIA_CONSENT_REQUIRED_ERROR);

    const optedIn = await player.user.optInConsent();
    expect(optedIn.mediaConsent).toBe(true);
    expect(optedIn.mediaConsentUpdatedAt).toBeInstanceOf(Date);

    await join();
    const seated = await db.query.seats.findMany({
      where: eq(seats.tableId, tableId),
    });
    expect(seated.map((s) => s.playerId)).toEqual([PLAYER_ID]);
  });

  it("does not bump the timestamp when opting in again", async () => {
    const first = await player.user.optInConsent();
    const second = await player.user.optInConsent();
    expect(second.mediaConsentUpdatedAt?.getTime()).toBe(
      first.mediaConsentUpdatedAt?.getTime(),
    );
  });

  it("lets an admin change consent and records when it changed", async () => {
    const before = await dealer.dashboard.listConsent({ page: 1, pageSize: 100 });
    const row = before.rows.find((r) => r.id === PLAYER_ID);
    expect(row?.mediaConsent).toBe(false);
    expect(row?.mediaConsentUpdatedAt).toBeNull();
    expect(before.rows.some((r) => r.id.startsWith("bot0000"))).toBe(false);

    const on = await dealer.dashboard.setConsent({
      userId: PLAYER_ID,
      mediaConsent: true,
    });
    expect(on.mediaConsent).toBe(true);
    expect(on.mediaConsentUpdatedAt).toBeInstanceOf(Date);

    const off = await dealer.dashboard.setConsent({
      userId: PLAYER_ID,
      mediaConsent: false,
    });
    expect(off.mediaConsent).toBe(false);
    expect(off.mediaConsentUpdatedAt!.getTime()).toBeGreaterThanOrEqual(
      on.mediaConsentUpdatedAt!.getTime(),
    );

    const unchanged = await dealer.dashboard.setConsent({
      userId: PLAYER_ID,
      mediaConsent: false,
    });
    expect(unchanged.mediaConsentUpdatedAt?.getTime()).toBe(
      off.mediaConsentUpdatedAt?.getTime(),
    );

    await expect(join()).rejects.toThrow(MEDIA_CONSENT_REQUIRED_ERROR);
  });

  it("restricts consent and waitlist admin endpoints to dealers", async () => {
    await expect(
      player.dashboard.setConsent({ userId: PLAYER_ID, mediaConsent: true }),
    ).rejects.toThrow();
    await expect(
      player.dashboard.listConsent({ page: 1, pageSize: 25 }),
    ).rejects.toThrow();
    await expect(
      player.dashboard.deleteWaitlistEntries({ ids: ["x"] }),
    ).rejects.toThrow();
  });

  it("lets an admin bulk-delete waitlist entries", async () => {
    const inserted = await db
      .insert(waitlist)
      .values(WAITLIST_EMAILS.map((email) => ({ name: "Test", email })))
      .returning({ id: waitlist.id, email: waitlist.email });
    const spam = inserted.find((r) => r.email === WAITLIST_EMAILS[0])!;

    const res = await dealer.dashboard.deleteWaitlistEntries({ ids: [spam.id] });
    expect(res.deletedCount).toBe(1);

    const remaining = await db.query.waitlist.findMany({
      where: inArray(waitlist.email, WAITLIST_EMAILS),
    });
    expect(remaining.map((r) => r.email)).toEqual([WAITLIST_EMAILS[1]]);
  });
});
