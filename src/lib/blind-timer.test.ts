import { describe, expect, it } from "vitest";

import {
  computeBlindMultiplier,
  isBlindMultiplierAtCap,
  MAX_BLIND_MULTIPLIER,
} from "./blind-timer";

describe("blind-timer", () => {
  it("produces the expected first 20 levels for a 5/10 game", () => {
    const baseSmallBlind = 5;
    const baseBigBlind = 10;

    const expectedLevels: Array<[smallBlind: number, bigBlind: number]> = [
      [5, 10], //          step 0
      [10, 20], //         step 1
      [15, 30], //         step 2
      [20, 40], //         step 3
      [25, 50], //         step 4
      [50, 100], //        step 5
      [75, 150], //        step 6
      [100, 200], //       step 7
      [150, 300], //       step 8
      [200, 400], //       step 9
      [250, 500], //       step 10
      [500, 1000], //      step 11
      [750, 1500], //      step 12
      [1000, 2000], //     step 13
      [1500, 3000], //     step 14
      [2000, 4000], //     step 15
      [2500, 5000], //     step 16
      [5000, 10000], //    step 17
      [7500, 15000], //    step 18
      [10000, 20000], //   step 19
    ];

    const actualLevels = expectedLevels.map((_, steps) => {
      const multiplier = computeBlindMultiplier(steps);
      return [baseSmallBlind * multiplier, baseBigBlind * multiplier];
    });

    expect(actualLevels).toEqual(expectedLevels);
  });

  it("stays at cap for additional steps", () => {
    expect(computeBlindMultiplier(29)).toBe(MAX_BLIND_MULTIPLIER);
    expect(computeBlindMultiplier(30)).toBe(MAX_BLIND_MULTIPLIER);
    expect(computeBlindMultiplier(100)).toBe(MAX_BLIND_MULTIPLIER);
  });

  it("detects cap", () => {
    expect(isBlindMultiplierAtCap(28)).toBe(false);
    expect(isBlindMultiplierAtCap(29)).toBe(true);
    expect(isBlindMultiplierAtCap(0)).toBe(false);
  });
});
