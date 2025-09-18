CREATE TYPE "public"."game_state" AS ENUM('DEAL_HOLE_CARDS', 'BETTING', 'DEAL_FLOP', 'DEAL_TURN', 'DEAL_RIVER', 'SHOWDOWN', 'RESET_TABLE');--> statement-breakpoint
CREATE TYPE "public"."pi_device_type" AS ENUM('scanner', 'dealer', 'card', 'button');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('player', 'dealer');--> statement-breakpoint
CREATE TABLE "huffle-shuffle_account" (
	"userId" varchar(255) NOT NULL,
	"type" varchar(255) NOT NULL,
	"provider" varchar(255) NOT NULL,
	"providerAccountId" varchar(255) NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" varchar(255),
	"scope" varchar(255),
	"id_token" text,
	"session_state" varchar(255),
	CONSTRAINT "huffle-shuffle_account_provider_providerAccountId_pk" PRIMARY KEY("provider","providerAccountId")
);
--> statement-breakpoint
CREATE TABLE "huffle-shuffle_game" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"tableId" varchar(255) NOT NULL,
	"isCompleted" boolean DEFAULT false NOT NULL,
	"state" "game_state" DEFAULT 'DEAL_HOLE_CARDS' NOT NULL,
	"dealerButtonSeatId" varchar(255),
	"assignedSeatId" varchar(255),
	"communityCards" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"potTotal" integer DEFAULT 0 NOT NULL,
	"betCount" integer DEFAULT 0 NOT NULL,
	"requiredBetCount" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "huffle-shuffle_pi_device" (
	"serial" varchar(128) PRIMARY KEY NOT NULL,
	"tableId" varchar(255) NOT NULL,
	"type" "pi_device_type" NOT NULL,
	"seatNumber" integer,
	"publicKey" text,
	"lastSeenAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "huffle-shuffle_poker_table" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"dealerId" varchar(255) NOT NULL,
	"smallBlind" integer NOT NULL,
	"bigBlind" integer NOT NULL,
	"maxSeats" integer DEFAULT 8 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "huffle-shuffle_seat" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"tableId" varchar(255) NOT NULL,
	"playerId" varchar(255) NOT NULL,
	"seatNumber" integer NOT NULL,
	"buyIn" integer DEFAULT 0 NOT NULL,
	"currentBet" integer DEFAULT 0 NOT NULL,
	"cards" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"encryptedUserNonce" text,
	"encryptedPiNonce" text,
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "huffle-shuffle_session" (
	"sessionToken" varchar(255) PRIMARY KEY NOT NULL,
	"userId" varchar(255) NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "huffle-shuffle_user" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255),
	"email" varchar(255) NOT NULL,
	"emailVerified" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"image" varchar(255),
	"role" "user_role" DEFAULT 'player' NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"publicKey" text,
	CONSTRAINT "user_balance_non_negative" CHECK ("huffle-shuffle_user"."balance" >= 0)
);
--> statement-breakpoint
CREATE TABLE "huffle-shuffle_verification_token" (
	"identifier" varchar(255) NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "huffle-shuffle_verification_token_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "huffle-shuffle_account" ADD CONSTRAINT "huffle-shuffle_account_userId_huffle-shuffle_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."huffle-shuffle_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "huffle-shuffle_game" ADD CONSTRAINT "huffle-shuffle_game_tableId_huffle-shuffle_poker_table_id_fk" FOREIGN KEY ("tableId") REFERENCES "public"."huffle-shuffle_poker_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "huffle-shuffle_game" ADD CONSTRAINT "huffle-shuffle_game_dealerButtonSeatId_huffle-shuffle_seat_id_fk" FOREIGN KEY ("dealerButtonSeatId") REFERENCES "public"."huffle-shuffle_seat"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "huffle-shuffle_game" ADD CONSTRAINT "huffle-shuffle_game_assignedSeatId_huffle-shuffle_seat_id_fk" FOREIGN KEY ("assignedSeatId") REFERENCES "public"."huffle-shuffle_seat"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "huffle-shuffle_pi_device" ADD CONSTRAINT "huffle-shuffle_pi_device_tableId_huffle-shuffle_poker_table_id_fk" FOREIGN KEY ("tableId") REFERENCES "public"."huffle-shuffle_poker_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "huffle-shuffle_poker_table" ADD CONSTRAINT "huffle-shuffle_poker_table_dealerId_huffle-shuffle_user_id_fk" FOREIGN KEY ("dealerId") REFERENCES "public"."huffle-shuffle_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "huffle-shuffle_seat" ADD CONSTRAINT "huffle-shuffle_seat_tableId_huffle-shuffle_poker_table_id_fk" FOREIGN KEY ("tableId") REFERENCES "public"."huffle-shuffle_poker_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "huffle-shuffle_seat" ADD CONSTRAINT "huffle-shuffle_seat_playerId_huffle-shuffle_user_id_fk" FOREIGN KEY ("playerId") REFERENCES "public"."huffle-shuffle_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "huffle-shuffle_session" ADD CONSTRAINT "huffle-shuffle_session_userId_huffle-shuffle_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."huffle-shuffle_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "huffle-shuffle_account" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "game_table_id_idx" ON "huffle-shuffle_game" USING btree ("tableId");--> statement-breakpoint
CREATE INDEX "game_dealer_button_seat_id_idx" ON "huffle-shuffle_game" USING btree ("dealerButtonSeatId");--> statement-breakpoint
CREATE INDEX "game_assigned_seat_id_idx" ON "huffle-shuffle_game" USING btree ("assignedSeatId");--> statement-breakpoint
CREATE INDEX "pi_device_table_id_idx" ON "huffle-shuffle_pi_device" USING btree ("tableId");--> statement-breakpoint
CREATE UNIQUE INDEX "poker_table_dealer_id_unique" ON "huffle-shuffle_poker_table" USING btree ("dealerId");--> statement-breakpoint
CREATE INDEX "poker_table_name_idx" ON "huffle-shuffle_poker_table" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "seat_table_number_unique" ON "huffle-shuffle_seat" USING btree ("tableId","seatNumber");--> statement-breakpoint
CREATE UNIQUE INDEX "seat_player_unique" ON "huffle-shuffle_seat" USING btree ("playerId");--> statement-breakpoint
CREATE INDEX "seat_table_id_idx" ON "huffle-shuffle_seat" USING btree ("tableId");--> statement-breakpoint
CREATE INDEX "t_user_id_idx" ON "huffle-shuffle_session" USING btree ("userId");