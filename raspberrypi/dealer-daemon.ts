import { execSync, spawn } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import Pusher from 'pusher-js/node';

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

export async function runDealerDaemon(): Promise<void> {
  ensureLivekitCLI();
  const serial = getSerialNumber();
  const { tableId } = await resolveTable(serial);

  const runDealer = () => {
    const scriptPath = join(process.cwd(), "run_dealer.sh");
    const envVars = { ...process.env } as NodeJS.ProcessEnv;
    envVars.ROOM_NAME = tableId;
    console.log(`[dealer-daemon] starting dealer script for room=${tableId}`);
    const child = spawn(
      "bash",
      ["-lc", `${JSON.stringify(scriptPath)} | cat`],
      {
        stdio: "inherit",
        env: envVars,
      },
    );
    return child;
  };

  let current: ReturnType<typeof spawn> | null = null;

  const key = process.env.PUSHER_KEY;
  const cluster = process.env.PUSHER_CLUSTER;
  if (!key || !cluster) throw new Error("Missing PUSHER_KEY or PUSHER_CLUSTER");
  const pusher = new Pusher(key, { cluster, forceTLS: true });
  const channel = pusher.subscribe(`device-${serial}`);

  channel.bind("dealer-start-stream", () => {
    try {
      if (current) return; // already running
      current = runDealer();
      current.on("exit", () => {
        if (current && current.killed) return;
        current = null;
      });
    } catch (e) {
      console.error("[dealer-daemon] start error", e);
    }
  });

  channel.bind("dealer-stop-stream", () => {
    try {
      if (!current) return;
      console.log("[dealer-daemon] stopping dealer stream");
      try {
        const pgid =
          current && typeof current.pid === "number" ? -current.pid : undefined;
        if (pgid) process.kill(pgid, "SIGINT");
      } catch {}
      setTimeout(() => {
        try {
          const pgid =
            current && typeof current.pid === "number"
              ? -current.pid
              : undefined;
          if (pgid) process.kill(pgid, "SIGKILL");
        } catch {}
      }, 3000);
      current = null;
    } catch (e) {
      console.error("[dealer-daemon] stop error", e);
    }
  });

  console.log(
    "[dealer-daemon] listening for dealer-start-stream/dealer-stop-stream",
  );
}

// Run only when executed directly, not when imported
try {
  const isDirect =
    import.meta &&
    (import.meta as any).url === pathToFileURL(process.argv[1] || "").href;
  if (isDirect) {
    runDealerDaemon().catch((err) => {
      console.error(err);
      process.exit(1);
    });
  }
} catch {}
