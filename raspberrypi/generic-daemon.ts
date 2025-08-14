import { join } from 'node:path';

import { getSerialNumber, loadEnv, resolveTable } from './daemon-util';
import { runDealerDaemon } from './dealer-daemon';
import { runHandDaemon } from './hand-daemon';
import { runScannerDaemon } from './scanner-daemon';

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

  if (info.type === "dealer") {
    console.log("[generic-daemon] launching dealer daemon");
    await runDealerDaemon();
  } else if (info.type === "card") {
    console.log("[generic-daemon] launching hand daemon");
    await runHandDaemon();
  } else if (info.type === "scanner") {
    console.log("[generic-daemon] launching scanner daemon");
    await runScannerDaemon();
  } else {
    throw new Error(`[generic-daemon] unsupported device type: ${info.type}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
