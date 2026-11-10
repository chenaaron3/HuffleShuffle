import { describe, expect, it } from "vitest";
import {
  canJoinLiveKitRoom,
  handRoomNameForSeat,
  resolveLiveKitAccess,
} from "~/server/api/table/livekit-access";

describe("handRoomNameForSeat", () => {
  it("is stable for the same seat and secret", () => {
    expect(handRoomNameForSeat("seat-1", "secret")).toBe(
      handRoomNameForSeat("seat-1", "secret"),
    );
  });

  it("differs per seat and per secret", () => {
    const base = handRoomNameForSeat("seat-1", "secret");
    expect(handRoomNameForSeat("seat-2", "secret")).not.toBe(base);
    expect(handRoomNameForSeat("seat-1", "other-secret")).not.toBe(base);
  });

  it("does not reveal the seat id", () => {
    expect(handRoomNameForSeat("seat-1", "secret")).not.toContain("seat-1");
  });
});

describe("canJoinLiveKitRoom", () => {
  const ownHandRoom = handRoomNameForSeat("my-seat", "secret");
  const otherHandRoom = handRoomNameForSeat("their-seat", "secret");

  it("allows the public table room for anyone", () => {
    expect(
      canJoinLiveKitRoom({
        tableId: "table-1",
        requestedRoom: "table-1",
        ownHandRoom: null,
      }),
    ).toBe(true);
  });

  it("allows a seated player's own hand room", () => {
    expect(
      canJoinLiveKitRoom({
        tableId: "table-1",
        requestedRoom: ownHandRoom,
        ownHandRoom,
      }),
    ).toBe(true);
  });

  it("rejects another player's hand room even when seated", () => {
    expect(
      canJoinLiveKitRoom({
        tableId: "table-1",
        requestedRoom: otherHandRoom,
        ownHandRoom,
      }),
    ).toBe(false);
  });

  it("rejects another table's room", () => {
    expect(
      canJoinLiveKitRoom({
        tableId: "table-1",
        requestedRoom: "table-2",
        ownHandRoom,
      }),
    ).toBe(false);
  });

  it("rejects hand rooms for unseated callers", () => {
    expect(
      canJoinLiveKitRoom({
        tableId: "table-1",
        requestedRoom: otherHandRoom,
        ownHandRoom: null,
      }),
    ).toBe(false);
  });
});

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
