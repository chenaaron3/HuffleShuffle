DROP TABLE "huffle-shuffle_waitlist";
--> statement-breakpoint
CREATE TYPE "public"."contact_method" AS ENUM('phone', 'instagram', 'email');
--> statement-breakpoint
CREATE TABLE "huffle-shuffle_contact" (
	"userId" varchar(255) PRIMARY KEY NOT NULL,
	"phone" varchar(20),
	"instagram" varchar(255),
	"preferredContact" "contact_method" NOT NULL,
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "huffle-shuffle_contact" ADD CONSTRAINT "huffle-shuffle_contact_userId_huffle-shuffle_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."huffle-shuffle_user"("id") ON DELETE cascade ON UPDATE no action;
