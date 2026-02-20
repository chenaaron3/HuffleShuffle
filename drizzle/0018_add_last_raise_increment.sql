-- Add lastRaiseIncrement for minimum re-raise rule (TDA)
ALTER TABLE "huffle-shuffle_game" ADD COLUMN "lastRaiseIncrement" integer DEFAULT 0 NOT NULL;
