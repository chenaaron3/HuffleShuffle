-- Make dealerId nullable and update indexes
ALTER TABLE "huffle-shuffle_poker_table" ALTER COLUMN "dealer_id" DROP NOT NULL;

-- Drop the unique index on dealerId
DROP INDEX IF EXISTS "poker_table_dealer_id_unique";

-- Create a regular index on dealerId
CREATE INDEX IF NOT EXISTS "poker_table_dealer_id_idx" ON "huffle-shuffle_poker_table" USING btree ("dealer_id");

