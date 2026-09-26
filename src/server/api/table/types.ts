import type { BlindState } from "~/server/api/lib/blind-timer";
import type { games, pokerTables, seats, tournaments } from "~/server/db/schema";

type SeatRow = typeof seats.$inferSelect;
type GameRow = typeof games.$inferSelect;
type TableRow = typeof pokerTables.$inferSelect;
type TournamentRow = typeof tournaments.$inferSelect;

export type SeatPlayer = {
  id: string;
  name: string | null;
  displayName: string;
};

export type SeatWithPlayer = SeatRow & {
  player?: SeatPlayer | null;
  cardsVisibleToOthers?: boolean;
};

export type TournamentSnapshot = TournamentRow & {
  winner?: SeatPlayer | null;
};

export type TableSnapshot = {
  table: TableRow | null;
  seats: SeatWithPlayer[];
  game: GameRow | null;
  tournament: TournamentSnapshot | null;
  isJoinable: boolean;
  isHandInProgress: boolean;
  isTournamentActive: boolean;
  availableSeats: number;
  blinds: BlindState;
};
