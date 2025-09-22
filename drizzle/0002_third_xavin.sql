ALTER TABLE "huffle-shuffle_seat" ADD COLUMN "winAmount" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "huffle-shuffle_seat" ADD COLUMN "winningCards" text[] DEFAULT ARRAY[]::text[];