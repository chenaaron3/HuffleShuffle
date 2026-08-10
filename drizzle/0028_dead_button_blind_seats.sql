ALTER TABLE "huffle-shuffle_game" ADD COLUMN "smallBlindSeatId" varchar(255);
ALTER TABLE "huffle-shuffle_game" ADD COLUMN "bigBlindSeatId" varchar(255);
--> statement-breakpoint
ALTER TABLE "huffle-shuffle_game" ADD CONSTRAINT "huffle-shuffle_game_smallBlindSeatId_huffle-shuffle_seat_id_fk" FOREIGN KEY ("smallBlindSeatId") REFERENCES "public"."huffle-shuffle_seat"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "huffle-shuffle_game" ADD CONSTRAINT "huffle-shuffle_game_bigBlindSeatId_huffle-shuffle_seat_id_fk" FOREIGN KEY ("bigBlindSeatId") REFERENCES "public"."huffle-shuffle_seat"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "huffle-shuffle_game" DROP COLUMN IF EXISTS "skipSmallBlind";
