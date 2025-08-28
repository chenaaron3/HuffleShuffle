// Load environment variables from .env file
import { config } from 'dotenv';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '~/server/db/schema';

import { DeleteMessageCommand, ReceiveMessageCommand, SQSClient } from '@aws-sdk/client-sqs';

import { dealCard } from '../api/game-logic';

config();

export const db = drizzle(postgres(process.env.DATABASE_URL ?? ""), { schema });

type ScanMessage = { serial: string; barcode: string; ts: number };

function parseBarcodeToRankSuit(barcode: string): {
  rank: string;
  suit: string;
} {
  const suitCode = barcode.slice(0, 1);
  const rankCode = barcode.slice(1);
  const suitMap: Record<string, string> = {
    "1": "s",
    "2": "h",
    "3": "c",
    "4": "d",
  };
  const rankMap: Record<string, string> = {
    "010": "A",
    "020": "2",
    "030": "3",
    "040": "4",
    "050": "5",
    "060": "6",
    "070": "7",
    "080": "8",
    "090": "9",
    "100": "T",
    "110": "J",
    "120": "Q",
    "130": "K",
  };
  const suit = suitMap[suitCode];
  const rank = rankMap[rankCode];
  if (!suit || !rank) throw new Error("Invalid barcode");
  return { rank, suit };
}

async function handleScan(msg: ScanMessage): Promise<void> {
  const { serial, barcode, ts } = msg;

  const device = await db.query.piDevices.findFirst({
    where: eq(schema.piDevices.serial, serial),
  });
  if (!device) throw new Error("Device not registered");
  if (device.type !== "scanner") throw new Error("Invalid device type");

  await db
    .update(schema.piDevices)
    .set({ lastSeenAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(schema.piDevices.serial, serial));

  const { rank, suit } = parseBarcodeToRankSuit(barcode);
  const code = `${rank}${suit}`;

  await db.transaction(async (tx) => {
    const tableId = device.tableId;
    const game = await tx.query.games.findFirst({
      where: eq(schema.games.tableId, tableId),
      orderBy: (g, { desc }) => [desc(g.createdAt)],
    });
    if (!game) throw new Error("No active game");

    // Use shared game logic instead of duplicating code
    await dealCard(tx, tableId, game, code);
  });
}

async function main() {
  // SQS configuration
  const region = process.env.AWS_REGION || "us-east-1";
  const queueUrl = process.env.SQS_QUEUE_URL;

  if (!queueUrl) {
    throw new Error("Missing SQS_QUEUE_URL environment variable");
  }

  console.log("[ingest] connecting to SQS FIFO queue:", queueUrl);

  const sqs = new SQSClient({ region });

  // Main processing loop
  while (true) {
    try {
      const response = await sqs.send(
        new ReceiveMessageCommand({
          QueueUrl: queueUrl,
          MaxNumberOfMessages: 10,
          WaitTimeSeconds: 20, // Long polling
          AttributeNames: ["All"],
        }),
      );

      if (response.Messages && response.Messages.length > 0) {
        console.log(`[ingest] received ${response.Messages.length} messages`);

        for (const message of response.Messages) {
          try {
            const body = JSON.parse(message.Body!) as ScanMessage;
            console.log(`[ingest] processing scan: ${body.barcode}`);

            await handleScan(body);

            // Delete message after successful processing
            await sqs.send(
              new DeleteMessageCommand({
                QueueUrl: queueUrl,
                ReceiptHandle: message.ReceiptHandle!,
              }),
            );

            console.log(`[ingest] processed and deleted scan: ${body.barcode}`);
          } catch (error) {
            console.error("[ingest] error processing message:", error);
            // Message stays in queue for retry (SQS handles this automatically)
            // You could also implement custom retry logic here if needed
          }
        }
      }
    } catch (error) {
      console.error("[ingest] error receiving messages:", error);
      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log("[ingest] shutting down gracefully...");
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("[ingest] shutting down gracefully...");
  process.exit(0);
});

main().catch((e) => {
  console.error("[ingest] fatal error:", e);
  process.exit(1);
});
