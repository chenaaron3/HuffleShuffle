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
  previousHighlightedSeatId,
  highlightedSeatId,
}: {
  pickerOpen: boolean;
  previousHighlightedSeatId: string | null;
  highlightedSeatId: string | null;
}): { clearSelection: boolean; nextPreviousHighlightedSeatId: string | null } {
  if (pickerOpen) {
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
