CREATE TABLE "huffle-shuffle_tournament" (
	"id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tableId" varchar(255) NOT NULL,
	"startedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"endedAt" timestamp with time zone,
	"winnerPlayerId" varchar(255),
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "huffle-shuffle_tournament" ADD CONSTRAINT "huffle-shuffle_tournament_tableId_huffle-shuffle_poker_table_id_fk" FOREIGN KEY ("tableId") REFERENCES "public"."huffle-shuffle_poker_table"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "huffle-shuffle_tournament" ADD CONSTRAINT "huffle-shuffle_tournament_winnerPlayerId_huffle-shuffle_user_id_fk" FOREIGN KEY ("winnerPlayerId") REFERENCES "public"."huffle-shuffle_user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "tournament_table_id_idx" ON "huffle-shuffle_tournament" USING btree ("tableId");
--> statement-breakpoint
CREATE INDEX "tournament_table_ended_idx" ON "huffle-shuffle_tournament" USING btree ("tableId","endedAt");
--> statement-breakpoint
ALTER TABLE "huffle-shuffle_game" ADD COLUMN "tournamentId" varchar(255);
--> statement-breakpoint
ALTER TABLE "huffle-shuffle_game" ADD CONSTRAINT "huffle-shuffle_game_tournamentId_huffle-shuffle_tournament_id_fk" FOREIGN KEY ("tournamentId") REFERENCES "public"."huffle-shuffle_tournament"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "game_tournament_id_idx" ON "huffle-shuffle_game" USING btree ("tournamentId");
