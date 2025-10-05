// Shared Pusher event/channel constants

export const DEVICE_CHANNEL = (serial: string) => `device-${serial}` as const;
export const TABLE_CHANNEL = (tableId: string) => `${tableId}` as const;

export const SIGNALS = {
  HAND_START: "start-stream" as const,
  HAND_STOP: "stop-stream" as const,
  DEALER_START: "dealer-start-stream" as const,
  DEALER_STOP: "dealer-stop-stream" as const,
  TABLE_UPDATED: "table-updated" as const,
};

export type HandStartPayload = {
  tableId: string;
  seatNumber: number;
  encNonce: string;
};
