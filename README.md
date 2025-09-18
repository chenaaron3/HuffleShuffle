## Project Status

- Recent Changes:
  - **Migrated from AMQP/CloudAMQP to AWS SQS FIFO** for message queuing
  - **Consolidated game logic** into shared module (`src/server/api/game-logic.ts`)
  - **Removed duplicate code** from consumer and API endpoints
  - **Updated scanner daemon** to use SQS instead of AMQP
  - **Simplified architecture** with 95% cost reduction

- Open Tasks / Next Steps:
  - Document dealer and hand streaming flows end-to-end.
  - Add high-level architecture diagram for table, game state, and devices.
  - Outline testing strategy for `tableRouter.action` transitions.
  - Test SQS FIFO integration end-to-end.

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
  - **Shared Game Logic** (`src/server/api/game-logic.ts`): Consolidated card dealing, game progression, and betting logic used by both consumer and table router.
  - Raspberry Pi daemons (`raspberrypi/`):
    - `hand-daemon.ts`:
      - Generates/loads RSA keys; decrypts encrypted nonce to get room; spawns `run_hand.sh` to publish H.264 via LiveKit CLI.
      - Listens on Pusher channel `device-<serial>` for `start-stream` and `stop-stream`.
    - `dealer-daemon.ts`:
      - Resolves table, ensures LiveKit CLI, spawns `run_dealer.sh` on `dealer-start-stream`; stops on `dealer-stop-stream`.
    - `scanner-daemon.ts`:
      - **Updated**: Now uses AWS SQS FIFO instead of AMQP for card scanning.
      - Maintains FIFO ordering per table using MessageGroupId.
      - Prevents duplicate cards using MessageDeduplicationId.
    - Scripts:
      - `run_hand.sh`: uses `libcamera-vid` to H.264 over TCP then `lk room join --publish h264://...` as "Your Hand".
      - `run_dealer.sh`: uses GStreamer + x264 over TCP then `lk room join --publish h264://...` as "dealer-camera".

- Database / Schema Notes (`src/server/db/schema.ts`):
  - Enums: `user_role` (player|dealer), `game_state` (DEAL_HOLE_CARDS|BETTING|DEAL_FLOP|DEAL_TURN|DEAL_RIVER|SHOWDOWN|RESET_TABLE), `pi_device_type` (scanner|dealer|card|button).
  - Tables:
    - `user`: role, balance (non-negative), optional `publicKey`.
    - `poker_table`: unique `dealerId`, blinds.
    - `seat`: unique per `(tableId, seatNumber)` and per `playerId`; stores cards, buy-in, encrypted nonces.
    - `game`: state machine fields, community cards, pot totals, betting counters.
    - `pi_device`: registry with `serial`, `tableId`, `type`, optional `seatNumber`, `publicKey`, `lastSeenAt`.

- Env/Config Notes (`src/env.js`):
  - Server vars: `AUTH_SECRET` (prod), `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `DATABASE_URL`, `NODE_ENV`, `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `PUSHER_APP_ID`, `PUSHER_KEY`, `PUSHER_SECRET`, `PUSHER_CLUSTER`, `SQS_QUEUE_URL`, `AWS_REGION`.
  - Do not commit secrets. Required for token issuance, Pusher events, and SQS integration.

- Known Issues:
  - None tracked here yet.

---

### Huffle Shuffle

This is a Next.js T3-based poker table and streaming control system integrating LiveKit for video, Pusher for device signaling, a Raspberry Pi camera pipeline for dealer/hand views, and a tRPC backend managing table state, seats, and betting logic.

## Scanner ingestion (AWS SQS FIFO + ingest worker)

- **Why SQS FIFO**: Replaced AMQP with AWS SQS FIFO for better cost-effectiveness, simpler architecture, and managed infrastructure. Provides exactly-once processing and strict FIFO ordering per table.

- **Architecture**:
  - Raspberry Pi `scanner-daemon.ts` sends card scans to AWS SQS FIFO queue using MessageGroupId for table-specific ordering.
  - An always-on ingest worker (`src/server/ingest/consumer.ts`) consumes messages with long polling, validates, and applies the DEAL_CARD transaction using shared game logic.
  - Per-device identity is handled by AWS credentials; per-message deduplication prevents duplicate card deals.

- **SQS FIFO topology**:
  - Queue: `huffle-scans.fifo` (FIFO, content-based deduplication)
  - MessageGroupId: Uses table ID to ensure FIFO ordering per table
  - MessageDeduplicationId: Prevents duplicate cards in the same game
  - Consumer: Long polling (20s), batch processing (10 messages max)

- **Pi setup**:
  - Env on Pi (raspberrypi/.env):
    - `SCANNER_DEVICE=/dev/hidraw0` (or your udev symlink)
    - `SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789012/huffle-scans.fifo`
    - `AWS_REGION=us-east-1` (or your preferred region)
  - Run:
    - `cd raspberrypi && npm install`
    - `npm run start` (or via PM2 as pi user)

- **Ingest worker deploy** (Fly.io suggested):
  - Files: `Dockerfile.ingest`, `fly.toml`, script `npm run ingest:worker`
  - Env (Fly secrets):
    - `SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789012/huffle-scans.fifo`
    - `AWS_REGION=us-east-1`
    - `DATABASE_URL=postgres://...`
  - Deploy steps:
    - `fly auth login`
    - `fly launch --no-deploy --copy-config --auto-confirm` (ensure `fly.toml` uses `Dockerfile.ingest`)
    - `fly secrets set SQS_QUEUE_URL=... DATABASE_URL=... AWS_REGION=us-east-1`
    - `fly deploy -c fly.toml`
  - Logs: `fly logs` (look for `[ingest] connecting to SQS FIFO queue: ...`)

- **Ordering & durability**:
  - **Ordering**: SQS FIFO ensures strict FIFO ordering per table (MessageGroupId).
  - **Durability**: Messages are persistent; consumer deletes on success, failed messages are retried automatically.
  - **Idempotency**: MessageDeduplicationId prevents duplicate card deals.

- **Idempotency & validation**:
  - Reject stale timestamps (±30s).
  - Idempotency via SQS FIFO deduplication and unique MessageDeduplicationId.
  - Same DEAL_CARD validation path as TRPC action using shared game logic (no duplicate cards, correct state transitions).

- **Benefits of migration**:
  - **95% cost reduction**: From ~$30/month (Amazon MQ) to ~$0.50/month (SQS FIFO)
  - **Simpler architecture**: No exchanges, routing keys, or connection management
  - **Better reliability**: Automatic retries, built-in error handling
  - **Easier scaling**: Auto-scaling, no instance management
  - **Cleaner code**: Removed ~100 lines of connection management code

- **Testing without hardware**:
  - **Test mode**: Run scanner daemon with `npm run scanner:test` (interactive mode)
  - **Test script**: Use `npm run test:scanner` to send specific cards or sequences
  - **Examples**:

    ```bash
    # Send specific cards
    npm run test:scanner ace-spades
    npm run test:scanner king-hearts

    # Send random card
    npm run test:scanner random

    # Send test sequence (hole cards + flop)
    npm run test:scanner sequence
    ```

- **Troubleshooting**:
  - If Pi needed sudo before: add udev rule to grant `rw` to `pi` group for your scanner (match `idVendor`/`idProduct`).
  - If messages don't appear: verify `SQS_QUEUE_URL`, AWS credentials, and that the worker is running.
  - Place SQS queue and the ingest worker in the same region as the DB for lowest latency.
