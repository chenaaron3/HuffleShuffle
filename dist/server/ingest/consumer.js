"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
// Load environment variables from .env file
const dotenv_1 = require("dotenv");
const drizzle_orm_1 = require("drizzle-orm");
const postgres_js_1 = require("drizzle-orm/postgres-js");
const postgres_1 = __importDefault(require("postgres"));
const schema = __importStar(require("~/server/db/schema"));
const client_sqs_1 = require("@aws-sdk/client-sqs");
const game_logic_1 = require("../api/game-logic");
(0, dotenv_1.config)();
// Initialize database connection outside handler for connection reuse
let db;
let sqs;
function getDb() {
    if (!db) {
        db = (0, postgres_js_1.drizzle)((0, postgres_1.default)(process.env.DATABASE_URL ?? ""), { schema });
    }
    return db;
}
function getSqs() {
    if (!sqs) {
        const region = process.env.AWS_REGION || "us-east-1";
        sqs = new client_sqs_1.SQSClient({ region });
    }
    return sqs;
}
function parseBarcodeToRankSuit(barcode) {
    const suitCode = barcode.slice(0, 1);
    const rankCode = barcode.slice(1);
    const suitMap = {
        "1": "s",
        "2": "h",
        "3": "c",
        "4": "d",
    };
    const rankMap = {
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
    if (!suit || !rank)
        throw new Error("Invalid barcode");
    return { rank, suit };
}
async function handleScan(msg) {
    const { serial, barcode, ts } = msg;
    const database = getDb();
    const device = await database.query.piDevices.findFirst({
        where: (0, drizzle_orm_1.eq)(schema.piDevices.serial, serial),
    });
    if (!device)
        throw new Error("Device not registered");
    if (device.type !== "scanner")
        throw new Error("Invalid device type");
    await database
        .update(schema.piDevices)
        .set({ lastSeenAt: (0, drizzle_orm_1.sql) `CURRENT_TIMESTAMP` })
        .where((0, drizzle_orm_1.eq)(schema.piDevices.serial, serial));
    const { rank, suit } = parseBarcodeToRankSuit(barcode);
    const code = `${rank}${suit}`;
    await database.transaction(async (tx) => {
        const tableId = device.tableId;
        const game = await tx.query.games.findFirst({
            where: (0, drizzle_orm_1.eq)(schema.games.tableId, tableId),
            orderBy: (g, { desc }) => [desc(g.createdAt)],
        });
        if (!game)
            throw new Error("No active game");
        // Use shared game logic instead of duplicating code
        await (0, game_logic_1.dealCard)(tx, tableId, game, code);
    });
}
async function processRecord(record) {
    try {
        const body = JSON.parse(record.body);
        console.log(`[lambda] processing scan: ${body.barcode} from message ${record.messageId}`);
        await handleScan(body);
        // Delete message after successful processing
        const sqsClient = getSqs();
        await sqsClient.send(new client_sqs_1.DeleteMessageCommand({
            QueueUrl: process.env.SQS_QUEUE_URL,
            ReceiptHandle: record.receiptHandle,
        }));
        console.log(`[lambda] processed and deleted scan: ${body.barcode}`);
        return { success: true, messageId: record.messageId };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error(`[lambda] error processing message ${record.messageId}:`, error);
        return {
            success: false,
            messageId: record.messageId,
            error: errorMessage,
        };
    }
}
// Lambda handler for SQS Event Source
const handler = async (event, context) => {
    console.log(`[lambda] received ${event.Records.length} messages`);
    const results = await Promise.allSettled(event.Records.map((record) => processRecord(record)));
    const batchItemFailures = [];
    results.forEach((result, index) => {
        if (result.status === "fulfilled") {
            if (!result.value.success) {
                // Add to batch failures for retry
                const record = event.Records[index];
                if (record) {
                    batchItemFailures.push({ itemIdentifier: record.messageId });
                }
            }
        }
        else {
            // Promise was rejected, add to batch failures
            const record = event.Records[index];
            if (record) {
                batchItemFailures.push({ itemIdentifier: record.messageId });
            }
        }
    });
    console.log(`[lambda] processed ${event.Records.length} messages, ${batchItemFailures.length} failures`);
    return {
        batchItemFailures,
    };
};
exports.handler = handler;
// For local testing (optional)
if (process.env.NODE_ENV === "development") {
    console.log("[lambda] running in development mode");
    // You can add local testing logic here if needed
}
