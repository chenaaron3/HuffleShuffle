import type {
  seats as SeatsTable,
  games as GamesTable,
  pokerTables as PokerTablesTable,
} from "~/server/db/schema";

export type PlayerKey =
  | "player1"
  | "player2"
  | "player3"
  | "player4"
  | "player5"
  | "player6"
  | "player7"
  | "player8";

export type ActionName =
  | "START_GAME"
  | "DEAL_CARD"
  | "RESET_TABLE"
  | "RAISE"
  | "FOLD"
  | "CHECK";

export type JoinStep = {
  type: "join";
  players: PlayerKey[];
};

export type DealHoleStep = {
  type: "deal_hole";
  // Map of players to exactly two card codes, e.g. "As", "Kd"
  hole: Partial<Record<PlayerKey, [string, string]>>;
};

export type ActionStep = {
  type: "action";
  action: ActionName;
  by: PlayerKey | "dealer";
  params?: { rank?: string; suit?: string; amount?: number };
  isError?: boolean;
};

// Lightweight shapes used only for validation steps in scenarios
type SeatRow = typeof SeatsTable.$inferSelect;
type PrimitiveComparable = string | number | boolean | null | string[];
type KeysMatching<T, V> = {
  [K in keyof T]-?: T[K] extends V ? K : never;
}[keyof T];
export type SeatSubset = Partial<
  Pick<SeatRow, KeysMatching<SeatRow, PrimitiveComparable>>
>;

type GameRow = typeof GamesTable.$inferSelect;
export type GameSubset = Partial<
  Pick<GameRow, KeysMatching<GameRow, PrimitiveComparable>>
>;

type PokerTableRow = typeof PokerTablesTable.$inferSelect;
export type TableSubset = Partial<
  Pick<PokerTableRow, KeysMatching<PokerTableRow, PrimitiveComparable>>
>;

export type ValidateStep = {
  type: "validate";
  game?: GameSubset;
  table?: TableSubset;
  seats?: Partial<Record<PlayerKey, SeatSubset>>;
};

export type Step = JoinStep | DealHoleStep | ActionStep | ValidateStep;

export type Scenario = {
  name: string;
  steps: Step[];
};
