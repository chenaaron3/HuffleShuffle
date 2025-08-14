## Project Status

- Recent Changes:
  - Initialized README as a living status document and added Cursor rule to keep it updated.

- Open Tasks / Next Steps:
  - Document dealer and hand streaming flows end-to-end.
  - Add high-level architecture diagram for table, game state, and devices.
  - Outline testing strategy for `tableRouter.action` transitions.

- APIs & Routes:
  - tRPC `tableRouter` (`src/server/api/routers/table.ts`):
    - `livekitToken` (query): issues LiveKit JWT for a table room; requires env `LIVEKIT_*`.
    - `list` (query): lists tables.
    - `create` (mutation, dealer-only): creates table.
    - `join` (mutation, player-only): seats player, deducts buy-in, stores encrypted nonces for user and mapped Pi.
    - `leave` (mutation, player-only): refunds remaining buy-in and resequences seats; blocks during active hands.
    - `action` (mutation): START_GAME, DEAL_CARD, RESET_TABLE (dealer-only); RAISE, CHECK, FOLD (player turn). Handles betting rounds, pot merge, postflop progression, and showdown.
    - `get` (query): returns table snapshot redacted for the caller.
  - REST `GET /api/pi/room` (`src/pages/api/pi/room.ts`):
    - Input: `serial` query.
    - Output: `{ tableId, type, seatNumber, encNonce }`, updates `pi_device.lastSeenAt`.
  - REST `POST /api/webhook` (`src/pages/api/webhook.ts`): LiveKit webhook handler
    - `participant_joined`: triggers `start-stream` to seat-mapped `card` device and `dealer-start-stream`.
    - `participant_left`: triggers `stop-stream` to seat-mapped device.
    - `room_started`: triggers `dealer-start-stream`.
    - `room_finished`: triggers stop to all `card` devices and `dealer-stop-stream`.

- Services & Daemons:
  - Pusher server (`src/server/pusher.ts`): initializes server client if `PUSHER_*` present.
  - Raspberry Pi daemons (`raspberrypi/`):
    - `hand-daemon.ts`:
      - Generates/loads RSA keys; decrypts encrypted nonce to get room; spawns `run_hand.sh` to publish H.264 via LiveKit CLI.
      - Listens on Pusher channel `device-<serial>` for `start-stream` and `stop-stream`.
    - `dealer-daemon.ts`:
      - Resolves table, ensures LiveKit CLI, spawns `run_dealer.sh` on `dealer-start-stream`; stops on `dealer-stop-stream`.
    - Scripts:
      - `run_hand.sh`: uses `libcamera-vid` to H.264 over TCP then `lk room join --publish h264://...` as "Your Hand".
      - `run_dealer.sh`: uses GStreamer + x264 over TCP then `lk room join --publish h264://...` as "dealer-camera".

- Database / Schema Notes (`src/server/db/schema.ts`):
  - Enums: `user_role` (player|dealer), `game_status` (pending|active|completed), `game_state` (DEAL_HOLE_CARDS|BETTING|DEAL_FLOP|DEAL_TURN|DEAL_RIVER|SHOWDOWN|RESET_TABLE), `pi_device_type` (scanner|dealer|card|button).
  - Tables:
    - `user`: role, balance (non-negative), optional `publicKey`.
    - `poker_table`: unique `dealerId`, blinds.
    - `seat`: unique per `(tableId, seatNumber)` and per `playerId`; stores cards, buy-in, encrypted nonces.
    - `game`: state machine fields, community cards, pot totals, betting counters.
    - `pi_device`: registry with `serial`, `tableId`, `type`, optional `seatNumber`, `publicKey`, `lastSeenAt`.

- Env/Config Notes (`src/env.js`):
  - Server vars: `AUTH_SECRET` (prod), `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `DATABASE_URL`, `NODE_ENV`, `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `PUSHER_APP_ID`, `PUSHER_KEY`, `PUSHER_SECRET`, `PUSHER_CLUSTER`.
  - Do not commit secrets. Required for token issuance and Pusher events.

- Known Issues:
  - None tracked here yet.

---

### Huffle Shuffle

This is a Next.js T3-based poker table and streaming control system integrating LiveKit for video, Pusher for device signaling, a Raspberry Pi camera pipeline for dealer/hand views, and a tRPC backend managing table state, seats, and betting logic.
