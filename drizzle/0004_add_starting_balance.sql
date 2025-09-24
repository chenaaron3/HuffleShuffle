ALTER TYPE "public"."game_state" ADD VALUE 'INITIAL' BEFORE 'DEAL_HOLE_CARDS';--> statement-breakpoint
ALTER TYPE "public"."game_state" ADD VALUE 'GAME_START' BEFORE 'DEAL_HOLE_CARDS';--> statement-breakpoint
ALTER TABLE "huffle-shuffle_game" ALTER COLUMN "state" SET DATA TYPE text;