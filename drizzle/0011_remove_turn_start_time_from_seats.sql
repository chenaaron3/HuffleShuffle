-- Remove turnStartTime column from seats table since it's now stored in games table
ALTER TABLE "huffle-shuffle_seat" DROP COLUMN IF EXISTS "turnStartTime";
