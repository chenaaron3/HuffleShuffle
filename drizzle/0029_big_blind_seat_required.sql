-- Backfill bigBlindSeatId for historical games, then make it NOT NULL.
-- Prefer dealer button seat as a dummy when the real BB was never stored.
UPDATE "huffle-shuffle_game"
SET "bigBlindSeatId" = "dealerButtonSeatId"
WHERE "bigBlindSeatId" IS NULL
  AND "dealerButtonSeatId" IS NOT NULL;
--> statement-breakpoint
UPDATE "huffle-shuffle_game" AS g
SET "bigBlindSeatId" = (
  SELECT s.id
  FROM "huffle-shuffle_seat" AS s
  WHERE s."tableId" = g."tableId"
  ORDER BY s."seatNumber"
  LIMIT 1
)
WHERE g."bigBlindSeatId" IS NULL
  AND EXISTS (
    SELECT 1 FROM "huffle-shuffle_seat" AS s WHERE s."tableId" = g."tableId"
  );
--> statement-breakpoint
-- Orphan completed games with no seats left cannot satisfy the FK; drop them.
DELETE FROM "huffle-shuffle_game" WHERE "bigBlindSeatId" IS NULL;
--> statement-breakpoint
ALTER TABLE "huffle-shuffle_game" DROP CONSTRAINT IF EXISTS "huffle-shuffle_game_bigBlindSeatId_huffle-shuffle_seat_id_fk";
--> statement-breakpoint
ALTER TABLE "huffle-shuffle_game" ALTER COLUMN "bigBlindSeatId" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "huffle-shuffle_game" ADD CONSTRAINT "huffle-shuffle_game_bigBlindSeatId_huffle-shuffle_seat_id_fk"
  FOREIGN KEY ("bigBlindSeatId") REFERENCES "public"."huffle-shuffle_seat"("id") ON DELETE restrict ON UPDATE no action;
