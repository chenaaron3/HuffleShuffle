import Pusher from 'pusher';

const { PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, PUSHER_CLUSTER } =
  process.env;

export const pusher = (() => {
  if (!PUSHER_APP_ID || !PUSHER_KEY || !PUSHER_SECRET || !PUSHER_CLUSTER) {
    return null as unknown as Pusher | null;
  }
  return new Pusher({
    appId: PUSHER_APP_ID,
    key: PUSHER_KEY,
    secret: PUSHER_SECRET,
    cluster: PUSHER_CLUSTER,
    useTLS: true,
  });
})();
