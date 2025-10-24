-- Add turnStartTime column to seats table for timer functionality
ALTER TABLE "huffle-shuffle_seat" ADD COLUMN "turn_start_time" timestamp with time zone;
