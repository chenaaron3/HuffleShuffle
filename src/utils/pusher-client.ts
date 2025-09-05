import Pusher from 'pusher-js';
import { env } from '~/env';

let pusherClient: Pusher | null = null;

export function getPusherClient(): Pusher | null {
  if (typeof window === "undefined") {
    // Server-side rendering - return null
    return null;
  }

  if (!pusherClient) {
    try {
      pusherClient = new Pusher(env.NEXT_PUBLIC_PUSHER_KEY, {
        cluster: env.NEXT_PUBLIC_PUSHER_CLUSTER,
        forceTLS: true,
      });
    } catch (error) {
      console.error("Failed to initialize Pusher client:", error);
      return null;
    }
  }

  return pusherClient;
}

export function disconnectPusherClient(): void {
  if (pusherClient) {
    pusherClient.disconnect();
    pusherClient = null;
  }
}
