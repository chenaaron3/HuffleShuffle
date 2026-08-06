CREATE TABLE "huffle-shuffle_waitlist" (
	"id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "waitlist_email_idx" ON "huffle-shuffle_waitlist" USING btree ("email");
