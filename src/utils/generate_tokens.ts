import 'dotenv/config';

import { AccessToken } from 'livekit-server-sdk';

import type { VideoGrant } from "livekit-server-sdk";

const { LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = process.env;

if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
  throw new Error("Missing LIVEKIT_API_KEY or LIVEKIT_API_SECRET");
}

const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
  identity: "raspberry-pi",
  ttl: "1h",
});

const videoGrant: VideoGrant = {
  room: "huffle-shuffle",
  canPublish: true,
  canSubscribe: true,
};

at.addGrant(videoGrant);

const token = await at.toJwt();
console.log(token);
