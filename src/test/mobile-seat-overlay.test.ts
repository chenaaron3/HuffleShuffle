import { describe, expect, it } from "vitest";

import {
  resolveDisplayedSeatId,
  resolveShowdownWinnerSeatId,
  shouldClearManualSeatSelection,
  shouldReleasePin,
} from "~/components/table/mobile/seat-overlay-logic";

describe("resolveDisplayedSeatId", () => {
  const occupied = ["seat-a", "seat-b", "seat-me"];

  it("uses a manual pick when that seat is still occupied", () => {
    expect(
      resolveDisplayedSeatId({
        selectedSeatId: "seat-b",
        highlightedSeatId: "seat-a",
        mySeatId: "seat-me",
        occupiedSeatIds: occupied,
      }),
    ).toBe("seat-b");
  });

  it("falls through when the manual pick left the table", () => {
    expect(
      resolveDisplayedSeatId({
        selectedSeatId: "seat-gone",
        highlightedSeatId: "seat-a",
        mySeatId: "seat-me",
        occupiedSeatIds: occupied,
      }),
    ).toBe("seat-a");
  });

  it("uses the highlighted seat when there is no pick", () => {
    expect(
      resolveDisplayedSeatId({
        selectedSeatId: null,
        highlightedSeatId: "seat-a",
        mySeatId: "seat-me",
        occupiedSeatIds: occupied,
      }),
    ).toBe("seat-a");
  });

  it("uses the local seat when nothing is highlighted", () => {
    expect(
      resolveDisplayedSeatId({
        selectedSeatId: null,
        highlightedSeatId: null,
        mySeatId: "seat-me",
        occupiedSeatIds: occupied,
      }),
    ).toBe("seat-me");
  });

  it("uses the first occupied seat for spectators", () => {
    expect(
      resolveDisplayedSeatId({
        selectedSeatId: null,
        highlightedSeatId: null,
        mySeatId: null,
        occupiedSeatIds: occupied,
      }),
    ).toBe("seat-a");
  });

  it("returns null when the table is empty", () => {
    expect(
      resolveDisplayedSeatId({
        selectedSeatId: "seat-a",
        highlightedSeatId: "seat-a",
        mySeatId: "seat-me",
        occupiedSeatIds: [],
      }),
    ).toBeNull();
  });
});

describe("resolveShowdownWinnerSeatId", () => {
  it("picks the seat with the largest win amount", () => {
    expect(
      resolveShowdownWinnerSeatId([
        { id: "seat-a", winAmount: 40 },
        { id: "seat-b", winAmount: 120 },
        { id: "seat-c", winAmount: 80 },
      ]),
    ).toBe("seat-b");
  });

  it("keeps the first seat when win amounts tie", () => {
    expect(
      resolveShowdownWinnerSeatId([
        { id: "seat-a", winAmount: 100 },
        { id: "seat-b", winAmount: 100 },
      ]),
    ).toBe("seat-a");
  });

  it("returns null when nobody won chips", () => {
    expect(
      resolveShowdownWinnerSeatId([
        { id: "seat-a", winAmount: 0 },
        { id: "seat-b" },
      ]),
    ).toBeNull();
  });
});

describe("shouldClearManualSeatSelection", () => {
  it("snaps back when the highlight changes and the picker is closed", () => {
    expect(
      shouldClearManualSeatSelection({
        pickerOpen: false,
        previousHighlightedSeatId: "seat-a",
        highlightedSeatId: "seat-b",
      }),
    ).toEqual({
      clearSelection: true,
      nextPreviousHighlightedSeatId: "seat-b",
    });
  });

  it("does not snap while the picker is open", () => {
    expect(
      shouldClearManualSeatSelection({
        pickerOpen: true,
        previousHighlightedSeatId: "seat-a",
        highlightedSeatId: "seat-b",
      }),
    ).toEqual({
      clearSelection: false,
      nextPreviousHighlightedSeatId: "seat-b",
    });
  });

  it("does not snap when the video is pinned", () => {
    expect(
      shouldClearManualSeatSelection({
        pickerOpen: false,
        pinned: true,
        previousHighlightedSeatId: "seat-a",
        highlightedSeatId: "seat-b",
      }),
    ).toEqual({
      clearSelection: false,
      nextPreviousHighlightedSeatId: "seat-b",
    });
  });

  it("does not snap when the highlight is unchanged", () => {
    expect(
      shouldClearManualSeatSelection({
        pickerOpen: false,
        previousHighlightedSeatId: "seat-a",
        highlightedSeatId: "seat-a",
      }),
    ).toEqual({
      clearSelection: false,
      nextPreviousHighlightedSeatId: "seat-a",
    });
  });
});

describe("shouldReleasePin", () => {
  it("releases when the pinned seat leaves the table", () => {
    expect(
      shouldReleasePin({
        pinned: true,
        selectedSeatId: "seat-gone",
        occupiedSeatIds: ["seat-a", "seat-b"],
      }),
    ).toBe(true);
  });

  it("keeps the pin while the seat is occupied", () => {
    expect(
      shouldReleasePin({
        pinned: true,
        selectedSeatId: "seat-a",
        occupiedSeatIds: ["seat-a", "seat-b"],
      }),
    ).toBe(false);
  });

  it("does not release when nothing is pinned", () => {
    expect(
      shouldReleasePin({
        pinned: false,
        selectedSeatId: "seat-gone",
        occupiedSeatIds: ["seat-a"],
      }),
    ).toBe(false);
  });
});
