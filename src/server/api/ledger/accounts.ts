import { eq } from "drizzle-orm";
import { ledgerAccounts } from "~/server/db/schema";

import {
  ISSUANCE_ACCOUNT_CODE,
  tableEscrowCode,
  userWalletCode,
} from "./constants";
import type { AccountRef, LedgerAccount, LedgerTx } from "./types";

function codeFor(ref: AccountRef): string {
  switch (ref.kind) {
    case "ISSUANCE":
      return ISSUANCE_ACCOUNT_CODE;
    case "USER_WALLET":
      return userWalletCode(ref.userId);
    case "TABLE_USER_ESCROW":
      return tableEscrowCode(ref.tableId, ref.userId);
  }
}

export async function getAccountByCode(
  tx: LedgerTx,
  code: string,
): Promise<LedgerAccount | undefined> {
  return tx.query.ledgerAccounts.findFirst({
    where: eq(ledgerAccounts.code, code),
  });
}

export async function ensureAccount(
  tx: LedgerTx,
  ref: AccountRef,
): Promise<LedgerAccount> {
  const code = codeFor(ref);
  const existing = await getAccountByCode(tx, code);
  if (existing) return existing;

  const values = {
    code,
    kind: ref.kind,
    userId: ref.kind === "ISSUANCE" ? null : ref.userId,
    tableId: ref.kind === "TABLE_USER_ESCROW" ? ref.tableId : null,
    balance: 0,
  };

  const inserted = await tx.insert(ledgerAccounts).values(values).returning();
  const row = inserted[0];
  if (!row) throw new Error(`Failed to create ledger account ${code}`);
  return row;
}

export async function getWalletBalance(
  tx: LedgerTx,
  userId: string,
): Promise<number> {
  const account = await getAccountByCode(tx, userWalletCode(userId));
  return account?.balance ?? 0;
}
