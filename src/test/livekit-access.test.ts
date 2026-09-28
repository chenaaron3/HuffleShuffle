import { describe, expect, it } from "vitest";
import { resolveLiveKitAccess } from "~/server/api/table/livekit-access";

describe("resolveLiveKitAccess", () => {
  it("lets this table's dealer publish", () => {
    expect(
      resolveLiveKitAccess({
        tableDealerId: "dealer-1",
        userId: "dealer-1",
        seatedAtThisTable: false,
      }),
    ).toBe("publish");
  });

  it("lets a seated player publish", () => {
    expect(
      resolveLiveKitAccess({
        tableDealerId: "dealer-1",
        userId: "player-1",
        seatedAtThisTable: true,
      }),
    ).toBe("publish");
  });

  it("lets anyone else subscribe as a spectator", () => {
    expect(
      resolveLiveKitAccess({
        tableDealerId: "dealer-1",
        userId: "watcher-1",
        seatedAtThisTable: false,
      }),
    ).toBe("subscribe");
  });
});
