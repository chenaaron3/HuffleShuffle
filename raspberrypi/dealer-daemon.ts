import { execSync, spawn } from 'node:child_process';
import { join } from 'node:path';
import room from '~/pages/api/pi/room';

import { getSerialNumber, loadEnv, resolveTable } from './daemon-util';

// Minimal .env loader for standalone usage on the Pi (no external deps)
loadEnv();

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
  ensureLivekitCLI();
  const serial = getSerialNumber();
  const { tableId } = await resolveTable(serial);

  // Use run_dealer.sh to handle GStreamer + LiveKit join
  const scriptPath = join(process.cwd(), "run_dealer.sh");
  const env = { ...process.env } as NodeJS.ProcessEnv;
  env.ROOM_NAME = tableId;

  console.log(`Starting dealer script ${scriptPath} for room=${tableId}`);
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
