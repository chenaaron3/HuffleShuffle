import console from "node:console";
import { createReadStream, existsSync, readdirSync } from "node:fs";

import type {
  ScannerTelemetryDetails,
  ScannerTelemetryEvent,
} from "./scanner-telemetry";

type ScannerHidReaderOptions = {
  preferredPath: string;
  isValidScan: (code: string) => boolean;
  onScan: (code: string, devicePath: string) => Promise<void>;
  onStatus: (
    event: ScannerTelemetryEvent,
    details?: ScannerTelemetryDetails,
  ) => void;
};

const HID_ENTER_CODE = 0x28;
const HID_TO_CHAR: Record<number, string> = {
  0x4: "a",
  0x5: "b",
  0x6: "c",
  0x7: "d",
  0x8: "e",
  0x9: "f",
  0xa: "g",
  0xb: "h",
  0xc: "i",
  0xd: "j",
  0xe: "k",
  0xf: "l",
  0x10: "m",
  0x11: "n",
  0x12: "o",
  0x13: "p",
  0x14: "q",
  0x15: "r",
  0x16: "s",
  0x17: "t",
  0x18: "u",
  0x19: "v",
  0x1a: "w",
  0x1b: "x",
  0x1c: "y",
  0x1d: "z",
  0x1e: "1",
  0x1f: "2",
  0x20: "3",
  0x21: "4",
  0x22: "5",
  0x23: "6",
  0x24: "7",
  0x25: "8",
  0x26: "9",
  0x27: "0",
  0x2c: " ",
  0x2d: "-",
  0x2e: "=",
  0x2f: "[",
  0x30: "]",
  0x32: "\\",
  0x33: ";",
  0x34: '"',
  0x35: "~",
  0x36: ",",
  0x37: ".",
  0x38: "/",
};

export function listHidDevicePaths(preferredPath: string): string[] {
  let discovered: string[] = [];
  try {
    discovered = readdirSync("/dev")
      .filter((name) => /^hidraw\d+$/.test(name))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map((name) => `/dev/${name}`);
  } catch {}

  const paths = existsSync(preferredPath)
    ? [preferredPath, ...discovered]
    : discovered;
  return [...new Set(paths)];
}

export function startScannerHidReader(
  options: ScannerHidReaderOptions,
): () => void {
  type Candidate = {
    stream: ReturnType<typeof createReadStream>;
    acc: string;
    ended: boolean;
    intentionalClose: boolean;
  };

  const candidates = new Map<string, Candidate>();
  const lastErrorReportedAt = new Map<string, number>();
  let selectedPath: string | null = null;
  let stopped = false;
  let rescanTimer: NodeJS.Timeout | undefined;
  let lastCandidateSignature = "";

  const scheduleRescan = (delay = 1000) => {
    if (stopped || selectedPath || rescanTimer) return;
    rescanTimer = setTimeout(() => {
      rescanTimer = undefined;
      scanForCandidates();
    }, delay);
  };

  const closeCandidate = (path: string) => {
    const candidate = candidates.get(path);
    if (!candidate) return;
    candidate.intentionalClose = true;
    candidates.delete(path);
    candidate.stream.destroy();
  };

  const selectCandidate = (path: string) => {
    if (selectedPath) return;
    selectedPath = path;
    console.log(`[scanner-hid] selected device ${path}`);
    options.onStatus("hid_selected", { devicePath: path });
    for (const otherPath of candidates.keys()) {
      if (otherPath !== path) closeCandidate(otherPath);
    }
  };

  const openCandidate = (path: string) => {
    if (candidates.has(path) || stopped) return;

    const stream = createReadStream(path, { flags: "r", highWaterMark: 8 });
    const candidate: Candidate = {
      stream,
      acc: "",
      ended: false,
      intentionalClose: false,
    };
    candidates.set(path, candidate);

    const finish = (reason: string, error?: unknown) => {
      if (candidate.ended) return;
      candidate.ended = true;
      candidates.delete(path);
      if (!candidate.intentionalClose) {
        const message =
          error instanceof Error
            ? error.message
            : error
              ? String(error)
              : reason;
        const errorKey = `${path}:${reason}:${message}`;
        const now = Date.now();
        if (now - (lastErrorReportedAt.get(errorKey) ?? 0) >= 60_000) {
          lastErrorReportedAt.set(errorKey, now);
          console.error(`[scanner-hid] ${reason}: ${path}`, error ?? "");
          options.onStatus("hid_error", {
            devicePath: path,
            reason,
            message: message.slice(0, 200),
          });
        }
      }
      if (selectedPath === path) selectedPath = null;
      if (!candidate.intentionalClose) scheduleRescan(2000);
    };

    stream.on("data", (chunk: Buffer | string) => {
      const buffer =
        typeof chunk === "string" ? Buffer.from(chunk, "binary") : chunk;
      for (const byte of buffer) {
        if (byte === HID_ENTER_CODE) {
          const code = candidate.acc.trim();
          candidate.acc = "";
          if (!code) continue;
          if (!selectedPath && options.isValidScan(code)) selectCandidate(path);
          if (!selectedPath || selectedPath === path) {
            void options.onScan(code, path);
          }
          continue;
        }
        const character = HID_TO_CHAR[byte];
        if (character) candidate.acc += character;
      }
    });

    stream.on("error", (error) => {
      finish("read_error", error);
      stream.destroy();
    });
    stream.on("close", () => finish("closed"));
  };

  const scanForCandidates = () => {
    if (stopped || selectedPath) return;
    const paths = listHidDevicePaths(options.preferredPath);
    const signature = paths.join(",");
    if (signature !== lastCandidateSignature) {
      lastCandidateSignature = signature;
      console.log(`[scanner-hid] candidates: ${paths.join(", ") || "none"}`);
      options.onStatus("hid_candidates", {
        count: paths.length,
        paths: paths.join(",").slice(0, 200),
      });
    }
    for (const path of paths) openCandidate(path);
    scheduleRescan();
  };

  scanForCandidates();

  return () => {
    stopped = true;
    if (rescanTimer) clearTimeout(rescanTimer);
    for (const path of [...candidates.keys()]) closeCandidate(path);
  };
}
