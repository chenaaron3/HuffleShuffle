import console from 'node:console';
import { createReadStream } from 'node:fs';
import { pathToFileURL } from 'node:url';

import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';

import { ensurePiKeys, getSerialNumber, loadEnv, resolveTable } from './daemon-util';

// Minimal .env loader
loadEnv();

// Read from a HID device (SCANNER_DEVICE, defaults to /dev/hidraw0)
type ScanHandler = (code: string) => Promise<void>;

async function startHidReader(
  devicePath: string,
  onScan: ScanHandler,
): Promise<void> {
  const HID_BREAK_LINE_CODE = 0x28;
  const HidToCharMap: Record<number, string> = {
    0x4: "a",
    0x5: "b",
    0x6: "c",
    0x7: "d",
    0x8: "e",
    0x9: "f",
    0xa: "g",
    0xb: "h",
    0xc: "i",
    0xd: "j",
    0xe: "k",
    0xf: "l",
    0x10: "m",
    0x11: "n",
    0x12: "o",
    0x13: "p",
    0x14: "q",
    0x15: "r",
    0x16: "s",
    0x17: "t",
    0x18: "u",
    0x19: "v",
    0x1a: "w",
    0x1b: "x",
    0x1c: "y",
    0x1d: "z",
    0x1e: "1",
    0x1f: "2",
    0x20: "3",
    0x21: "4",
    0x22: "5",
    0x23: "6",
    0x24: "7",
    0x25: "8",
    0x26: "9",
    0x27: "0",
    0x2c: " ",
    0x2d: "-",
    0x2e: "=",
    0x2f: "[",
    0x30: "]",
    0x32: "\\",
    0x33: ";",
    0x34: '"',
    0x35: "~",
    0x36: ",",
    0x37: ".",
    0x38: "/",
  };

  let acc = "";
  let stream: ReturnType<typeof createReadStream> | null = null;

  const openStream = () => {
    try {
      stream = createReadStream(devicePath, { flags: "r", highWaterMark: 8 });
    } catch (e) {
      console.error(
        `[scanner-daemon] failed to open HID device ${devicePath}`,
        e,
      );
      setTimeout(openStream, 1000);
      return;
    }

    const s = stream;

    s.on("data", (chunk: Buffer | string) => {
      const buf =
        typeof chunk === "string" ? Buffer.from(chunk, "binary") : chunk;
      for (let i = 0; i < buf.length; i++) {
        const b = buf[i]!;
        if (b === HID_BREAK_LINE_CODE) {
          const code = acc.trim();
          acc = "";
          void onScan(code);
          continue;
        }
        const ch = HidToCharMap[b];
        if (ch) acc += ch;
      }
    });

    s.on("error", (e) => {
      console.error("[scanner-daemon] HID read error:", e);
      try {
        s.close();
      } catch {}
      if (stream === s) stream = null;
      setTimeout(openStream, 100);
    });

    s.on("close", () => {
      if (stream === s) stream = null;
      setTimeout(openStream, 100);
    });
  };

  openStream();

  process.on("exit", () => {
    try {
      if (stream) stream.close();
    } catch {}
  });
}

// Test mode: manually send fake card scans
function startTestMode(onScan: ScanHandler): void {
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
        const randomCard = cards[Math.floor(Math.random() * cards.length)];
        const barcode = cardMap[randomCard];
        console.log(
          `[scanner-daemon] sending random card: ${randomCard} (${barcode})`,
        );
        onScan(barcode);
      } else if (cardMap[command]) {
        const barcode = cardMap[command];
        console.log(`[scanner-daemon] sending card: ${command} (${barcode})`);
        onScan(barcode);
      } else if (command) {
        console.log(`[scanner-daemon] unknown command: ${command}`);
        console.log('[scanner-daemon] type a card name or "random" or "quit"');
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
  let lastDealtAt = 0;

  const handleScan = async (rawCode: string) => {
    console.log(`[scanner-daemon] received scan: ${rawCode}`);
    const now = Date.now();
    if (now - lastDealtAt < 500) return; // throttle 500ms

    // Basic sanitization; server will validate strictly
    const barcode = rawCode.trim();
    if (!/^[0-9]{4}$/.test(barcode)) {
      // Attempt to extract 4 consecutive digits if scanner includes prefix/suffix
      const m = barcode.match(/([0-9]{4})/);
      if (!m) return;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      void 0;
    }

    const ts = Math.floor(Date.now() / 1000);
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
    } catch (e) {
      console.error("[scanner-daemon] publish failed", e);
      try {
        process.stdout.write("\u0007");
      } catch {}
    }
  };

  // Check if test mode is enabled
  const isTestMode =
    process.argv.includes("--test") || process.argv.includes("-t");

  if (isTestMode) {
    startTestMode(async (code) => {
      await handleScan(code);
    });
  } else {
    const device = process.env.SCANNER_DEVICE || "/dev/hidraw0";
    console.log(`[scanner-daemon] reading from HID device ${device}`);

    startHidReader(device, async (code) => {
      console.log(`[scanner-daemon] HID received scan: ${code}`);
      await handleScan(code);
      console.log(`[scanner-daemon] HID processed scan: ${code}`);
    });
  }

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
