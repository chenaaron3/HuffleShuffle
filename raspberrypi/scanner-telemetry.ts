import console from "node:console";

export type ScannerTelemetryEvent =
  | "daemon_started"
  | "hid_candidates"
  | "hid_selected"
  | "hid_error"
  | "scan_rejected"
  | "sqs_error"
  | "heartbeat";

export type ScannerTelemetryDetails = Record<
  string,
  string | number | boolean | null
>;

type ScannerTelemetryLoggerOptions = {
  apiBaseUrl: string;
  serial: string;
  timeoutMs?: number;
};

function sanitizeDetails(
  details: ScannerTelemetryDetails,
): ScannerTelemetryDetails {
  return Object.fromEntries(
    Object.entries(details)
      .slice(0, 12)
      .map(([key, value]) => [
        key.slice(0, 40),
        typeof value === "string" ? value.slice(0, 200) : value,
      ]),
  );
}

export class ScannerTelemetryLogger {
  private readonly endpoint: string;
  private readonly serial: string;
  private readonly timeoutMs: number;
  private deliveryChain = Promise.resolve();
  private heartbeat: NodeJS.Timeout | undefined;

  constructor(options: ScannerTelemetryLoggerOptions) {
    this.endpoint = `${options.apiBaseUrl.replace(/\/$/, "")}/api/pi/scanner-diagnostic`;
    this.serial = options.serial;
    this.timeoutMs = options.timeoutMs ?? 5000;
  }

  event(
    event: ScannerTelemetryEvent,
    details: ScannerTelemetryDetails = {},
  ): void {
    const task = async () => {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          serial: this.serial,
          event,
          ts: Date.now(),
          details: sanitizeDetails(details),
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!response.ok) {
        throw new Error(`diagnostic API returned ${response.status}`);
      }
    };

    this.deliveryChain = this.deliveryChain.then(task, task).catch((error) => {
      console.error(
        "[scanner-telemetry] delivery failed",
        error instanceof Error ? error.message : String(error),
      );
    });
  }

  error(
    event: ScannerTelemetryEvent,
    error: unknown,
    details: ScannerTelemetryDetails = {},
  ): void {
    this.event(event, {
      ...details,
      errorName: error instanceof Error ? error.name : "Error",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }

  startHeartbeat(
    details: ScannerTelemetryDetails = {},
    intervalMs = 300_000,
  ): void {
    if (this.heartbeat) return;
    this.heartbeat = setInterval(
      () => this.event("heartbeat", details),
      intervalMs,
    );
  }

  close(): void {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = undefined;
  }
}
