import { eq } from "drizzle-orm";
import { isBot } from "~/server/api/bots/constants";
import {
  getWalletBalance,
  grantSignupBonus,
  SIGNUP_GRANT_AMOUNT,
} from "~/server/api/ledger";
import { db } from "~/server/db";
import { users } from "~/server/db/schema";

async function main() {
  const players = await db.query.users.findMany({
    where: eq(users.role, "player"),
    columns: { id: true, email: true, displayName: true },
  });

  let granted = 0;
  let skippedBots = 0;
  let alreadyFunded = 0;

  for (const player of players) {
    if (isBot(player.id)) {
      skippedBots += 1;
      continue;
    }

    const before = await db.transaction(async (tx) =>
      getWalletBalance(tx, player.id),
    );
    await db.transaction(async (tx) => {
      await grantSignupBonus(tx, player.id);
    });
    const after = await db.transaction(async (tx) =>
      getWalletBalance(tx, player.id),
    );

    if (before === after && after >= SIGNUP_GRANT_AMOUNT) {
      alreadyFunded += 1;
    } else {
      granted += 1;
      console.log(
        `granted ${player.displayName} (${player.email}): ${before} → ${after}`,
      );
    }
  }

  console.log(
    JSON.stringify(
      {
        players: players.length,
        granted,
        alreadyFunded,
        skippedBots,
        amount: SIGNUP_GRANT_AMOUNT,
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
