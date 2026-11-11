import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createCaller } from "~/server/api/root";
import { PREFERRED_FIELD_REQUIRED_ERROR } from "~/server/api/routers/contact";
import { db } from "~/server/db";
import { contacts, users } from "~/server/db/schema";

const PLAYER_ID = "player-contact-vitest";
const DEALER_ID = "dealer-contact-vitest";
const PLAYER_EMAIL = "player-contact@vitest.local";

function callerFor(userId: string, role: "dealer" | "player") {
  return createCaller({
    session: {
      user: { id: userId, role },
      expires: new Date().toISOString(),
    },
    db,
  } as any);
}

describe("contact info", () => {
  const player = callerFor(PLAYER_ID, "player");
  const dealer = callerFor(DEALER_ID, "dealer");

  const cleanup = async () => {
    await db
      .delete(users)
      .where(inArray(users.id, [PLAYER_ID, DEALER_ID]));
  };

  beforeEach(async () => {
    await cleanup();
    await db.insert(users).values([
      {
        id: PLAYER_ID,
        email: PLAYER_EMAIL,
        role: "player",
        name: "Alex Rivera",
        displayName: "Alex",
      },
      {
        id: DEALER_ID,
        email: "dealer-contact@vitest.local",
        role: "dealer",
        name: "Dealer",
        displayName: "Dealer",
      },
    ]);
  });

  afterAll(cleanup);

  it("reports no contact until the player saves one", async () => {
    await expect(player.contact.get()).resolves.toEqual({
      email: PLAYER_EMAIL,
      contact: null,
    });
  });

  it("saves all fields, normalizes them, and keeps the preference", async () => {
    await player.contact.save({
      preferredContact: "instagram",
      phone: "(415) 555-0142",
      instagram: "@@alexr.poker",
    });

    await expect(player.contact.get()).resolves.toEqual({
      email: PLAYER_EMAIL,
      contact: {
        phone: "+14155550142",
        instagram: "alexr.poker",
        preferredContact: "instagram",
      },
    });
  });

  it("allows email as the preference with no other fields", async () => {
    await player.contact.save({ preferredContact: "email" });
    const { contact } = await player.contact.get();
    expect(contact).toEqual({
      phone: null,
      instagram: null,
      preferredContact: "email",
    });
  });

  it("requires the preferred field to be filled in", async () => {
    await expect(
      player.contact.save({ preferredContact: "phone", instagram: "alexr" }),
    ).rejects.toThrow(PREFERRED_FIELD_REQUIRED_ERROR);
    await expect(
      player.contact.save({ preferredContact: "instagram", phone: "4155550142" }),
    ).rejects.toThrow(PREFERRED_FIELD_REQUIRED_ERROR);
  });

  it("rejects malformed phone numbers and Instagram handles", async () => {
    await expect(
      player.contact.save({ preferredContact: "phone", phone: "12345" }),
    ).rejects.toThrow();
    await expect(
      player.contact.save({
        preferredContact: "instagram",
        instagram: "not a handle!",
      }),
    ).rejects.toThrow();
  });

  it("updates the existing row when saved again", async () => {
    await player.contact.save({ preferredContact: "phone", phone: "4155550142" });
    await player.contact.save({ preferredContact: "email" });

    const rows = await db
      .select()
      .from(contacts)
      .where(eq(contacts.userId, PLAYER_ID));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      preferredContact: "email",
      phone: null,
    });
    expect(rows[0]!.updatedAt).not.toBeNull();
  });

  it("lists contacts with the player's name and email for dealers", async () => {
    await player.contact.save({ preferredContact: "phone", phone: "4155550142" });
    const { rows } = await dealer.dashboard.listContacts({
      page: 1,
      pageSize: 100,
    });
    expect(rows.find((r) => r.userId === PLAYER_ID)).toMatchObject({
      name: "Alex Rivera",
      displayName: "Alex",
      email: PLAYER_EMAIL,
      phone: "+14155550142",
      preferredContact: "phone",
    });
  });
});
