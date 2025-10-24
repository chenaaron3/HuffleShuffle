-- Add turnStartTime column to games table for timer functionality
ALTER TABLE "huffle-shuffle_game" ADD COLUMN "turn_start_time" timestamp with time zone;
