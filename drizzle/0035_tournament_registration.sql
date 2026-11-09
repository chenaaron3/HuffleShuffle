CREATE TABLE "huffle-shuffle_tournament_series" (
	"id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tableId" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"dayOfWeek" integer NOT NULL,
	"startTime" varchar(5) NOT NULL,
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp with time zone,
	CONSTRAINT "tournament_series_day_of_week_check" CHECK ("huffle-shuffle_tournament_series"."dayOfWeek" BETWEEN 0 AND 6)
);
--> statement-breakpoint
ALTER TABLE "huffle-shuffle_tournament_series" ADD CONSTRAINT "huffle-shuffle_tournament_series_tableId_huffle-shuffle_poker_table_id_fk" FOREIGN KEY ("tableId") REFERENCES "public"."huffle-shuffle_poker_table"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "tournament_series_table_id_idx" ON "huffle-shuffle_tournament_series" USING btree ("tableId");
--> statement-breakpoint
ALTER TABLE "huffle-shuffle_tournament" ALTER COLUMN "startedAt" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "huffle-shuffle_tournament" ALTER COLUMN "startedAt" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "huffle-shuffle_tournament" ADD COLUMN "seriesId" varchar(255);
--> statement-breakpoint
ALTER TABLE "huffle-shuffle_tournament" ADD COLUMN "name" varchar(255);
--> statement-breakpoint
ALTER TABLE "huffle-shuffle_tournament" ADD COLUMN "scheduledAt" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "huffle-shuffle_tournament" ADD COLUMN "cancelledAt" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "huffle-shuffle_tournament" ADD CONSTRAINT "huffle-shuffle_tournament_seriesId_huffle-shuffle_tournament_series_id_fk" FOREIGN KEY ("seriesId") REFERENCES "public"."huffle-shuffle_tournament_series"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "tournament_series_id_idx" ON "huffle-shuffle_tournament" USING btree ("seriesId");
--> statement-breakpoint
CREATE TABLE "huffle-shuffle_tournament_registration" (
	"id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournamentId" varchar(255) NOT NULL,
	"userId" varchar(255) NOT NULL,
	"queuedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "huffle-shuffle_tournament_registration" ADD CONSTRAINT "huffle-shuffle_tournament_registration_tournamentId_huffle-shuffle_tournament_id_fk" FOREIGN KEY ("tournamentId") REFERENCES "public"."huffle-shuffle_tournament"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "huffle-shuffle_tournament_registration" ADD CONSTRAINT "huffle-shuffle_tournament_registration_userId_huffle-shuffle_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."huffle-shuffle_user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "tournament_registration_unique_idx" ON "huffle-shuffle_tournament_registration" USING btree ("tournamentId","userId");
--> statement-breakpoint
CREATE INDEX "tournament_registration_order_idx" ON "huffle-shuffle_tournament_registration" USING btree ("tournamentId","queuedAt");
