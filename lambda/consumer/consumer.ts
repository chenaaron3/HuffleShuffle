// Load environment variables from .env file
import { config } from 'dotenv';
import { and, eq, sql } from 'drizzle-orm';
import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { DeleteMessageCommand, SQSClient } from '@aws-sdk/client-sqs';

import { dealCard, notifyTableUpdate } from './link/game-logic';
import * as schema from './link/schema';

import type {
  SQSEvent,
  SQSRecord,
  Context,
  SQSBatchResponse,
} from "aws-lambda";

config();
let db: PostgresJsDatabase<typeof schema> & {
  $client: postgres.Sql<{}>;
};
// Initialize database connection outside handler for connection reuse
let sqs: SQSClient;

function getDb() {
  if (!db) {
    db = drizzle(postgres(process.env.DATABASE_URL ?? ""), { schema });
  }
  return db;
}

function getSqs() {
  if (!sqs) {
    const region = process.env.AWS_REGION || "us-east-1";
    sqs = new SQSClient({ region });
  }
  return sqs;
}

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
  const database = getDb();

  const device = await database.query.piDevices.findFirst({
    where: eq(schema.piDevices.serial, serial),
  });
  if (!device) throw new Error("Device not registered");
  if (device.type !== "scanner") throw new Error("Invalid device type");

  await database
    .update(schema.piDevices)
    .set({ lastSeenAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(schema.piDevices.serial, serial));

  const { rank, suit } = parseBarcodeToRankSuit(barcode);
  const code = `${rank}${suit}`;

  await database.transaction(async (tx) => {
    const tableId = device.tableId;
    if (!tableId) throw new Error("Device not assigned to a table");

    const game = await tx.query.games.findFirst({
      where: eq(schema.games.tableId, tableId),
      orderBy: (games, { desc }) => [desc(games.createdAt)],
    });
    if (!game || game.isCompleted) throw new Error("No active game");

    // Use shared game logic instead of duplicating code
    await dealCard(tx, tableId, game, code);
    await notifyTableUpdate(tableId);
  });
}

async function processRecord(
  record: SQSRecord,
): Promise<{ success: boolean; messageId: string; error?: string }> {
  try {
    const body = JSON.parse(record.body) as ScanMessage;
    console.log(
      `[lambda] processing scan: ${body.barcode} from message ${record.messageId}`,
    );

    await handleScan(body);

    // Delete message after successful processing
    const sqsClient = getSqs();
    await sqsClient.send(
      new DeleteMessageCommand({
        QueueUrl: process.env.SQS_QUEUE_URL!,
        ReceiptHandle: record.receiptHandle,
      }),
    );

    console.log(`[lambda] processed and deleted scan: ${body.barcode}`);
    return { success: true, messageId: record.messageId };
  } catch (error) {
    console.error(
      `[lambda] error processing message ${record.messageId}:`,
      error,
    );
    // Silenty fail so we don't clog up the queue
    const sqsClient = getSqs();
    await sqsClient.send(
      new DeleteMessageCommand({
        QueueUrl: process.env.SQS_QUEUE_URL!,
        ReceiptHandle: record.receiptHandle,
      }),
    );
  }
}

// Lambda handler for SQS Event Source
export const handler = async (
  event: SQSEvent,
  context: Context,
): Promise<SQSBatchResponse> => {
  console.log(`[lambda] received ${event.Records.length} messages`);

  // Process records sequentially to maintain FIFO ordering (critical for poker)
  const results = [];
  for (const record of event.Records) {
    try {
      const result = await processRecord(record);
      results.push({ success: true, messageId: record.messageId, result });
    } catch (error) {
      console.error(
        `[lambda] failed to process message ${record.messageId}:`,
        error,
      );
      results.push({
        success: false,
        messageId: record.messageId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const batchItemFailures: { itemIdentifier: string }[] = [];
  results.forEach((result) => {
    if (!result.success) {
      batchItemFailures.push({ itemIdentifier: result.messageId });
    }
  });

  console.log(
    `[lambda] processed ${event.Records.length} messages, ${batchItemFailures.length} failures`,
  );

  return {
    batchItemFailures,
  };
};
