import { describe, expect, it } from "vitest";
import {
  fromEasternInputValue,
  nextOccurrence,
  toEasternInputValue,
  zonedTimeToUtc,
} from "~/lib/tournament-schedule";

describe("tournament schedule (Eastern time)", () => {
  it("converts EST and EDT wall-clock times to UTC", () => {
    // Nov 9 2026 is after DST ends (EST, UTC-5)
    expect(zonedTimeToUtc(2026, 11, 8, 15, 0).toISOString()).toBe(
      "2026-11-08T20:00:00.000Z",
    );
    // Jul 5 2026 is EDT (UTC-4)
    expect(zonedTimeToUtc(2026, 7, 5, 15, 0).toISOString()).toBe(
      "2026-07-05T19:00:00.000Z",
    );
  });

  it("finds the upcoming Sunday 3pm from a Saturday", () => {
    const saturdayNoon = zonedTimeToUtc(2026, 11, 7, 12, 0);
    expect(nextOccurrence(0, "15:00", saturdayNoon).toISOString()).toBe(
      "2026-11-08T20:00:00.000Z",
    );
  });

  it("returns the same day when the start time is later today", () => {
    const sundayNoon = zonedTimeToUtc(2026, 11, 8, 12, 0);
    expect(nextOccurrence(0, "18:00", sundayNoon).toISOString()).toBe(
      "2026-11-08T23:00:00.000Z",
    );
  });

  it("skips to next week once today's start time has passed", () => {
    const sundayEvening = zonedTimeToUtc(2026, 11, 8, 17, 30);
    expect(nextOccurrence(0, "15:00", sundayEvening).toISOString()).toBe(
      "2026-11-15T20:00:00.000Z",
    );
    // Exactly at the start time is not "after"
    const exactly = zonedTimeToUtc(2026, 11, 8, 15, 0);
    expect(nextOccurrence(0, "15:00", exactly).toISOString()).toBe(
      "2026-11-15T20:00:00.000Z",
    );
  });

  it("keeps the wall-clock time across a DST change", () => {
    // Oct 25 2026 (EDT) → next Sunday Nov 1 2026 is EST
    const afterGame = zonedTimeToUtc(2026, 10, 25, 20, 0);
    const next = nextOccurrence(0, "15:00", afterGame);
    expect(next.toISOString()).toBe("2026-11-01T20:00:00.000Z");
  });

  it("round-trips datetime-local values in Eastern time", () => {
    const d = fromEasternInputValue("2026-11-08T15:00");
    expect(d.toISOString()).toBe("2026-11-08T20:00:00.000Z");
    expect(toEasternInputValue(d)).toBe("2026-11-08T15:00");
  });
});
