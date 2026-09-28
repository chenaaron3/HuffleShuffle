export type LiveKitAccessMode = "publish" | "subscribe";

/**
 * Dealers and seated players publish. Anyone else may subscribe to the
 * table room only. Membership (already at another table) is enforced elsewhere.
 */
export function resolveLiveKitAccess(input: {
  tableDealerId: string | null | undefined;
  userId: string;
  seatedAtThisTable: boolean;
}): LiveKitAccessMode {
  const isDealerHere = input.tableDealerId === input.userId;
  if (isDealerHere || input.seatedAtThisTable) return "publish";
  return "subscribe";
}
