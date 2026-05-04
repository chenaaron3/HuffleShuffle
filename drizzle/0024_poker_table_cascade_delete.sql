ALTER TABLE "huffle-shuffle_seat" DROP CONSTRAINT IF EXISTS "huffle-shuffle_seat_tableId_huffle-shuffle_poker_table_id_fk";--> statement-breakpoint
ALTER TABLE "huffle-shuffle_seat" ADD CONSTRAINT "huffle-shuffle_seat_tableId_huffle-shuffle_poker_table_id_fk" FOREIGN KEY ("tableId") REFERENCES "public"."huffle-shuffle_poker_table"("id") ON DELETE CASCADE ON UPDATE NO ACTION;--> statement-breakpoint
ALTER TABLE "huffle-shuffle_game" DROP CONSTRAINT IF EXISTS "huffle-shuffle_game_tableId_huffle-shuffle_poker_table_id_fk";--> statement-breakpoint
ALTER TABLE "huffle-shuffle_game" ADD CONSTRAINT "huffle-shuffle_game_tableId_huffle-shuffle_poker_table_id_fk" FOREIGN KEY ("tableId") REFERENCES "public"."huffle-shuffle_poker_table"("id") ON DELETE CASCADE ON UPDATE NO ACTION;--> statement-breakpoint
ALTER TABLE "huffle-shuffle_pi_device" DROP CONSTRAINT IF EXISTS "huffle-shuffle_pi_device_tableId_huffle-shuffle_poker_table_id_fk";--> statement-breakpoint
ALTER TABLE "huffle-shuffle_pi_device" ADD CONSTRAINT "huffle-shuffle_pi_device_tableId_huffle-shuffle_poker_table_id_fk" FOREIGN KEY ("tableId") REFERENCES "public"."huffle-shuffle_poker_table"("id") ON DELETE CASCADE ON UPDATE NO ACTION;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'huffle-shuffle_game_event'
  ) THEN
    EXECUTE 'ALTER TABLE "huffle-shuffle_game_event" DROP CONSTRAINT IF EXISTS "huffle-shuffle_game_event_tableId_huffle-shuffle_poker_table_id_fk"';
    EXECUTE 'ALTER TABLE "huffle-shuffle_game_event" ADD CONSTRAINT "huffle-shuffle_game_event_tableId_huffle-shuffle_poker_table_id_fk" FOREIGN KEY ("tableId") REFERENCES "public"."huffle-shuffle_poker_table"("id") ON DELETE CASCADE ON UPDATE NO ACTION';
    EXECUTE 'ALTER TABLE "huffle-shuffle_game_event" DROP CONSTRAINT IF EXISTS "huffle-shuffle_game_event_gameId_huffle-shuffle_game_id_fk"';
    EXECUTE 'ALTER TABLE "huffle-shuffle_game_event" ADD CONSTRAINT "huffle-shuffle_game_event_gameId_huffle-shuffle_game_id_fk" FOREIGN KEY ("gameId") REFERENCES "public"."huffle-shuffle_game"("id") ON DELETE CASCADE ON UPDATE NO ACTION';
  END IF;
END $$;
