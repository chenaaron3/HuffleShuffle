import { seats } from "~/server/db/schema";

type SeatRow = typeof seats.$inferSelect;

export function findSeatByNumber(
  orderedSeats: Array<SeatRow>,
  seatNumber: number,
): SeatRow | undefined {
  return orderedSeats.find((s) => s.seatNumber === seatNumber);
}

export function isDealable(seat: SeatRow): boolean {
  return seat.seatStatus === "active" || seat.seatStatus === "all-in";
}

export function isAbsentOrEliminated(
  orderedSeats: Array<SeatRow>,
  seatNumber: number | null | undefined,
): boolean {
  if (seatNumber == null) return true;
  const seat = findSeatByNumber(orderedSeats, seatNumber);
  return !seat || seat.seatStatus === "eliminated";
}

export const activeCountOf = (orderedSeats: Array<SeatRow>): number =>
  orderedSeats.filter((s) => s.seatStatus === "active").length;

export const nonEliminatedCountOf = (orderedSeats: Array<SeatRow>): number =>
  orderedSeats.filter((s) => s.seatStatus !== "eliminated").length;

/** Next dealable seat clockwise after a seat number (wraps). Seat at afterNumber need not exist. */
export function getNextDealableSeatAfterNumber(
  orderedSeats: Array<SeatRow>,
  afterSeatNumber: number,
): SeatRow {
  const dealable = orderedSeats.filter(isDealable);
  if (dealable.length === 0) {
    throw new Error("No dealable seats");
  }
  const after = dealable.filter((s) => s.seatNumber > afterSeatNumber);
  return after[0] ?? dealable[0]!;
}

/** Next active (can act) seat clockwise after a seat number, or null if none. */
export function getNextActiveSeatAfterNumber(
  orderedSeats: Array<SeatRow>,
  afterSeatNumber: number,
): SeatRow | null {
  const active = orderedSeats.filter((s) => s.seatStatus === "active");
  if (active.length === 0) {
    return null;
  }
  const after = active.filter((s) => s.seatNumber > afterSeatNumber);
  return after[0] ?? active[0]!;
}
