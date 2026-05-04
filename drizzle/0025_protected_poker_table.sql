CREATE TABLE "huffle-shuffle_protected_poker_table" (
	"tableId" varchar(255) PRIMARY KEY NOT NULL,
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "huffle-shuffle_protected_poker_table_tableId_huffle-shuffle_poker_table_id_fk" FOREIGN KEY ("tableId") REFERENCES "public"."huffle-shuffle_poker_table"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);
--> statement-breakpoint
