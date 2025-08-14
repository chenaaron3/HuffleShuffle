import { ChildProcess, spawn } from 'node:child_process';
import { webcrypto as crypto } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import Pusher from 'pusher-js/node';

import { getSerialNumber, loadEnv, resolveTable } from './daemon-util';

// Minimal .env loader
loadEnv();

async function ensurePiKeys(
  serial: string,
): Promise<{ publicPem: string; privatePemPath: string }> {
  const home = process.env.HOME || "/home/pi";
  const dir = join(home, ".huffle", "keys");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const privPath = join(dir, `${serial}.pk8.pem`);
  const pubPath = join(dir, `${serial}.spki.pem`);
  if (existsSync(pubPath) && existsSync(privPath)) {
    return {
      publicPem: readFileSync(pubPath, "utf8"),
      privatePemPath: privPath,
    };
  }
  // Generate with WebCrypto
  const kp = await crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"],
  );
  const spki = await crypto.subtle.exportKey("spki", kp.publicKey);
  const pkcs8 = await crypto.subtle.exportKey("pkcs8", kp.privateKey);
  const toPem = (label: string, der: ArrayBuffer) => {
    const b64 = Buffer.from(new Uint8Array(der)).toString("base64");
    const wrapped = b64.replace(/.{1,64}/g, "$&\n");
    return `-----BEGIN ${label}-----\n${wrapped}-----END ${label}-----\n`;
  };
  const pubPem = toPem("PUBLIC KEY", spki);
  const privPem = toPem("PRIVATE KEY", pkcs8);
  writeFileSync(pubPath, pubPem, "utf8");
  writeFileSync(privPath, privPem, "utf8");
  return { publicPem: pubPem, privatePemPath: privPath };
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

async function decryptBase64(priv: CryptoKey, b64: string): Promise<string> {
  const bin = Buffer.from(b64, "base64");
  const pt = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, priv, bin);
  return new TextDecoder().decode(pt);
}

async function main() {
  const serial = getSerialNumber();
  const { publicPem, privatePemPath } = await ensurePiKeys(serial);
  console.log(
    "[hand-daemon] Public key (SPKI) stored; add to admin UI if not set:",
  );
  console.log(join("/home/pi", ".huffle", "keys", `${serial}.spki.pem`));

  const priv = await importPkcs8Pem(privatePemPath);
  let current: ChildProcess | null = null;
  const startStream = async (encNonce: string) => {
    const roomName = await decryptBase64(priv, encNonce);
    console.log("[hand-daemon] Starting stream to hand room:", roomName);
    const script = join(process.cwd(), "run_hand.sh");
    const env = {
      ...process.env,
      ROOM_NAME: roomName!,
      IDENTITY: serial,
    } as NodeJS.ProcessEnv;
    if (current) {
      try {
        // kill entire process group so grandchildren (lk, libcamera-vid) die too
        try {
          const pid =
            current && typeof current.pid === "number"
              ? -current.pid
              : undefined;
          if (pid) process.kill(pid, "SIGINT");
        } catch {}
        setTimeout(() => {
          try {
            const pid =
              current && typeof current.pid === "number"
                ? -current.pid
                : undefined;
            if (pid) process.kill(pid, "SIGKILL");
          } catch {}
        }, 3000);
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
        // Kill entire process group to ensure all descendants terminate
        try {
          const pid =
            current && typeof current.pid === "number"
              ? -current.pid
              : undefined;
          if (pid) process.kill(pid, "SIGINT");
        } catch {}
        setTimeout(() => {
          try {
            const pid =
              current && typeof current.pid === "number"
                ? -current.pid
                : undefined;
            if (pid) process.kill(pid, "SIGKILL");
          } catch {}
        }, 3000);
        current = null;
      }
    } catch (e) {
      console.error("[hand-daemon] stop error", e);
    }
  });
  console.log("[hand-daemon] started");

  // Also perform a one-shot fetch in case event already existed
  try {
    const initial = await resolveTable(serial);
    if (initial?.encNonce) await startStream(initial.encNonce);
  } catch {}
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
