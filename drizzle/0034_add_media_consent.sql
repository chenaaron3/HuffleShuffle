ALTER TABLE "huffle-shuffle_user" ADD COLUMN "mediaConsent" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "huffle-shuffle_user" ADD COLUMN "mediaConsentUpdatedAt" timestamp with time zone;
