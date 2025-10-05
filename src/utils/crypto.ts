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

// --- Isomorphic RSA helpers for server/client ---

function b64ToUint8Array(b64: string): Uint8Array {
  if (typeof window === "undefined") {
    // Server (Node)
    const buf = Buffer.from(b64, "base64");
    return new Uint8Array(buf);
  }
  // Browser
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function importRsaSpkiPem(pem: string): Promise<CryptoKey> {
  const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = b64ToUint8Array(b64);
  return await (crypto as any).subtle.importKey(
    "spki",
    der,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"],
  );
}

export async function rsaEncryptB64(
  publicPem: string,
  data: string,
): Promise<string> {
  const key = await importRsaSpkiPem(publicPem);
  const enc = new TextEncoder();
  const ct = await (crypto as any).subtle.encrypt(
    { name: "RSA-OAEP" },
    key,
    enc.encode(data),
  );
  return Buffer.from(new Uint8Array(ct)).toString("base64");
}
