import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
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

export async function resolveTableId(serial: string): Promise<string> {
  const resp = await fetch(
    `${API_BASE()}/api/pi/room?serial=${encodeURIComponent(serial)}`,
  );
  if (!resp.ok) throw new Error(`resolveTableId failed: ${resp.status}`);
  const data = (await resp.json()) as { tableId: string };
  if (!data?.tableId) throw new Error("resolveTableId invalid response");
  return data.tableId;
}
