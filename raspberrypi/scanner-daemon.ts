import console from "node:console";
import { pathToFileURL } from "node:url";

import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";

import {
  API_BASE,
  getSerialNumber,
  loadEnv,
  requireEnv,
  resolveTable,
} from "./daemon-util";
import { startScannerHidReader } from "./scanner-hid-reader";
import { ScannerTelemetryLogger } from "./scanner-telemetry";

// Minimal .env loader
loadEnv();

/** Same rules as `parseBarcodeToRankSuit` in helpers/cards (Pi stays standalone). */
export function isValidCardBarcode(digits: string): boolean {
  if (!/^[0-9]{4}$/.test(digits)) return false;
  const suitCode = digits[0]!;
  const rankCode = digits.slice(1);
  if (!["1", "2", "3", "4"].includes(suitCode)) return false;
  return [
    "010",
    "020",
    "030",
    "040",
    "050",
    "060",
    "070",
    "080",
    "090",
    "100",
    "110",
    "120",
    "130",
  ].includes(rankCode);
}

// Test mode: manually send fake card scans
function startTestMode(onScan: (code: string) => Promise<void>): void {
  console.log("[scanner-daemon] TEST MODE ENABLED");
  console.log("[scanner-daemon] Available commands:");
  console.log("  ace-spades, ace-hearts, ace-clubs, ace-diamonds");
  console.log("  king-spades, king-hearts, king-clubs, king-diamonds");
  console.log("  queen-spades, queen-hearts, queen-clubs, queen-diamonds");
  console.log("  jack-spades, jack-hearts, jack-clubs, jack-diamonds");
  console.log("  10-spades, 10-hearts, 10-clubs, 10-diamonds");
  console.log("  9-spades, 9-hearts, 9-clubs, 9-diamonds");
  console.log("  8-spades, 8-hearts, 8-clubs, 8-diamonds");
  console.log("  7-spades, 7-hearts, 7-clubs, 7-diamonds");
  console.log("  6-spades, 6-hearts, 6-clubs, 6-diamonds");
  console.log("  5-spades, 5-hearts, 5-clubs, 5-diamonds");
  console.log("  4-spades, 4-hearts, 4-clubs, 4-diamonds");
  console.log("  3-spades, 3-hearts, 3-clubs, 3-diamonds");
  console.log("  2-spades, 2-hearts, 2-clubs, 2-diamonds");
  console.log("  random - sends a random card");
  console.log("  quit - exits the program");
  console.log("");

  // Card mapping for test mode
  const cardMap: Record<string, string> = {
    "ace-spades": "1010",
    "ace-hearts": "2010",
    "ace-clubs": "3010",
    "ace-diamonds": "4010",
    "king-spades": "1130",
    "king-hearts": "2130",
    "king-clubs": "3130",
    "king-diamonds": "4130",
    "queen-spades": "1120",
    "queen-hearts": "2120",
    "queen-clubs": "3120",
    "queen-diamonds": "4120",
    "jack-spades": "1110",
    "jack-hearts": "2110",
    "jack-clubs": "3110",
    "jack-diamonds": "4110",
    "10-spades": "1100",
    "10-hearts": "2100",
    "10-clubs": "3100",
    "10-diamonds": "4100",
    "9-spades": "1090",
    "9-hearts": "2090",
    "9-clubs": "3090",
    "9-diamonds": "4090",
    "8-spades": "1080",
    "8-hearts": "2080",
    "8-clubs": "3080",
    "8-diamonds": "4080",
    "7-spades": "1070",
    "7-hearts": "2070",
    "7-clubs": "3070",
    "7-diamonds": "4070",
    "6-spades": "1060",
    "6-hearts": "2060",
    "6-clubs": "3060",
    "6-diamonds": "4060",
    "5-spades": "1050",
    "5-hearts": "2050",
    "5-clubs": "3050",
    "5-diamonds": "4050",
    "4-spades": "1040",
    "4-hearts": "2040",
    "4-clubs": "3040",
    "4-diamonds": "4040",
    "3-spades": "1030",
    "3-hearts": "2030",
    "3-clubs": "3030",
    "3-diamonds": "4030",
    "2-spades": "1020",
    "2-hearts": "2020",
    "2-clubs": "3020",
    "2-diamonds": "4020",
  };

  const cards = Object.keys(cardMap);

  // Set up stdin for test mode
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");

  let input = "";

  process.stdin.on("data", (key) => {
    const keyStr = key.toString();
    if (keyStr === "\u0003") {
      // Ctrl+C
      console.log("\n[scanner-daemon] exiting...");
      process.exit(0);
    } else if (keyStr === "\r" || keyStr === "\n") {
      // Enter key
      const command = input.trim().toLowerCase();
      input = "";

      if (command === "quit") {
        console.log("[scanner-daemon] exiting...");
        process.exit(0);
      } else if (command === "random") {
        const randomCard = cards[Math.floor(Math.random() * cards.length)]!;
        const barcode = cardMap[randomCard]!;
        console.log(
          `[scanner-daemon] sending random card: ${randomCard} (${barcode})`,
        );
        onScan(barcode);
      } else {
        const barcode = cardMap[command];
        if (barcode) {
          console.log(`[scanner-daemon] sending card: ${command} (${barcode})`);
          onScan(barcode);
        } else if (command) {
          console.log(`[scanner-daemon] unknown command: ${command}`);
          console.log(
            '[scanner-daemon] type a card name or "random" or "quit"',
          );
        }
      }

      process.stdout.write("\n> ");
    } else if (keyStr === "\u007f") {
      // Backspace
      if (input.length > 0) {
        input = input.slice(0, -1);
        process.stdout.write("\b \b");
      }
    } else {
      // Regular character
      input += keyStr;
      process.stdout.write(keyStr);
    }
  });

  process.stdout.write("> ");
}

export async function runScannerDaemon(): Promise<void> {
  requireEnv(["API_BASE_URL", "SQS_QUEUE_URL"], "scanner-daemon");
  const serial = getSerialNumber() || "10000000672a9ed2";
  // Resolve table (also verifies device registration and returns type)
  const info = await resolveTable(serial);
  if (info.type !== "scanner")
    throw new Error(`[scanner-daemon] wrong device type: ${info.type}`);
  console.log(`[scanner-daemon] started for table ${info.tableId}`);

  // SQS configuration
  const region = process.env.AWS_REGION || "us-east-1";
  const queueUrl = process.env.SQS_QUEUE_URL;

  if (!queueUrl) {
    console.error("[scanner-daemon] Missing SQS_QUEUE_URL");
    process.exit(1);
  }

  console.log("[scanner-daemon] using SQS FIFO queue");

  const sqs = new SQSClient({ region });
  const telemetry = new ScannerTelemetryLogger({
    apiBaseUrl: API_BASE(),
    serial,
  });

  let lastDealtAt = 0;

  const handleScan = async (rawCode: string, devicePath: string) => {
    const barcode = rawCode.trim();
    console.log(
      `[scanner-daemon] received scan from ${devicePath}: ${barcode}`,
    );
    // Strict: exactly one valid four-digit card code from the scanner line — no salvage/extraction.
    if (!isValidCardBarcode(barcode)) {
      console.warn(
        `[scanner-daemon] drop scan (need exact valid 4-digit card code): raw=${rawCode.slice(0, 64)}`,
      );
      telemetry.event("scan_rejected", {
        devicePath,
        raw: rawCode.slice(0, 64),
      });
      return;
    }

    const now = Date.now();
    if (now - lastDealtAt < 500) return; // throttle 500ms

    const ts = Date.now();
    try {
      const started = Date.now();
      console.log(`[scanner-daemon] publishing scan: ${barcode}`);

      // Send message to SQS FIFO queue
      sqs.send(
        new SendMessageCommand({
          QueueUrl: queueUrl,
          MessageBody: JSON.stringify({
            serial,
            barcode,
            ts,
          }),
          MessageGroupId: info.tableId, // Ensures FIFO ordering per table
          MessageDeduplicationId: `${info.tableId}-${barcode}-${ts}`, // Prevents duplicates
        }),
        () => {
          lastDealtAt = now;
          console.log(
            `[scanner-daemon] published ${barcode} to SQS (${Date.now() - started}ms)`,
          );
        },
      );
    } catch (error) {
      console.error("[scanner-daemon] publish failed", error);
      telemetry.error("sqs_error", error, { barcode, devicePath });
      try {
        process.stdout.write("\u0007");
      } catch {}
    }
  };

  let scanChain = Promise.resolve();
  const enqueueScan = (code: string, devicePath: string) => {
    scanChain = scanChain
      .then(() => handleScan(code, devicePath))
      .catch((error) => {
        console.error("[scanner-daemon] scan pipeline failed", error);
      });
    return scanChain;
  };

  telemetry.event("daemon_started", { tableId: info.tableId, region });
  telemetry.startHeartbeat({ tableId: info.tableId });

  // Check if test mode is enabled
  const isTestMode =
    process.argv.includes("--test") || process.argv.includes("-t");

  let stopHidReader: (() => void) | undefined;
  if (isTestMode) {
    startTestMode(async (code) => {
      await enqueueScan(code, "test");
    });
  } else {
    const device = process.env.SCANNER_DEVICE || "/dev/hidraw0";
    console.log(
      `[scanner-daemon] discovering HID devices (preferred ${device})`,
    );

    stopHidReader = startScannerHidReader({
      preferredPath: device,
      isValidScan: isValidCardBarcode,
      onScan: async (code, devicePath) => {
        console.log(`[scanner-daemon] HID received scan: ${code}`);
        await enqueueScan(code, devicePath);
        console.log(`[scanner-daemon] HID processed scan: ${code}`);
      },
      onStatus: (event, details) => {
        telemetry.event(event, details);
      },
    });
  }

  process.on("exit", () => {
    telemetry.close();
    stopHidReader?.();
  });

  // Keep process alive
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  await new Promise<void>(() => {});
}

// Run only when executed directly, not when imported
try {
  const isDirect =
    import.meta &&
    (import.meta as any).url === pathToFileURL(process.argv[1] || "").href;
  if (isDirect) {
    runScannerDaemon().catch((e) => {
      console.error(e);
      process.exit(1);
    });
  }
} catch {}
