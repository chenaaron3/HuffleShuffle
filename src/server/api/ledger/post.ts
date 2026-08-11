import { asc, eq, inArray } from "drizzle-orm";
import {
  ledgerAccounts,
  ledgerEntries,
  ledgerTransactions,
} from "~/server/db/schema";

import type {
  LedgerEntryInput,
  LedgerTransaction,
  LedgerTx,
} from "./types";

/**
 * Balance delta for one entry.
 * - LIABILITY (USER_WALLET, TABLE_USER_ESCROW): credit +, debit −
 * - ISSUANCE: debit + (chips issued into the system), credit − (burn)
 */
function balanceDelta(
  kind: "ISSUANCE" | "USER_WALLET" | "TABLE_USER_ESCROW",
  side: "debit" | "credit",
  amount: number,
): number {
  if (kind === "ISSUANCE") {
    return side === "debit" ? amount : -amount;
  }
  return side === "credit" ? amount : -amount;
}

export async function postTransaction(
  tx: LedgerTx,
  params: {
    type: "MINT" | "BURN" | "TRANSFER" | "SETTLE_HAND";
    description: string;
    idempotencyKey: string;
    entries: LedgerEntryInput[];
    gameId?: string | null;
    reason?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<LedgerTransaction> {
  const existing = await tx.query.ledgerTransactions.findFirst({
    where: eq(ledgerTransactions.idempotencyKey, params.idempotencyKey),
  });
  if (existing) return existing;

  if (params.entries.length < 2) {
    throw new Error("Ledger transaction requires at least two entries");
  }

  let debitTotal = 0;
  let creditTotal = 0;
  for (const entry of params.entries) {
    if (!Number.isInteger(entry.amount) || entry.amount <= 0) {
      throw new Error(`Invalid ledger entry amount: ${entry.amount}`);
    }
    if (entry.side === "debit") debitTotal += entry.amount;
    else creditTotal += entry.amount;
  }
  if (debitTotal !== creditTotal) {
    throw new Error(
      `Ledger transaction not balanced: debits=${debitTotal} credits=${creditTotal}`,
    );
  }

  const accountIds = [...new Set(params.entries.map((e) => e.accountId))].sort();
  const locked = await tx
    .select()
    .from(ledgerAccounts)
    .where(inArray(ledgerAccounts.id, accountIds))
    .orderBy(asc(ledgerAccounts.id))
    .for("update");

  if (locked.length !== accountIds.length) {
    throw new Error("Ledger account missing while posting transaction");
  }

  const byId = new Map(locked.map((a) => [a.id, a]));

  const insertedTx = await tx
    .insert(ledgerTransactions)
    .values({
      type: params.type,
      description: params.description,
      idempotencyKey: params.idempotencyKey,
      gameId: params.gameId ?? null,
      reason: params.reason ?? null,
      metadata: params.metadata ?? {},
    })
    .returning();
  const transaction = insertedTx[0];
  if (!transaction) throw new Error("Failed to insert ledger transaction");

  for (const entry of params.entries) {
    await tx.insert(ledgerEntries).values({
      transactionId: transaction.id,
      accountId: entry.accountId,
      side: entry.side,
      amount: entry.amount,
    });

    const account = byId.get(entry.accountId);
    if (!account) throw new Error("Ledger account not locked");
    const next = account.balance + balanceDelta(account.kind, entry.side, entry.amount);
    if (next < 0) {
      throw new Error(
        `Insufficient ledger balance on ${account.code}: have ${account.balance}, entry ${entry.side} ${entry.amount}`,
      );
    }
    account.balance = next;
    await tx
      .update(ledgerAccounts)
      .set({ balance: next })
      .where(eq(ledgerAccounts.id, account.id));
  }

  return transaction;
}
