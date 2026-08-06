CREATE TABLE "huffle-shuffle_waitlist" (
	"id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(20),
	"instagram" varchar(255),
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "waitlist_email_idx" ON "huffle-shuffle_waitlist" USING btree ("email");
--> statement-breakpoint
CREATE UNIQUE INDEX "waitlist_phone_idx" ON "huffle-shuffle_waitlist" USING btree ("phone");
