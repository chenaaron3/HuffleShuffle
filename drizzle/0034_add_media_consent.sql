ALTER TABLE "huffle-shuffle_user" ADD COLUMN "recordingConsent" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "huffle-shuffle_user" ADD COLUMN "recordingConsentUpdatedAt" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "huffle-shuffle_user" ADD COLUMN "socialMediaConsent" boolean;
--> statement-breakpoint
ALTER TABLE "huffle-shuffle_user" ADD COLUMN "socialMediaConsentUpdatedAt" timestamp with time zone;
