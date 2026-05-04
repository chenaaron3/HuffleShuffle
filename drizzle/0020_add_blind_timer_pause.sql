ALTER TABLE "huffle-shuffle_poker_table"
    ADD COLUMN "blind_timer_is_paused" boolean DEFAULT false NOT NULL;

ALTER TABLE "huffle-shuffle_poker_table"
    ADD COLUMN "blind_timer_frozen_elapsed_seconds" integer;
