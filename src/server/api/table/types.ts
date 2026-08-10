import type { BlindState } from "~/server/api/lib/blind-timer";
import type { games, pokerTables, seats } from "~/server/db/schema";

type SeatRow = typeof seats.$inferSelect;
type GameRow = typeof games.$inferSelect;
type TableRow = typeof pokerTables.$inferSelect;

export type SeatWithPlayer = SeatRow & {
  player?: {
    id: string;
    name: string | null;
    displayName: string;
  } | null;
  cardsVisibleToOthers?: boolean;
};

export type TableSnapshot = {
  table: TableRow | null;
  seats: SeatWithPlayer[];
  game: GameRow | null;
  isJoinable: boolean;
  availableSeats: number;
  blinds: BlindState;
};
