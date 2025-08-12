import { execSync, spawn } from 'node:child_process';
import { join } from 'node:path';

import { getSerialNumber, loadEnv, resolveTableId } from './daemon-util';

// Minimal .env loader for standalone usage on the Pi (no external deps)
loadEnv();

const API_BASE = process.env.API_BASE_URL ?? "http://localhost:3000";
const LIVEKIT_URL = process.env.LIVEKIT_URL; // e.g. wss://your.livekit.server
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;

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
  const room = await resolveTableId(serial);

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
