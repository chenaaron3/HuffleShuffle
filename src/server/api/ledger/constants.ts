/** Chips minted to every new user wallet (play money). */
export const SIGNUP_GRANT_AMOUNT = 100_000;

/** One-time wallet fill for bot users so they buy in / cash out like humans. */
export const BOT_WALLET_GRANT_AMOUNT = 100_000_000;

export const ISSUANCE_ACCOUNT_CODE = "issuance";

export function userWalletCode(userId: string): string {
  return `user:${userId}`;
}

export function tableEscrowCode(tableId: string, userId: string): string {
  return `escrow:${tableId}:${userId}`;
}
