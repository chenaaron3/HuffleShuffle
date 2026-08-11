import { ensureAccount, getWalletBalance } from "./accounts";
import { BOT_WALLET_GRANT_AMOUNT, SIGNUP_GRANT_AMOUNT } from "./constants";
import { postTransaction } from "./post";
import type {
  AccountRef,
  LedgerTransaction,
  LedgerTx,
  MintBurnReason,
} from "./types";

async function resolveAccount(tx: LedgerTx, ref: AccountRef) {
  return ensureAccount(tx, ref);
}

/**
 * Create chips that did not previously exist in the economy.
 *
 * When to use:
 * - Signup / play-money faucet (`reason: "SIGNUP_GRANT"`) → credit user wallet
 * - One-time bot wallet fill (`reason: "BOT_FUND"`) → credit bot wallet
 * - Admin / test top-ups (`reason: "TEST_FUND"` | `"ADMIN_ADJUST"`)
 *
 * Money flow (amount = 100_000 signup grant to Alice):
 * - debit  ISSUANCE          100_000  (chips issued into the system)
 * - credit USER_WALLET:alice 100_000  (Alice can spend)
 */
export async function mint(
  tx: LedgerTx,
  params: {
    to: Exclude<AccountRef, { kind: "ISSUANCE" }>;
    amount: number;
    reason: MintBurnReason;
    idempotencyKey: string;
    description?: string;
  },
): Promise<LedgerTransaction> {
  const issuance = await resolveAccount(tx, { kind: "ISSUANCE" });
  const dest = await resolveAccount(tx, params.to);
  return postTransaction(tx, {
    type: "MINT",
    description:
      params.description ?? `Mint ${params.amount} (${params.reason})`,
    idempotencyKey: params.idempotencyKey,
    reason: params.reason,
    entries: [
      { accountId: issuance.id, side: "debit", amount: params.amount },
      { accountId: dest.id, side: "credit", amount: params.amount },
    ],
  });
}

/**
 * Destroy chips, removing them from the economy (inverse of mint).
 *
 * When to use:
 * - Test / admin reductions (`reason: "TEST_FUND"` | `"ADMIN_ADJUST"`)
 *
 * Money flow (burn 200 from Alice's wallet):
 * - debit  USER_WALLET:alice  200
 * - credit ISSUANCE           200  (chips retired from circulation)
 *
 * No-op when `amount === 0` (returns null).
 */
export async function burn(
  tx: LedgerTx,
  params: {
    from: Exclude<AccountRef, { kind: "ISSUANCE" }>;
    amount: number;
    reason: MintBurnReason;
    idempotencyKey: string;
    description?: string;
  },
): Promise<LedgerTransaction | null> {
  if (params.amount === 0) return null;
  const issuance = await resolveAccount(tx, { kind: "ISSUANCE" });
  const source = await resolveAccount(tx, params.from);
  return postTransaction(tx, {
    type: "BURN",
    description:
      params.description ?? `Burn ${params.amount} (${params.reason})`,
    idempotencyKey: params.idempotencyKey,
    reason: params.reason,
    entries: [
      { accountId: source.id, side: "debit", amount: params.amount },
      { accountId: issuance.id, side: "credit", amount: params.amount },
    ],
  });
}

/**
 * Move chips between two non-issuance accounts. Total chips in the system unchanged.
 *
 * When to use:
 * - Prefer the named wrappers (`buyIn`, `rebuy`, `cashOut`) for table flows
 * - Generic moves that don't fit those wrappers
 *
 * Money flow (Alice moves 300 from wallet → table T escrow):
 * - debit  USER_WALLET:alice         300
 * - credit TABLE_USER_ESCROW:T:alice 300
 */
export async function transfer(
  tx: LedgerTx,
  params: {
    from: Exclude<AccountRef, { kind: "ISSUANCE" }>;
    to: Exclude<AccountRef, { kind: "ISSUANCE" }>;
    amount: number;
    idempotencyKey: string;
    description?: string;
    reason?: string;
  },
): Promise<LedgerTransaction> {
  if (params.amount <= 0) {
    throw new Error(`Transfer amount must be positive (got ${params.amount})`);
  }
  const source = await resolveAccount(tx, params.from);
  const dest = await resolveAccount(tx, params.to);
  return postTransaction(tx, {
    type: "TRANSFER",
    description:
      params.description ??
      `Transfer ${params.amount} from ${source.code} to ${dest.code}`,
    idempotencyKey: params.idempotencyKey,
    reason: params.reason ?? null,
    entries: [
      { accountId: source.id, side: "debit", amount: params.amount },
      { accountId: dest.id, side: "credit", amount: params.amount },
    ],
  });
}

/**
 * Seat a human at a table: lock chips from their wallet into per-user table escrow.
 *
 * When to use:
 * - `table.join` / `createSeatTransaction` for a non-bot player
 *
 * Money flow (Alice buys in for 1_000 on table T):
 * - debit  USER_WALLET:alice         1_000  (wallet 50_000 → 49_000)
 * - credit TABLE_USER_ESCROW:T:alice 1_000  (escrow 0 → 1_000)
 * Seat `buyIn` is set to 1_000 in the same DB transaction (not a ledger entry).
 */
export async function buyIn(
  tx: LedgerTx,
  params: {
    userId: string;
    tableId: string;
    amount: number;
    idempotencyKey: string;
  },
): Promise<LedgerTransaction> {
  return transfer(tx, {
    from: { kind: "USER_WALLET", userId: params.userId },
    to: {
      kind: "TABLE_USER_ESCROW",
      tableId: params.tableId,
      userId: params.userId,
    },
    amount: params.amount,
    idempotencyKey: params.idempotencyKey,
    description: `Buy-in ${params.amount} to table ${params.tableId}`,
    reason: "BUY_IN",
  });
}

/**
 * Add chips to an already-seated player's escrow between hands (same books as buy-in).
 *
 * When to use:
 * - Player tops up mid-session while no hand is active
 *
 * Money flow (Alice rebys 500 on table T):
 * - debit  USER_WALLET:alice         500
 * - credit TABLE_USER_ESCROW:T:alice 500
 * Caller must also bump `seats.buyIn` (and related seat fields) in the same tx.
 */
export async function rebuy(
  tx: LedgerTx,
  params: {
    userId: string;
    tableId: string;
    amount: number;
    idempotencyKey: string;
  },
): Promise<LedgerTransaction> {
  return transfer(tx, {
    from: { kind: "USER_WALLET", userId: params.userId },
    to: {
      kind: "TABLE_USER_ESCROW",
      tableId: params.tableId,
      userId: params.userId,
    },
    amount: params.amount,
    idempotencyKey: params.idempotencyKey,
    description: `Rebuy ${params.amount} on table ${params.tableId}`,
    reason: "REBUY",
  });
}

/**
 * Leave a table: return escrow chips to the player's wallet.
 *
 * When to use:
 * - `table.leave` / `removePlayer` / `removeBot` between hands (after `settleHand`
 *   so escrow balance matches `seats.buyIn`)
 *
 * Money flow (Alice cashes out 1_250 from table T):
 * - debit  TABLE_USER_ESCROW:T:alice 1_250  (escrow → 0)
 * - credit USER_WALLET:alice         1_250  (wallet increases)
 *
 * No-op when `amount === 0` (returns null). Same path for humans and bots.
 */
export async function cashOut(
  tx: LedgerTx,
  params: {
    userId: string;
    tableId: string;
    amount: number;
    idempotencyKey: string;
  },
): Promise<LedgerTransaction | null> {
  if (params.amount === 0) return null;
  return transfer(tx, {
    from: {
      kind: "TABLE_USER_ESCROW",
      tableId: params.tableId,
      userId: params.userId,
    },
    to: { kind: "USER_WALLET", userId: params.userId },
    amount: params.amount,
    idempotencyKey: params.idempotencyKey,
    description: `Cash-out ${params.amount} from table ${params.tableId}`,
    reason: "CASH_OUT",
  });
}

/**
 * After showdown (or fold-win), rebalance each player's table escrow to match
 * their final seat stack. In-hand bets only mutate `seats.buyIn`; this is when
 * the books catch up. Idempotent per `gameId`.
 *
 * When to use:
 * - End of `completeShowdown` in hand-solver, once seat stacks are final
 *
 * Money flow (Alice started escrow 1_000, ends stack 700; Bob 1_000 → 1_300):
 * - debit  TABLE_USER_ESCROW:T:alice  300  (lost 300)
 * - credit TABLE_USER_ESCROW:T:bob    300  (won 300)
 * Net deltas across all seats must sum to zero (no mint/burn at the table).
 *
 * Returns null when every escrow already matches its stack (nothing to post).
 */
export async function settleHand(
  tx: LedgerTx,
  params: {
    tableId: string;
    gameId: string;
    positions: Array<{ userId: string; stack: number }>;
  },
): Promise<LedgerTransaction | null> {
  const idempotencyKey = `settleHand:${params.gameId}`;
  const entries: Array<{
    accountId: string;
    side: "debit" | "credit";
    amount: number;
  }> = [];

  let debitTotal = 0;
  let creditTotal = 0;

  for (const pos of params.positions) {
    if (!Number.isInteger(pos.stack) || pos.stack < 0) {
      throw new Error(`Invalid stack for settleHand: ${pos.stack}`);
    }
    const escrow = await ensureAccount(tx, {
      kind: "TABLE_USER_ESCROW",
      tableId: params.tableId,
      userId: pos.userId,
    });
    const delta = pos.stack - escrow.balance;
    if (delta === 0) continue;
    if (delta < 0) {
      entries.push({
        accountId: escrow.id,
        side: "debit",
        amount: -delta,
      });
      debitTotal += -delta;
    } else {
      entries.push({
        accountId: escrow.id,
        side: "credit",
        amount: delta,
      });
      creditTotal += delta;
    }
  }

  if (entries.length === 0) {
    // Nothing to move; callers treat null as success (stacks already matched).
    return null;
  }

  if (debitTotal !== creditTotal) {
    throw new Error(
      `settleHand deltas do not balance for game ${params.gameId}: debits=${debitTotal} credits=${creditTotal}`,
    );
  }

  return postTransaction(tx, {
    type: "SETTLE_HAND",
    description: `Settle hand ${params.gameId} on table ${params.tableId}`,
    idempotencyKey,
    gameId: params.gameId,
    entries,
  });
}

/**
 * Play-money grant for a new user (and backfill scripts). Thin wrapper over `mint`.
 *
 * When to use:
 * - NextAuth `createUser` event
 * - One-off `scripts/grant-player-credits.ts` for existing players
 *
 * Money flow (`SIGNUP_GRANT_AMOUNT` = 100_000):
 * - debit  ISSUANCE          100_000
 * - credit USER_WALLET:user  100_000
 *
 * Idempotency key is always `promo:signup:{userId}` — safe to call twice.
 */
export async function grantSignupBonus(
  tx: LedgerTx,
  userId: string,
): Promise<LedgerTransaction> {
  return mint(tx, {
    to: { kind: "USER_WALLET", userId },
    amount: SIGNUP_GRANT_AMOUNT,
    reason: "SIGNUP_GRANT",
    idempotencyKey: `promo:signup:${userId}`,
    description: `Signup grant ${SIGNUP_GRANT_AMOUNT}`,
  });
}

/**
 * One-time huge wallet for a bot user so join/leave use normal buy-in / cash-out.
 *
 * When to use:
 * - `table.addBot` before `createSeatTransaction` (idempotent if bot already funded)
 *
 * Money flow (`BOT_WALLET_GRANT_AMOUNT` = 100_000_000):
 * - debit  ISSUANCE             100_000_000
 * - credit USER_WALLET:botId    100_000_000
 *
 * Idempotency key is always `bot:fund:{userId}`.
 */
export async function grantBotFunds(
  tx: LedgerTx,
  userId: string,
): Promise<LedgerTransaction> {
  return mint(tx, {
    to: { kind: "USER_WALLET", userId },
    amount: BOT_WALLET_GRANT_AMOUNT,
    reason: "BOT_FUND",
    idempotencyKey: `bot:fund:${userId}`,
    description: `Bot wallet grant ${BOT_WALLET_GRANT_AMOUNT}`,
  });
}

export { getWalletBalance };
