import type { db } from "~/server/db";
import type {
  ledgerAccounts,
  ledgerTransactions,
} from "~/server/db/schema";

export type LedgerTx = {
  insert: typeof db.insert;
  query: typeof db.query;
  update: typeof db.update;
  select: typeof db.select;
};

export type LedgerAccount = typeof ledgerAccounts.$inferSelect;
export type LedgerTransaction = typeof ledgerTransactions.$inferSelect;

export type LedgerEntryInput = {
  accountId: string;
  side: "debit" | "credit";
  amount: number;
};

export type AccountRef =
  | { kind: "ISSUANCE" }
  | { kind: "USER_WALLET"; userId: string }
  | { kind: "TABLE_USER_ESCROW"; tableId: string; userId: string };

export type MintBurnReason =
  | "SIGNUP_GRANT"
  | "BOT_FUND"
  | "TEST_FUND"
  | "ADMIN_ADJUST";
