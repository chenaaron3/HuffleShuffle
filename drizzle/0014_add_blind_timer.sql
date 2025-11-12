ALTER TABLE "poker_table"
    ADD COLUMN "blind_step_seconds" integer NOT NULL DEFAULT 600;

ALTER TABLE "poker_table"
    ADD COLUMN "blind_timer_started_at" timestamp with time zone;

