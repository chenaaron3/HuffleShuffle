import { execSync } from 'node:child_process';
import { createSign, webcrypto as crypto } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function loadEnv(): void {
  try {
    const p = join(process.cwd(), ".env");
    if (!existsSync(p)) return;
    const s = readFileSync(p, "utf8");
    s.split(/\r?\n/).forEach((l) => {
      const t = l.trim();
      if (!t || t.startsWith("#")) return;
      const i = t.indexOf("=");
      if (i <= 0) return;
      const k = t.slice(0, i).trim();
      let v = t.slice(i + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      )
        v = v.slice(1, -1);
      if (!(k in process.env)) (process.env as any)[k] = v;
    });
  } catch {}

  const API_BASE = process.env.API_BASE_URL ?? "http://localhost:3000";
  const LIVEKIT_URL = process.env.LIVEKIT_URL; // e.g. wss://your.livekit.server
  const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
  const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;

  if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL || !API_BASE) {
    throw new Error(
      "Missing LIVEKIT_API_KEY or LIVEKIT_API_SECRET or LIVEKIT_URL or API_BASE",
    );
  }
}

export function lastNonEmptyLine(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  return lines[lines.length - 1] ?? "";
}

export function getSerialNumber(): string {
  try {
    const out = execSync(
      "bash -lc \"tr -d '\\0' </sys/firmware/devicetree/base/serial-number; echo\"",
      { stdio: ["ignore", "pipe", "ignore"] },
    ).toString();
    const s = lastNonEmptyLine(out);
    if (s) return s;
  } catch {}
  try {
    const out = execSync(
      "bash -lc \"tr -d '\\0' </proc/device-tree/serial-number; echo\"",
      { stdio: ["ignore", "pipe", "ignore"] },
    ).toString();
    const s = lastNonEmptyLine(out);
    if (s) return s;
  } catch {}
  const out = execSync(
    "bash -lc \"awk -F ': ' '/Serial/ {print $2}' /proc/cpuinfo | tail -n1\"",
    { stdio: ["ignore", "pipe", "ignore"] },
  ).toString();
  const s = lastNonEmptyLine(out);
  if (s) return s;
  return lastNonEmptyLine(
    execSync('bash -lc "cat /etc/machine-id || true"', {
      stdio: ["ignore", "pipe", "ignore"],
    }).toString(),
  );
}

export function ensureLivekitCLI(): void {
  try {
    execSync('bash -lc "command -v lk"', { stdio: "ignore" });
  } catch {
    throw new Error(
      "LiveKit CLI (lk) not found. Install: curl -sSL https://get.livekit.io/cli | bash",
    );
  }
}

export const API_BASE = () =>
  process.env.API_BASE_URL ?? "http://localhost:3000";

export async function resolveTable(serial: string): Promise<{
  tableId: string;
  encNonce: string | null;
  seatNumber: number | null;
  type: "card" | "dealer" | "scanner" | "button";
}> {
  const resp = await fetch(
    `${API_BASE()}/api/pi/room?serial=${encodeURIComponent(serial)}`,
  );
  if (!resp.ok) throw new Error(`resolveTable failed: ${resp.status}`);
  const data = (await resp.json()) as {
    tableId?: string;
    encNonce?: string | null;
    seatNumber?: number | null;
    type?: "card" | "dealer" | "scanner" | "button";
  };
  if (!data.tableId) throw new Error("resolveTable invalid response");
  return {
    tableId: data.tableId,
    encNonce: data.encNonce ?? null,
    seatNumber: data.seatNumber ?? null,
    type: data.type!,
  };
}

// --- Shared key utilities for Pi daemons ---
export async function ensurePiKeys(
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

export function signMessage(privatePem: string, message: string): string {
  const sign = createSign("RSA-SHA256");
  sign.update(message);
  sign.end();
  const sig = sign.sign(privatePem);
  return sig.toString("base64");
}

export function importPkcs8Pem(privatePemPath: string): Promise<CryptoKey> {
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

export async function decryptBase64(
  priv: CryptoKey,
  b64: string,
): Promise<string> {
  const bin = Buffer.from(b64, "base64");
  const pt = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, priv, bin);
  return new TextDecoder().decode(pt);
}
