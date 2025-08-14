import { ChildProcess, spawn } from 'node:child_process';
import { webcrypto as crypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import Pusher from 'pusher-js/node';

import { decryptBase64, ensurePiKeys, getSerialNumber, loadEnv, resolveTable } from './daemon-util';

// Minimal .env loader
loadEnv();

function getProcessGroupIdFromChild(
  child: ChildProcess | null,
): number | undefined {
  if (!child || typeof child.pid !== "number") return undefined;
  return -child.pid;
}

function terminateProcessGroup(pgid: number, graceMs = 3000): void {
  try {
    process.kill(pgid, "SIGINT");
  } catch {}
  setTimeout(() => {
    try {
      process.kill(pgid, "SIGKILL");
    } catch {}
  }, graceMs);
}

function importPkcs8Pem(privatePemPath: string): Promise<CryptoKey> {
  const pem = readFileSync(privatePemPath, "utf8");
  const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Buffer.from(b64, "base64");
  return crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["decrypt"],
  );
}

export async function runHandDaemon(): Promise<void> {
  const serial = getSerialNumber();
  const { publicPem, privatePemPath } = await ensurePiKeys(serial);
  console.log(
    "[hand-daemon] Public key (SPKI) stored; add to admin UI if not set:",
  );
  console.log(join("/home/pi", ".huffle", "keys", `${serial}.spki.pem`));

  const priv = await importPkcs8Pem(privatePemPath);
  let current: ChildProcess | null = null;
  const killCurrentGroup = () => {
    try {
      const pgid = getProcessGroupIdFromChild(current);
      if (!pgid) return;
      terminateProcessGroup(pgid);
    } catch {}
  };
  const startStream = async (encNonce: string) => {
    const roomName = await decryptBase64(priv, encNonce);
    console.log("[hand-daemon] Starting stream to hand room:", roomName);
    const script = join(process.cwd(), "run_hand.sh");
    const env = {
      ...process.env,
      ROOM_NAME: roomName!,
      IDENTITY: serial,
      PARENT_PID: String(process.pid),
    } as NodeJS.ProcessEnv;
    if (current) {
      try {
        const targetPgid = getProcessGroupIdFromChild(current);
        if (targetPgid) terminateProcessGroup(targetPgid);
      } catch {}
    }
    const child = spawn(script, { stdio: "inherit", env, detached: true });
    current = child;
    child.on("exit", (code) => {
      console.log("[hand-daemon] stream exited", code);
      if (current === child) current = null;
    });
  };

  // Subscribe to device channel via Pusher
  const key = process.env.PUSHER_KEY;
  const cluster = process.env.PUSHER_CLUSTER;
  if (!key || !cluster) throw new Error("Missing PUSHER_KEY or PUSHER_CLUSTER");
  const pusher = new Pusher(key, { cluster, forceTLS: true });
  const channel = pusher.subscribe(`device-${serial}`);
  channel.bind("start-stream", async (data: { encNonce?: string }) => {
    try {
      if (!data?.encNonce) return;
      await startStream(data.encNonce);
    } catch (e) {
      console.error("[hand-daemon] pusher event error", e);
    }
  });
  channel.bind("stop-stream", () => {
    try {
      if (current) {
        console.log("[hand-daemon] stopping stream");
        const targetPgid = getProcessGroupIdFromChild(current);
        if (targetPgid) terminateProcessGroup(targetPgid);
        current = null;
      }
    } catch (e) {
      console.error("[hand-daemon] stop error", e);
    }
  });
  console.log("[hand-daemon] started");

  // Ensure child group is killed if daemon exits
  process.on("SIGINT", () => {
    killCurrentGroup();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    killCurrentGroup();
    process.exit(0);
  });
  process.on("exit", killCurrentGroup);

  // Also perform a one-shot fetch in case event already existed
  try {
    const initial = await resolveTable(serial);
    if (initial?.encNonce) await startStream(initial.encNonce);
  } catch {}
}

// Run only when executed directly, not when imported
try {
  const isDirect =
    import.meta &&
    (import.meta as any).url === pathToFileURL(process.argv[1] || "").href;
  if (isDirect) {
    runHandDaemon().catch((e) => {
      console.error(e);
      process.exit(1);
    });
  }
} catch {}
