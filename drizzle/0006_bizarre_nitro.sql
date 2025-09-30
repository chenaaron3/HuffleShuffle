ALTER TABLE "huffle-shuffle_game" DROP CONSTRAINT "huffle-shuffle_game_dealerButtonSeatId_huffle-shuffle_seat_id_fk";
--> statement-breakpoint
ALTER TABLE "huffle-shuffle_game" ADD CONSTRAINT "huffle-shuffle_game_dealerButtonSeatId_huffle-shuffle_seat_id_fk" FOREIGN KEY ("dealerButtonSeatId") REFERENCES "public"."huffle-shuffle_seat"("id") ON DELETE set null ON UPDATE no action;