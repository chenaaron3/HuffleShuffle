import { describe, expect, it } from "vitest";
import { isTableParticipant } from "~/server/api/table/membership";

describe("isTableParticipant", () => {
  it("allows this table's dealer", () => {
    expect(
      isTableParticipant({
        userId: "dealer-1",
        tableDealerId: "dealer-1",
        seatedAtThisTable: false,
      }),
    ).toBe(true);
  });

  it("allows a seated player", () => {
    expect(
      isTableParticipant({
        userId: "player-1",
        tableDealerId: "dealer-1",
        seatedAtThisTable: true,
      }),
    ).toBe(true);
  });

  it("rejects spectators", () => {
    expect(
      isTableParticipant({
        userId: "watcher-1",
        tableDealerId: "dealer-1",
        seatedAtThisTable: false,
      }),
    ).toBe(false);
  });
});
