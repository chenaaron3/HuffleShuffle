-- Add voluntaryShow for players to optionally reveal hand at showdown
ALTER TABLE "huffle-shuffle_seat" ADD COLUMN "voluntaryShow" boolean DEFAULT false NOT NULL;
