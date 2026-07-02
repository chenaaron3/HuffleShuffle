import { sql } from "drizzle-orm";

import type { SQL } from "drizzle-orm";

/** Namespace for pg_advisory_xact_lock — avoids colliding with other lock users. */
export const TABLE_MUTATION_LOCK_NS = 1_319_031;

interface LockableTransaction {
  execute: (query: SQL | string) => Promise<unknown>;
}

type TransactionDatabase<TTx extends LockableTransaction> = {
  transaction: <T>(fn: (tx: TTx) => Promise<T>) => Promise<T>;
};

/**
 * Run a table mutation with a per-table advisory lock so only one writer
 * transaction runs at a time for the given tableId (across API + Lambda).
 */
export async function withTableMutation<
  TTx extends LockableTransaction,
  T,
>(
  database: TransactionDatabase<TTx>,
  tableId: string,
  fn: (tx: TTx) => Promise<T>,
): Promise<T> {
  return database.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(${TABLE_MUTATION_LOCK_NS}, hashtext(${tableId}))`,
    );
    return fn(tx);
  });
}
