-- Add wasReset flag to games table to prevent button advancement on reset
ALTER TABLE "game" ADD COLUMN "wasReset" boolean DEFAULT false NOT NULL;

