import { spawn } from 'node:child_process';
import { webcrypto as crypto } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { getSerialNumber, loadEnv } from './daemon-util';

// Minimal .env loader
loadEnv();

const API_BASE = process.env.API_BASE_URL ?? "http://localhost:3000";

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
  console.log(
    join(
      process.env.HOME || "/home/pi",
      ".huffle",
      "keys",
      `${serial}.spki.pem`,
    ),
  );

  const priv = await importPkcs8Pem(privatePemPath);
  const resp = await fetch(
    `${API_BASE}/api/pi/room?serial=${encodeURIComponent(serial)}`,
  );
  if (!resp.ok) throw new Error(`room fetch failed: ${resp.status}`);
  const data = (await resp.json()) as {
    tableId?: string;
    encNonce?: string | null;
  };
  if (!data?.encNonce) throw new Error("No encNonce available for this device");
  const roomName = await decryptBase64(priv, data.encNonce);

  console.log("[hand-daemon] Starting stream to hand room:", roomName);
  const script = join(process.cwd(), "run_hand.sh");
  const env = {
    ...process.env,
    ROOM_NAME: roomName!,
    IDENTITY: serial,
  } as NodeJS.ProcessEnv;
  const child = spawn("bash", ["-lc", `${JSON.stringify(script)} | cat`], {
    stdio: "inherit",
    env,
  });
  await new Promise<void>((resolve) => child.on("exit", () => resolve()));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
