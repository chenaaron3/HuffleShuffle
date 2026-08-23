CREATE TABLE "huffle-shuffle_scanner_telemetry" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"serial" varchar(128) NOT NULL,
	"tableId" varchar(255) NOT NULL,
	"event" varchar(32) NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurredAt" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "huffle-shuffle_scanner_telemetry" ADD CONSTRAINT "scanner_telemetry_serial_pi_device_fk" FOREIGN KEY ("serial") REFERENCES "public"."huffle-shuffle_pi_device"("serial") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "huffle-shuffle_scanner_telemetry" ADD CONSTRAINT "scanner_telemetry_table_poker_table_fk" FOREIGN KEY ("tableId") REFERENCES "public"."huffle-shuffle_poker_table"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "scanner_telemetry_serial_created_idx" ON "huffle-shuffle_scanner_telemetry" USING btree ("serial","createdAt");
--> statement-breakpoint
CREATE INDEX "scanner_telemetry_created_idx" ON "huffle-shuffle_scanner_telemetry" USING btree ("createdAt");
