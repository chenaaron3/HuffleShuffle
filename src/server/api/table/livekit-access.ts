import { createHmac } from "crypto";

export type LiveKitAccessMode = "publish" | "subscribe";

/**
 * Dealers and seated players publish. Anyone else may subscribe to the
 * table room only. Membership (already at another table) is enforced elsewhere.
 */
export function resolveLiveKitAccess(input: {
  tableDealerId: string | null | undefined;
  userId: string;
  seatedAtThisTable: boolean;
}): LiveKitAccessMode {
  const isDealerHere = input.tableDealerId === input.userId;
  if (isDealerHere || input.seatedAtThisTable) return "publish";
  return "subscribe";
}

/**
 * Private hand-camera room for a seat. Derived (not stored) so the server can
 * recompute it to authorize tokens without persisting a plaintext room name on
 * the seat row, which would ride along in table snapshots.
 */
export function handRoomNameForSeat(seatId: string, secret: string): string {
  const digest = createHmac("sha256", secret)
    .update(`hand-room:${seatId}`)
    .digest("hex");
  return `hand-${digest.slice(0, 32)}`;
}

export function getHandRoomSecret(): string {
  const secret = process.env.LIVEKIT_API_SECRET;
  if (!secret) throw new Error("LIVEKIT_API_SECRET is not configured");
  return secret;
}

/** A caller may join the public table room, or their own hand-camera room. */
export function canJoinLiveKitRoom(input: {
  tableId: string;
  requestedRoom: string;
  ownHandRoom: string | null;
}): boolean {
  if (input.requestedRoom === input.tableId) return true;
  return input.ownHandRoom !== null && input.requestedRoom === input.ownHandRoom;
}
