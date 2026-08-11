ALTER TABLE "huffle-shuffle_user" DROP CONSTRAINT IF EXISTS "user_balance_non_negative";--> statement-breakpoint
ALTER TABLE "huffle-shuffle_user" DROP COLUMN IF EXISTS "balance";--> statement-breakpoint
CREATE TYPE "public"."ledger_account_kind" AS ENUM('ISSUANCE', 'USER_WALLET', 'TABLE_USER_ESCROW');--> statement-breakpoint
CREATE TYPE "public"."ledger_entry_side" AS ENUM('debit', 'credit');--> statement-breakpoint
CREATE TYPE "public"."ledger_transaction_type" AS ENUM('MINT', 'BURN', 'TRANSFER', 'SETTLE_HAND');--> statement-breakpoint
CREATE TABLE "huffle-shuffle_ledger_account" (
	"id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(255) NOT NULL,
	"kind" "ledger_account_kind" NOT NULL,
	"userId" varchar(255),
	"tableId" varchar(255),
	"balance" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp with time zone,
	CONSTRAINT "ledger_account_balance_non_negative" CHECK ("balance" >= 0)
);--> statement-breakpoint
CREATE TABLE "huffle-shuffle_ledger_transaction" (
	"id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "ledger_transaction_type" NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"idempotencyKey" varchar(255) NOT NULL,
	"gameId" varchar(255),
	"reason" varchar(64),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);--> statement-breakpoint
CREATE TABLE "huffle-shuffle_ledger_entry" (
	"id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transactionId" varchar(255) NOT NULL,
	"accountId" varchar(255) NOT NULL,
	"side" "ledger_entry_side" NOT NULL,
	"amount" integer NOT NULL,
	CONSTRAINT "ledger_entry_amount_positive" CHECK ("amount" > 0)
);--> statement-breakpoint
ALTER TABLE "huffle-shuffle_ledger_account" ADD CONSTRAINT "huffle-shuffle_ledger_account_userId_huffle-shuffle_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."huffle-shuffle_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "huffle-shuffle_ledger_account" ADD CONSTRAINT "huffle-shuffle_ledger_account_tableId_huffle-shuffle_poker_table_id_fk" FOREIGN KEY ("tableId") REFERENCES "public"."huffle-shuffle_poker_table"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "huffle-shuffle_ledger_transaction" ADD CONSTRAINT "huffle-shuffle_ledger_transaction_gameId_huffle-shuffle_game_id_fk" FOREIGN KEY ("gameId") REFERENCES "public"."huffle-shuffle_game"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "huffle-shuffle_ledger_entry" ADD CONSTRAINT "huffle-shuffle_ledger_entry_transactionId_huffle-shuffle_ledger_transaction_id_fk" FOREIGN KEY ("transactionId") REFERENCES "public"."huffle-shuffle_ledger_transaction"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "huffle-shuffle_ledger_entry" ADD CONSTRAINT "huffle-shuffle_ledger_entry_accountId_huffle-shuffle_ledger_account_id_fk" FOREIGN KEY ("accountId") REFERENCES "public"."huffle-shuffle_ledger_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_account_code_unique" ON "huffle-shuffle_ledger_account" USING btree ("code");--> statement-breakpoint
CREATE INDEX "ledger_account_user_id_idx" ON "huffle-shuffle_ledger_account" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "ledger_account_table_id_idx" ON "huffle-shuffle_ledger_account" USING btree ("tableId");--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_transaction_idempotency_unique" ON "huffle-shuffle_ledger_transaction" USING btree ("idempotencyKey");--> statement-breakpoint
CREATE INDEX "ledger_transaction_game_id_idx" ON "huffle-shuffle_ledger_transaction" USING btree ("gameId");--> statement-breakpoint
CREATE INDEX "ledger_entry_transaction_id_idx" ON "huffle-shuffle_ledger_entry" USING btree ("transactionId");--> statement-breakpoint
CREATE INDEX "ledger_entry_account_id_idx" ON "huffle-shuffle_ledger_entry" USING btree ("accountId");
