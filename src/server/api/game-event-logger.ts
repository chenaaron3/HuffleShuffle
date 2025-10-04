import { z } from 'zod';
import { gameEventEnum, gameEvents } from '~/server/db/schema';

type Tx = { insert: typeof import("~/server/db").db.insert };

export type GameEventType = (typeof gameEventEnum.enumValues)[number];

// --- Detail schemas per event ---
const StartGameDetails = z.object({
  dealerButtonSeatId: z.string(),
});

const RaiseDetails = z.object({
  seatId: z.string(),
  total: z.number().int().positive(),
});

const CallDetails = z.object({
  seatId: z.string(),
  total: z.number().int().nonnegative(),
});

const CheckDetails = z
  .object({ seatId: z.string(), total: z.number().int().nonnegative() })
  .strict();
const FoldDetails = z.object({ seatId: z.string() }).strict();

const StreetDetails = z.object({
  communityAll: z.array(z.string()),
});

const EndGameDetails = z.object({
  winners: z.array(
    z.object({
      seatId: z.string(),
      amount: z.number().int().nonnegative(),
      handType: z.string().optional(),
      cards: z.array(z.string()).optional(),
    }),
  ),
});

// --- Core logger ---
async function logEvent<T extends Record<string, unknown>>(
  tx: Tx,
  params: {
    tableId: string;
    gameId?: string | null;
    type: GameEventType;
    schema: z.ZodType<T>;
    details: T;
  },
): Promise<void> {
  const { tableId, gameId, type, schema, details } = params;
  const parsed = schema.parse(details);
  await tx.insert(gameEvents).values({
    tableId,
    gameId: gameId ?? null,
    type,
    details: parsed,
  });
}

// --- Public helpers (one per event) ---
export async function logStartGame(
  tx: Tx,
  tableId: string,
  gameId: string | null | undefined,
  details: z.infer<typeof StartGameDetails>,
): Promise<void> {
  return logEvent(tx, {
    tableId,
    gameId,
    type: "START_GAME",
    schema: StartGameDetails,
    details,
  });
}

export async function logRaise(
  tx: Tx,
  tableId: string,
  gameId: string,
  details: z.infer<typeof RaiseDetails>,
): Promise<void> {
  return logEvent(tx, {
    tableId,
    gameId,
    type: "RAISE",
    schema: RaiseDetails,
    details,
  });
}

export async function logCall(
  tx: Tx,
  tableId: string,
  gameId: string,
  details: z.infer<typeof CallDetails>,
): Promise<void> {
  return logEvent(tx, {
    tableId,
    gameId,
    type: "CALL",
    schema: CallDetails,
    details,
  });
}

export async function logCheck(
  tx: Tx,
  tableId: string,
  gameId: string,
  details: z.infer<typeof CheckDetails>,
): Promise<void> {
  return logEvent(tx, {
    tableId,
    gameId,
    type: "CHECK",
    schema: CheckDetails,
    details,
  });
}

export async function logFold(
  tx: Tx,
  tableId: string,
  gameId: string,
  details: z.infer<typeof FoldDetails>,
): Promise<void> {
  return logEvent(tx, {
    tableId,
    gameId,
    type: "FOLD",
    schema: FoldDetails,
    details,
  });
}

export async function logFlop(
  tx: Tx,
  tableId: string,
  gameId: string,
  details: z.infer<typeof StreetDetails>,
): Promise<void> {
  return logEvent(tx, {
    tableId,
    gameId,
    type: "FLOP",
    schema: StreetDetails,
    details,
  });
}

export async function logTurn(
  tx: Tx,
  tableId: string,
  gameId: string,
  details: z.infer<typeof StreetDetails>,
): Promise<void> {
  return logEvent(tx, {
    tableId,
    gameId,
    type: "TURN",
    schema: StreetDetails,
    details,
  });
}

export async function logRiver(
  tx: Tx,
  tableId: string,
  gameId: string,
  details: z.infer<typeof StreetDetails>,
): Promise<void> {
  return logEvent(tx, {
    tableId,
    gameId,
    type: "RIVER",
    schema: StreetDetails,
    details,
  });
}

export async function logEndGame(
  tx: Tx,
  tableId: string,
  gameId: string,
  details: z.infer<typeof EndGameDetails>,
): Promise<void> {
  return logEvent(tx, {
    tableId,
    gameId,
    type: "END_GAME",
    schema: EndGameDetails,
    details,
  });
}
