-- Durable button/blind positions as seat numbers; drop seat-id FKs.
ALTER TABLE "huffle-shuffle_game" ADD COLUMN IF NOT EXISTS "dealerButtonSeatNumber" integer;
ALTER TABLE "huffle-shuffle_game" ADD COLUMN IF NOT EXISTS "smallBlindSeatNumber" integer;
ALTER TABLE "huffle-shuffle_game" ADD COLUMN IF NOT EXISTS "bigBlindSeatNumber" integer;
--> statement-breakpoint
UPDATE "huffle-shuffle_game" AS g
SET "dealerButtonSeatNumber" = s."seatNumber"
FROM "huffle-shuffle_seat" AS s
WHERE g."dealerButtonSeatId" = s.id
  AND (g."dealerButtonSeatNumber" IS NULL);
--> statement-breakpoint
UPDATE "huffle-shuffle_game" AS g
SET "smallBlindSeatNumber" = s."seatNumber"
FROM "huffle-shuffle_seat" AS s
WHERE g."smallBlindSeatId" = s.id
  AND g."smallBlindSeatNumber" IS NULL;
--> statement-breakpoint
UPDATE "huffle-shuffle_game" AS g
SET "bigBlindSeatNumber" = s."seatNumber"
FROM "huffle-shuffle_seat" AS s
WHERE g."bigBlindSeatId" = s.id
  AND (g."bigBlindSeatNumber" IS NULL);
--> statement-breakpoint
UPDATE "huffle-shuffle_game"
SET "dealerButtonSeatNumber" = 0
WHERE "dealerButtonSeatNumber" IS NULL;
--> statement-breakpoint
UPDATE "huffle-shuffle_game"
SET "bigBlindSeatNumber" = COALESCE("bigBlindSeatNumber", "dealerButtonSeatNumber", 0)
WHERE "bigBlindSeatNumber" IS NULL;
--> statement-breakpoint
ALTER TABLE "huffle-shuffle_game" ALTER COLUMN "dealerButtonSeatNumber" SET DEFAULT 0;
ALTER TABLE "huffle-shuffle_game" ALTER COLUMN "dealerButtonSeatNumber" SET NOT NULL;
ALTER TABLE "huffle-shuffle_game" ALTER COLUMN "bigBlindSeatNumber" SET DEFAULT 0;
ALTER TABLE "huffle-shuffle_game" ALTER COLUMN "bigBlindSeatNumber" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "huffle-shuffle_game" DROP CONSTRAINT IF EXISTS "huffle-shuffle_game_dealerButtonSeatId_huffle-shuffle_seat_id_fk";
ALTER TABLE "huffle-shuffle_game" DROP CONSTRAINT IF EXISTS "huffle-shuffle_game_dealerButtonSeatId_huffle-shuffle_seat_id_f";
ALTER TABLE "huffle-shuffle_game" DROP CONSTRAINT IF EXISTS "huffle-shuffle_game_smallBlindSeatId_huffle-shuffle_seat_id_fk";
ALTER TABLE "huffle-shuffle_game" DROP CONSTRAINT IF EXISTS "huffle-shuffle_game_bigBlindSeatId_huffle-shuffle_seat_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "game_dealer_button_seat_id_idx";
--> statement-breakpoint
ALTER TABLE "huffle-shuffle_game" DROP COLUMN IF EXISTS "dealerButtonSeatId";
ALTER TABLE "huffle-shuffle_game" DROP COLUMN IF EXISTS "smallBlindSeatId";
ALTER TABLE "huffle-shuffle_game" DROP COLUMN IF EXISTS "bigBlindSeatId";
