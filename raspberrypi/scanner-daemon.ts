import { createHash, createVerify } from 'node:crypto';
import { closeSync, openSync, readFileSync, readSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
    API_BASE, ensurePiKeys, getSerialNumber, loadEnv, resolveTable, signMessage
} from './daemon-util';

// Minimal .env loader
loadEnv();

// Read from a HID device (SCANNER_DEVICE, defaults to /dev/hidraw0)
type ScanHandler = (code: string) => void;

function startHidReader(devicePath: string, onScan: ScanHandler): void {
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
  let fd: number | null = null;
  try {
    fd = openSync(devicePath, "r");
  } catch (e) {
    console.error(
      `[scanner-daemon] failed to open HID device ${devicePath}`,
      e,
    );
    return;
  }
  const buf = Buffer.alloc(8);
  let acc = "";
  const loop = () => {
    if (fd == null) return;
    try {
      const bytes = readSync(fd, buf, 0, buf.length, null);
      for (let i = 0; i < bytes; i++) {
        const b = buf[i]!;
        if (b === HID_BREAK_LINE_CODE) {
          const code = acc.trim();
          acc = "";
          if (code) onScan(code);
          continue;
        }
        const ch = HidToCharMap[b];
        if (ch) acc += ch;
      }
    } catch (e) {
      // Swallow EAGAIN/timeouts; HID readers may block
    } finally {
      setImmediate(loop);
    }
  };
  loop();
  process.on("exit", () => {
    try {
      if (fd != null) closeSync(fd);
    } catch {}
  });
}

export async function runScannerDaemon(): Promise<void> {
  const serial = getSerialNumber();
  const { publicPem, privatePemPath } = await ensurePiKeys(serial); // ensures key files exist
  const privatePem = readFileSync(privatePemPath, "utf8");
  const pubFingerprint = createHash("sha256")
    .update(publicPem.replace(/\s+/g, ""))
    .digest("hex")
    .slice(0, 16);
  console.log(`[scanner-daemon] publicKey fingerprint: ${pubFingerprint}`);

  // Resolve table (also verifies device registration and returns type)
  const info = await resolveTable(serial);
  if (info.type !== "scanner")
    throw new Error(`[scanner-daemon] wrong device type: ${info.type}`);
  console.log(`[scanner-daemon] started for table ${info.tableId}`);

  const API = API_BASE();
  console.log(`[scanner-daemon] API base: ${API}`);
  let lastDealtAt = 0;

  const handleScan = async (rawCode: string) => {
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
    const ts = Math.floor(Date.now() / 1000).toString();
    const canonical = `${serial}|${barcode}|${ts}`;
    const signature = signMessage(privatePem, canonical);
    // Local sanity check against our own public key
    try {
      const v = createVerify("RSA-SHA256");
      v.update(canonical);
      v.end();
      const ok = v.verify(publicPem, Buffer.from(signature, "base64"));
      if (!ok) {
        console.error("[scanner-daemon] local verify failed; check key files");
      } else {
        console.log("[scanner-daemon] local verify passed");
      }
    } catch {}
    const canonicalSha = createHash("sha256")
      .update(canonical)
      .digest("hex")
      .slice(0, 16);
    console.log("[scanner-daemon] sending scan request", canonical);
    console.log(
      `[scanner-daemon] canonicalSha=${canonicalSha} sigLen=${signature.length}`,
    );
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const started = Date.now();
      const resp = await fetch(`${API}/api/pi/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serial, barcode, ts, signature }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const ms = Date.now() - started;
      if (!resp.ok) {
        const text = await resp.text();
        console.error(`
[scanner-daemon] deal rejected (status=${resp.status}, ${ms}ms): ${text}`);
        try {
          process.stdout.write("\u0007");
        } catch {}
        return;
      }
      lastDealtAt = now;
      console.log(`[scanner-daemon] dealt ${barcode} (${ms}ms)`);
    } catch (e) {
      console.error("[scanner-daemon] request failed", e);
      try {
        process.stdout.write("\u0007");
      } catch {}
    }
  };

  const device = process.env.SCANNER_DEVICE || "/dev/hidraw0";
  console.log(`[scanner-daemon] reading from HID device ${device}`);
  startHidReader(device, (code) => {
    void handleScan(code);
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
