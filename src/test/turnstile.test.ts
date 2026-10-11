import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockEnv = vi.hoisted(() => ({
  NODE_ENV: "test" as string,
  TURNSTILE_SECRET: undefined as string | undefined,
  TURNSTILE_HOSTNAMES: undefined as string | undefined,
}));

vi.mock("~/env", () => ({ env: mockEnv }));

import { verifyTurnstileToken } from "~/server/turnstile";

function mockSiteverify(body: Record<string, unknown>, status = 200) {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
    new Response(JSON.stringify(body), { status }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("verifyTurnstileToken", () => {
  beforeEach(() => {
    mockEnv.NODE_ENV = "test";
    mockEnv.TURNSTILE_SECRET = "test-secret";
    mockEnv.TURNSTILE_HOSTNAMES = "huffleshuffle.com, www.huffleshuffle.com";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("accepts a successful token with matching action and hostname", async () => {
    const fetchMock = mockSiteverify({
      success: true,
      action: "waitlist",
      hostname: "www.huffleshuffle.com",
    });
    await expect(
      verifyTurnstileToken("tok", "waitlist", "203.0.113.5"),
    ).resolves.toBe(true);

    const [, init] = fetchMock.mock.calls[0]!;
    const body = init?.body as URLSearchParams;
    expect(body.get("secret")).toBe("test-secret");
    expect(body.get("response")).toBe("tok");
    expect(body.get("remoteip")).toBe("203.0.113.5");
  });

  it.each([
    ["failed challenge", { success: false, "error-codes": ["timeout-or-duplicate"] }],
    ["wrong action", { success: true, action: "login", hostname: "huffleshuffle.com" }],
    ["unapproved hostname", { success: true, action: "waitlist", hostname: "evil.example" }],
  ])("rejects a %s", async (_label, body) => {
    mockSiteverify(body);
    await expect(verifyTurnstileToken("tok", "waitlist")).resolves.toBe(false);
  });

  it("rejects missing or oversized tokens without calling siteverify", async () => {
    const fetchMock = mockSiteverify({ success: true });
    await expect(verifyTurnstileToken(undefined, "waitlist")).resolves.toBe(false);
    await expect(verifyTurnstileToken("", "waitlist")).resolves.toBe(false);
    await expect(
      verifyTurnstileToken("x".repeat(2049), "waitlist"),
    ).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects when no hostnames are configured", async () => {
    mockEnv.TURNSTILE_HOSTNAMES = "";
    const fetchMock = mockSiteverify({ success: true });
    await expect(verifyTurnstileToken("tok", "waitlist")).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects on siteverify HTTP or network errors", async () => {
    mockSiteverify({}, 500);
    await expect(verifyTurnstileToken("tok", "waitlist")).resolves.toBe(false);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(verifyTurnstileToken("tok", "waitlist")).resolves.toBe(false);
  });

  it("skips verification without a secret outside production", async () => {
    mockEnv.TURNSTILE_SECRET = undefined;
    await expect(verifyTurnstileToken(undefined, "waitlist")).resolves.toBe(true);
  });

  it("fails closed without a secret in production", async () => {
    mockEnv.TURNSTILE_SECRET = undefined;
    mockEnv.NODE_ENV = "production";
    await expect(verifyTurnstileToken("tok", "waitlist")).resolves.toBe(false);
  });
});
