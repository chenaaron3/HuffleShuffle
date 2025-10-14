-- Custom SQL migration generated manually for side pots and seat status

-- Create seat_status enum
DO $$ BEGIN
 CREATE TYPE "public"."seat_status" AS ENUM('active', 'all-in', 'folded');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Add seat_status column to seats table with default 'active'
ALTER TABLE "huffle-shuffle_seat" ADD COLUMN "seat_status" "seat_status" DEFAULT 'active' NOT NULL;

-- Migrate existing isActive data to seatStatus
-- If isActive is true, set to 'active', if false set to 'folded'
UPDATE "huffle-shuffle_seat" SET "seat_status" = CASE WHEN "isActive" = true THEN 'active'::"seat_status" ELSE 'folded'::"seat_status" END;

-- Drop isActive column
ALTER TABLE "huffle-shuffle_seat" DROP COLUMN "isActive";

-- Add sidePots column to games table
ALTER TABLE "huffle-shuffle_game" ADD COLUMN "sidePots" jsonb DEFAULT '[]'::jsonb NOT NULL;

