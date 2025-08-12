import { execSync, spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Minimal .env loader for standalone usage on the Pi (no external deps)
(function loadDotEnv() {
  try {
    const envPath = join(process.cwd(), ".env");
    if (!existsSync(envPath)) return;
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx <= 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch {}
})();

const API_BASE = process.env.API_BASE_URL ?? "http://localhost:3000";
const LIVEKIT_URL = process.env.LIVEKIT_URL; // e.g. wss://your.livekit.server
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;

function lastNonEmptyLine(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  return lines[lines.length - 1] ?? "";
}

function getSerialNumber(): string {
  // Preferred: Device Tree (null-terminated)
  try {
    const out = execSync(
      "bash -lc \"tr -d '\\0' </sys/firmware/devicetree/base/serial-number; echo\"",
      { stdio: ["ignore", "pipe", "ignore"] },
    ).toString();
    const line = lastNonEmptyLine(out);
    if (line) return line;
  } catch {}

  // Fallback: legacy Device Tree path
  try {
    const out = execSync(
      "bash -lc \"tr -d '\\0' </proc/device-tree/serial-number; echo\"",
      { stdio: ["ignore", "pipe", "ignore"] },
    ).toString();
    const line = lastNonEmptyLine(out);
    if (line) return line;
  } catch {}

  // Fallback: /proc/cpuinfo parsing
  try {
    const out = execSync(
      "bash -lc \"awk -F ': ' '/Serial/ {print $2}' /proc/cpuinfo | tail -n1\"",
      { stdio: ["ignore", "pipe", "ignore"] },
    ).toString();
    const line = lastNonEmptyLine(out);
    if (line) return line;
  } catch {}

  // Last resort: machine-id
  const fallback = execSync('bash -lc "cat /etc/machine-id || true"', {
    stdio: ["ignore", "pipe", "ignore"],
  }).toString();
  return lastNonEmptyLine(fallback);
}

async function resolveRoom(serial: string): Promise<string> {
  const url = `${API_BASE}/api/pi/room?serial=${encodeURIComponent(serial)}`;
  console.log("resolveRoom", url);
  const resp = await fetch(url);
  if (!resp.ok)
    throw new Error(
      `resolveRoom failed: ${resp.status} ${JSON.stringify(resp.body)}`,
    );
  const data = (await resp.json()) as { tableId: string };
  if (!data?.tableId)
    throw new Error("resolveRoom failed: invalid response body");
  return data.tableId;
}

function ensureLivekitCLI(): void {
  try {
    execSync('bash -lc "command -v lk"', { stdio: "ignore" });
  } catch {
    throw new Error(
      "LiveKit CLI (lk) not found. Install: curl -sSL https://get.livekit.io/cli | bash",
    );
  }
}

async function main() {
  if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    throw new Error("Missing LIVEKIT_API_KEY or LIVEKIT_API_SECRET");
  }
  ensureLivekitCLI();
  const serial = getSerialNumber();
  const room = await resolveRoom(serial);

  // Use run_dealer.sh to handle GStreamer + LiveKit join
  const scriptPath = join(process.cwd(), "run_dealer.sh");
  const env = { ...process.env } as NodeJS.ProcessEnv;
  env.ROOM_NAME = room;

  console.log(`Starting dealer script ${scriptPath} for room=${room}`);
  const child = spawn("bash", ["-lc", `${JSON.stringify(scriptPath)} | cat`], {
    stdio: "inherit",
    env,
  });
  await new Promise<void>((resolve) => child.on("exit", () => resolve()));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
