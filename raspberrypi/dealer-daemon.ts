import { execSync, spawn } from 'node:child_process';

const API_BASE = process.env.API_BASE_URL ?? "http://localhost:3000";
const LIVEKIT_URL = process.env.LIVEKIT_URL; // e.g. wss://your.livekit.server
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;

function getSerialNumber(): string {
  try {
    const out = execSync(
      "bash -lc \"cat /proc/cpuinfo | awk -F': ' '/Serial/ {print $2}' | tail -n1\"",
      { stdio: ["ignore", "pipe", "ignore"] },
    )
      .toString()
      .trim();
    if (out) return out;
  } catch {}
  const fallback = execSync('bash -lc "cat /etc/machine-id || true"', {
    stdio: ["ignore", "pipe", "ignore"],
  }).toString();
  return fallback.trim();
}

function resolveRoom(serial: string): string {
  const url = `${API_BASE}/api/pi/room?serial=${encodeURIComponent(serial)}`;
  const out = execSync(`bash -lc 'curl -fsSL ${JSON.stringify(url)}'`, {
    stdio: ["ignore", "pipe", "ignore"],
  }).toString();
  const data = JSON.parse(out) as { tableId: string };
  if (!data?.tableId) throw new Error("resolveRoom failed: invalid response");
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
  const room = resolveRoom(serial);

  const host = process.env.CAM_HOST ?? "127.0.0.1";
  const port = Number(process.env.CAM_PORT ?? "5000");

  // Start camera if not already streaming; using libcamera-vid TCP source
  const camera = spawn(
    "bash",
    [
      "-lc",
      `libcamera-vid -n --inline -t 0 --width 1280 --height 720 --framerate 30 --codec h264 --profile baseline --listen -o tcp://${host}:${port}`,
    ],
    { stdio: "ignore" },
  );

  // Wait a bit for camera to start
  await new Promise((r) => setTimeout(r, 2000));

  // Join and publish using lk CLI
  const args = [
    ...(LIVEKIT_URL ? ["--url", LIVEKIT_URL] : []),
    ...(LIVEKIT_API_KEY ? ["--api-key", LIVEKIT_API_KEY] : []),
    ...(LIVEKIT_API_SECRET ? ["--api-secret", LIVEKIT_API_SECRET] : []),
    "room",
    "join",
    "--identity",
    serial,
    "--publish",
    `h264://${host}:${port}`,
    room,
  ];
  const lk = spawn("lk", args, { stdio: "inherit" });
  await new Promise<void>((resolve) => lk.on("exit", () => resolve()));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
