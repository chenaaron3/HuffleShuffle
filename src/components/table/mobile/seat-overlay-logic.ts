/** Column count for the expanded mobile player grid. */
export function playerGridColumnCount(seatCount: number): number {
  if (seatCount <= 1) return 1;
  if (seatCount <= 4) return 2;
  if (seatCount <= 6) return 3;
  return 4;
}

export function resolveShowdownWinnerSeatId(
  seats: readonly { id: string; winAmount?: number | null }[],
): string | null {
  let bestId: string | null = null;
  let bestAmount = 0;
  for (const seat of seats) {
    const amount = seat.winAmount ?? 0;
    if (amount > bestAmount) {
      bestAmount = amount;
      bestId = seat.id;
    }
  }
  return bestId;
}

export function resolveDisplayedSeatId({
  selectedSeatId,
  highlightedSeatId,
  mySeatId,
  occupiedSeatIds,
}: {
  selectedSeatId: string | null;
  highlightedSeatId: string | null;
  mySeatId: string | null;
  occupiedSeatIds: readonly string[];
}): string | null {
  for (const id of [selectedSeatId, highlightedSeatId, mySeatId]) {
    if (id && occupiedSeatIds.includes(id)) return id;
  }
  return occupiedSeatIds[0] ?? null;
}

export function shouldClearManualSeatSelection({
  pickerOpen,
  pinned = false,
  previousHighlightedSeatId,
  highlightedSeatId,
}: {
  pickerOpen: boolean;
  pinned?: boolean;
  previousHighlightedSeatId: string | null;
  highlightedSeatId: string | null;
}): { clearSelection: boolean; nextPreviousHighlightedSeatId: string | null } {
  if (pickerOpen || pinned) {
    return {
      clearSelection: false,
      nextPreviousHighlightedSeatId: highlightedSeatId,
    };
  }
  return {
    clearSelection: previousHighlightedSeatId !== highlightedSeatId,
    nextPreviousHighlightedSeatId: highlightedSeatId,
  };
}

export function shouldReleasePin({
  pinned,
  selectedSeatId,
  occupiedSeatIds,
}: {
  pinned: boolean;
  selectedSeatId: string | null;
  occupiedSeatIds: readonly string[];
}): boolean {
  if (!pinned || !selectedSeatId) return false;
  return !occupiedSeatIds.includes(selectedSeatId);
}
