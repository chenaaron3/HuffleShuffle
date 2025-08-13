import { spawn } from 'node:child_process';
import { join } from 'node:path';

import { getSerialNumber, loadEnv, resolveTable } from './daemon-util';

async function main() {
  loadEnv();
  const serial = getSerialNumber();
  // Try resolve up to ~30s in case device mapping isn't ready yet
  let info: { tableId: string; type?: string | null } | null = null;
  const start = Date.now();
  while (Date.now() - start < 30000) {
    try {
      const res = await resolveTable(serial);
      info = { tableId: res.tableId, type: (res as any).type ?? null };
      if (info.type) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (!info?.type) throw new Error("Unable to resolve device type for this Pi");

  let script: string;
  if (info.type === "dealer") {
    script = join(process.cwd(), "dealer-daemon.ts");
    console.log("[generic-daemon] launching dealer daemon");
  } else if (info.type === "card") {
    script = join(process.cwd(), "hand-daemon.ts");
    console.log("[generic-daemon] launching hand daemon");
  } else {
    throw new Error(`[generic-daemon] unsupported device type: ${info.type}`);
  }

  const child = spawn("npx", ["-y", "tsx", script], {
    stdio: "inherit",
    env: process.env,
  });
  await new Promise<void>((resolve) => child.on("exit", () => resolve()));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
