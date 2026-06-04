import { describe, expect, it } from "vitest";

import {
  computeBlindMultiplier,
  isBlindMultiplierAtCap,
  MAX_BLIND_MULTIPLIER,
} from "./blind-timer";

describe("blind-timer", () => {
  it("doubles per step until cap", () => {
    expect(computeBlindMultiplier(0)).toBe(1);
    expect(computeBlindMultiplier(1)).toBe(2);
    expect(computeBlindMultiplier(6)).toBe(64);
    expect(computeBlindMultiplier(16)).toBe(MAX_BLIND_MULTIPLIER);
  });

  it("stays at cap for additional steps", () => {
    expect(computeBlindMultiplier(17)).toBe(MAX_BLIND_MULTIPLIER);
    expect(computeBlindMultiplier(100)).toBe(MAX_BLIND_MULTIPLIER);
  });

  it("detects cap", () => {
    expect(isBlindMultiplierAtCap(15)).toBe(false);
    expect(isBlindMultiplierAtCap(16)).toBe(true);
    expect(isBlindMultiplierAtCap(0)).toBe(false);
  });
});
