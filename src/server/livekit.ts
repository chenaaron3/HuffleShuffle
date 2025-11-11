import { RoomServiceClient } from 'livekit-server-sdk';

let cachedRoomServiceClient: RoomServiceClient | null = null;

function normalizeLivekitUrl(url: string): string {
  // RoomServiceClient expects an http(s) URL. Convert ws/wss if provided.
  if (url.startsWith("wss://")) {
    return `https://${url.slice("wss://".length)}`;
  }
  if (url.startsWith("ws://")) {
    return `http://${url.slice("ws://".length)}`;
  }
  return url;
}

export function getRoomServiceClient(): RoomServiceClient {
  if (cachedRoomServiceClient) {
    return cachedRoomServiceClient;
  }
  const url = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!url || !apiKey || !apiSecret) {
    throw new Error("LiveKit env vars are not configured");
  }

  cachedRoomServiceClient = new RoomServiceClient(
    normalizeLivekitUrl(url),
    apiKey,
    apiSecret,
  );

  return cachedRoomServiceClient;
}
