import { randomUUID } from "crypto";
import { burn, getWalletBalance, mint } from "~/server/api/ledger";
import { db } from "~/server/db";
import {
  ledgerAccounts,
  ledgerEntries,
  ledgerTransactions,
} from "~/server/db/schema";

/** Wipe all ledger rows (test DB isolation only). */
export async function clearTestLedger(): Promise<void> {
  await db.delete(ledgerEntries);
  await db.delete(ledgerTransactions);
  await db.delete(ledgerAccounts);
}

/** Set a user wallet to exactly `amount` for tests. */
export async function ensureTestWalletBalance(
  userId: string,
  amount: number,
): Promise<void> {
  if (amount < 0) throw new Error("amount must be non-negative");
  await db.transaction(async (tx) => {
    const current = await getWalletBalance(tx, userId);
    if (current === amount) return;
    if (current < amount) {
      await mint(tx, {
        to: { kind: "USER_WALLET", userId },
        amount: amount - current,
        reason: "TEST_FUND",
        idempotencyKey: `test:fund:${userId}:${randomUUID()}`,
        description: `Test fund to ${amount}`,
      });
      return;
    }
    await burn(tx, {
      from: { kind: "USER_WALLET", userId },
      amount: current - amount,
      reason: "TEST_FUND",
      idempotencyKey: `test:burn:${userId}:${randomUUID()}`,
      description: `Test burn down to ${amount}`,
    });
  });
}
