import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { ensurePiKeys, getSerialNumber } from './daemon-util';

async function main() {
  const serial = getSerialNumber();
  const { publicPem, privatePemPath } = await ensurePiKeys(serial);
  const pubPath = privatePemPath.replace(/\.pk8\.pem$/i, ".spki.pem");

  const home = "/home/pi";
  const defaultPubPath = join(home, ".huffle", "keys", `${serial}.spki.pem`);
  const resolvedPubPath = existsSync(pubPath) ? pubPath : defaultPubPath;

  console.log("Pi device information:");
  console.log(`serial: ${serial}`);
  console.log(`publicKeyPath: ${resolvedPubPath}`);
  console.log("publicKey:");
  console.log(publicPem.trim());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
