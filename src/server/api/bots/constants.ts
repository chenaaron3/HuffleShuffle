import crypto from 'crypto';

// Bot user IDs - one dedicated bot per seat number (0-7)
export const BOT_USER_IDS = [
  "bot00000-0000-0000-0000-000000000000", // Seat 0
  "bot00000-0000-0000-0000-000000000001", // Seat 1
  "bot00000-0000-0000-0000-000000000002", // Seat 2
  "bot00000-0000-0000-0000-000000000003", // Seat 3
  "bot00000-0000-0000-0000-000000000004", // Seat 4
  "bot00000-0000-0000-0000-000000000005", // Seat 5
  "bot00000-0000-0000-0000-000000000006", // Seat 6
  "bot00000-0000-0000-0000-000000000007", // Seat 7
] as const;

// Set for O(1) lookup
const BOT_USER_ID_SET: Set<string> = new Set(BOT_USER_IDS);

/**
 * Check if a user ID belongs to a bot
 */
export function isBot(userId: string | null | undefined): boolean {
  if (!userId) return false;
  return BOT_USER_ID_SET.has(userId);
}

/**
 * Get the bot user ID for a specific seat number
 */
export function getBotIdForSeat(seatNumber: number): string {
  if (seatNumber < 0 || seatNumber >= BOT_USER_IDS.length) {
    throw new Error(`Invalid seat number: ${seatNumber}`);
  }
  return BOT_USER_IDS[seatNumber]!;
}

/**
 * Get bot name for display
 */
export function getBotName(seatNumber: number): string {
  return `Bot ${seatNumber + 1}`;
}

/**
 * Generate a random RSA public key for bots
 * Bots don't actually use these keys, but we need them for the encryption flow
 */
export function generateBotPublicKey(): string {
  const { publicKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
    },
  });
  return publicKey;
}
