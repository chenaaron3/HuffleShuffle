// WebCrypto RSA-OAEP utilities for per-game keys

const DB_NAME = "hs-crypto";
const STORE = "keys";

async function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).put(value as any, key);
  });
}

async function idbGet<T = unknown>(key: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

function arrayBufferToPemSpki(buf: ArrayBuffer): string {
  const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
  const wrapped = b64.replace(/.{1,64}/g, "$&\n");
  return `-----BEGIN PUBLIC KEY-----\n${wrapped}-----END PUBLIC KEY-----`;
}

export async function generateRsaKeyPairForTable(
  tableId: string,
): Promise<{ publicKeyPem: string }> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"],
  );
  // Persist non-extractable private key in IndexedDB for this table
  await idbPut(`priv:${tableId}`, keyPair.privateKey);
  const spki = await crypto.subtle.exportKey("spki", keyPair.publicKey);
  const pem = arrayBufferToPemSpki(spki);
  return { publicKeyPem: pem };
}

export async function getPrivateKeyForTable(
  tableId: string,
): Promise<CryptoKey | null> {
  const key = await idbGet<CryptoKey>(`priv:${tableId}`);
  return key ?? null;
}

export async function clearPrivateKeyForTable(tableId: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).delete(`priv:${tableId}`);
  });
}

export async function rsaDecryptBase64(
  tableId: string,
  b64Ciphertext: string,
): Promise<string> {
  const priv = await getPrivateKeyForTable(tableId);
  if (!priv) throw new Error("Missing private key");
  const bin = Uint8Array.from(atob(b64Ciphertext), (c) => c.charCodeAt(0));
  const pt = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, priv, bin);
  const dec = new TextDecoder();
  return dec.decode(pt);
}
