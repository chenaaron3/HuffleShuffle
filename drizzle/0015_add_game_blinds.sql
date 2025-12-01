ALTER TABLE "huffle-shuffle_game"
    ADD COLUMN "effective_small_blind" integer NOT NULL DEFAULT 0;

ALTER TABLE "huffle-shuffle_game"
    ADD COLUMN "effective_big_blind" integer NOT NULL DEFAULT 0;

