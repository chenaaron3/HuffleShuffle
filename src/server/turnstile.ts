import { env } from "~/env";

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export const TURNSTILE_ACTIONS = {
  waitlist: "waitlist",
} as const;

export type TurnstileAction =
  (typeof TURNSTILE_ACTIONS)[keyof typeof TURNSTILE_ACTIONS];

type SiteverifyResponse = {
  success: boolean;
  action?: string;
  hostname?: string;
  "error-codes"?: string[];
};

function expectedHostnames(): Set<string> {
  return new Set(
    (env.TURNSTILE_HOSTNAMES ?? "")
      .split(",")
      .map((hostname) => hostname.trim())
      .filter(Boolean),
  );
}

/**
 * Server-side Turnstile siteverify. Requires `success`, the expected action,
 * and a hostname in `TURNSTILE_HOSTNAMES`. Without `TURNSTILE_SECRET` the check
 * is skipped outside production and fails closed in production.
 */
export async function verifyTurnstileToken(
  token: string | undefined,
  expectedAction: TurnstileAction,
  clientIp?: string,
): Promise<boolean> {
  const secret = env.TURNSTILE_SECRET;
  if (!secret) {
    if (env.NODE_ENV === "production") {
      console.error("TURNSTILE_SECRET is not set; rejecting request");
      return false;
    }
    return true;
  }

  const hostnames = expectedHostnames();
  if (
    typeof token !== "string" ||
    token.length === 0 ||
    token.length > 2048 ||
    hostnames.size === 0
  ) {
    return false;
  }

  let result: SiteverifyResponse;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (clientIp) body.set("remoteip", clientIp);
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: AbortSignal.timeout(10_000),
      body,
    });
    if (!res.ok) throw new Error(`siteverify ${res.status}`);
    result = (await res.json()) as SiteverifyResponse;
  } catch (err) {
    console.error("Turnstile siteverify error", err);
    return false;
  }

  const ok =
    result.success === true &&
    result.action === expectedAction &&
    typeof result.hostname === "string" &&
    hostnames.has(result.hostname);
  if (!ok) {
    console.warn("Turnstile verification rejected", {
      success: result.success,
      action: result.action,
      hostname: result.hostname,
      errorCodes: result["error-codes"],
    });
  }
  return ok;
}
