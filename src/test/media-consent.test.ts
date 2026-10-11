import { eq, inArray, sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createCaller } from "~/server/api/root";
import { RECORDING_CONSENT_REQUIRED_ERROR } from "~/server/api/routers/table";
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
          recordingConsent: false,
          recordingConsentUpdatedAt: null,
          socialMediaConsent: null,
          socialMediaConsentUpdatedAt: null,
        },
      ])
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: sql`EXCLUDED.email`,
          role: sql`EXCLUDED.role`,
          recordingConsent: sql`EXCLUDED."recordingConsent"`,
          recordingConsentUpdatedAt: sql`EXCLUDED."recordingConsentUpdatedAt"`,
          socialMediaConsent: sql`EXCLUDED."socialMediaConsent"`,
          socialMediaConsentUpdatedAt: sql`EXCLUDED."socialMediaConsentUpdatedAt"`,
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

  const readConsent = () =>
    db.query.users.findFirst({
      where: eq(users.id, PLAYER_ID),
      columns: {
        recordingConsent: true,
        recordingConsentUpdatedAt: true,
        socialMediaConsent: true,
        socialMediaConsentUpdatedAt: true,
      },
    });

  it("blocks joining until the player agrees to recording", async () => {
    expect(await player.user.getConsent()).toEqual({
      recordingConsent: false,
      socialMediaConsent: null,
    });
    await expect(join()).rejects.toThrow(RECORDING_CONSENT_REQUIRED_ERROR);

    const submitted = await player.user.submitConsent({
      socialMediaConsent: false,
    });
    expect(submitted).toEqual({
      recordingConsent: true,
      socialMediaConsent: false,
    });
    const stored = await readConsent();
    expect(stored?.recordingConsentUpdatedAt).toBeInstanceOf(Date);
    expect(stored?.socialMediaConsentUpdatedAt).toBeInstanceOf(Date);

    await join();
    const seated = await db.query.seats.findMany({
      where: eq(seats.tableId, tableId),
    });
    expect(seated.map((s) => s.playerId)).toEqual([PLAYER_ID]);
  });

  it("ignores repeat submissions once recording consent is given", async () => {
    await player.user.submitConsent({ socialMediaConsent: true });
    const first = await readConsent();

    const again = await player.user.submitConsent({ socialMediaConsent: false });
    expect(again.socialMediaConsent).toBe(true);
    const second = await readConsent();
    expect(second?.recordingConsentUpdatedAt?.getTime()).toBe(
      first?.recordingConsentUpdatedAt?.getTime(),
    );
    expect(second?.socialMediaConsentUpdatedAt?.getTime()).toBe(
      first?.socialMediaConsentUpdatedAt?.getTime(),
    );
  });

  it("lets an admin change each consent and records when it changed", async () => {
    const before = await dealer.dashboard.listConsent({ page: 1, pageSize: 100 });
    const row = before.rows.find((r) => r.id === PLAYER_ID);
    expect(row).toMatchObject({
      recordingConsent: false,
      recordingConsentUpdatedAt: null,
      socialMediaConsent: null,
      socialMediaConsentUpdatedAt: null,
    });
    expect(before.rows.some((r) => r.id.startsWith("bot0000"))).toBe(false);

    const social = await dealer.dashboard.setConsent({
      userId: PLAYER_ID,
      kind: "socialMedia",
      value: false,
    });
    expect(social.socialMediaConsent).toBe(false);
    expect(social.socialMediaConsentUpdatedAt).toBeInstanceOf(Date);
    expect(social.recordingConsentUpdatedAt).toBeNull();

    const on = await dealer.dashboard.setConsent({
      userId: PLAYER_ID,
      kind: "recording",
      value: true,
    });
    expect(on.recordingConsent).toBe(true);
    expect(on.recordingConsentUpdatedAt).toBeInstanceOf(Date);
    expect(on.socialMediaConsentUpdatedAt?.getTime()).toBe(
      social.socialMediaConsentUpdatedAt?.getTime(),
    );

    const off = await dealer.dashboard.setConsent({
      userId: PLAYER_ID,
      kind: "recording",
      value: false,
    });
    expect(off.recordingConsent).toBe(false);

    const unchanged = await dealer.dashboard.setConsent({
      userId: PLAYER_ID,
      kind: "recording",
      value: false,
    });
    expect(unchanged.recordingConsentUpdatedAt?.getTime()).toBe(
      off.recordingConsentUpdatedAt?.getTime(),
    );

    await expect(join()).rejects.toThrow(RECORDING_CONSENT_REQUIRED_ERROR);
  });

  it("restricts consent and waitlist admin endpoints to dealers", async () => {
    await expect(
      player.dashboard.setConsent({
        userId: PLAYER_ID,
        kind: "recording",
        value: true,
      }),
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
