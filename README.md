# Huffle Shuffle

A Next.js T3-based poker table management and streaming control system that integrates LiveKit for video streaming, Pusher for device signaling, Raspberry Pi camera pipelines for dealer/hand views, and a tRPC backend managing table state, seats, and betting logic.

## Project Status

### Recent Changes

- **Side pot orphan layer (tests)**: `src/server/api/hand-solver.side-pots.test.ts` — unit tests for `calculateSidePotsFromCumulativeBets` (e.g. 160/155/155 with high folder) assert **sum(side pot amounts) = total committed chips**, preventing the old conservation failure when orphan layers were dropped. **Harness**: any validate step that includes `game: { state: "SHOWDOWN" }` also asserts `sum(startingBalance) === sum(buyIn)` (same as `validateMoneyConservation` in `hand-solver.ts`); see `handleValidateStep` in `src/test/scenario-step-handlers.ts`.
- **Scanner ingest**: `raspberrypi/scanner-daemon.ts` — strict line-only valid four-digit card barcode (no extraction/salvage); drop invalid scans before SQS; clear HID accumulator on read error. See [`docs/card-scanning-ingestion.md`](docs/card-scanning-ingestion.md).
- **Side pots / chip conservation**: `calculateSidePotsFromCumulativeBets` in `src/server/api/hand-solver.ts` (same in `lambda/consumer/link/hand-solver.ts`) does **not** drop layers where every contributor is folded; that amount is **carried** into the next pot with eligible winners, or appended to the **last** such pot (no merge-time refund in `mergeBetsIntoPotGeneric`). See `docs/game-state-machine.md`.
- **Docs layout**: Long-form reference moved under `docs/`; this file is the entry + status router. See **Documentation map** below.
- **Root npm scripts**: `lambda:deploy` / `lambda:deploy:prod` run Serverless deploy from repo root via `lambda/consumer` (same as `cd lambda/consumer && npm run deploy`). See `docs/development.md` → **Lambda Consumer**.
- **Harness scenarios** (`src/test/table.scenarios/blind-all-in-seat-resolution.ts`): SB all-in (full deal, `firstToActFor: player1`); BB all-in (`firstToActFor: player1` + `CHECK`); **4 players** SB+BB both all-in (`firstToActFor: player4` UTG + `CHECK`). Validate helper `firstToActFor` in `scenario.types.ts` / `scenario-step-handlers.ts`. Run: `npm test -- src/test/table.scenario.harness.test.ts --run -t "blind all-in|four players"` (substring on scenario `name`).
- **Blind seat resolution**: `getBigAndSmallBlindSeats` and preflop UTG setup in `ensureHoleCardsProgression` now walk button→SB→BB with `getNextDealableSeatId` (active + all-in) instead of `getNextActiveSeatId`, so blind posters who go all-in are not skipped for deal order / `assignedSeatId` / first-to-act anchoring. See `src/server/api/game-logic.ts` and `lambda/consumer/link/game-logic.ts`.
- **Volunteer to show hands**: Players can opt to reveal their hand at showdown when it would normally be hidden (single winner or folded). New `VOLUNTEER_SHOW` action; `seats.voluntaryShow`; `ShowHandControl` in same spot as raise controls. See `src/components/ui/show-hand-control.tsx`, `redactSnapshotForUser` in `src/server/api/routers/table.ts`.
- Simplified redact snapshot logic: removed redundant `betCount` check; now uses single `showCardsForRunout` with `activePlayerFacingDecision` (currentBet < maxBet) as the source of truth. Added 7 edge case tests. See `redactSnapshotForUser` in `src/server/api/routers/table.ts`.
- Implemented minimum re-raise rule (TDA): each raise must add at least the previous raise increment; `games.lastRaiseIncrement` tracks this per betting round.
- Added LiveKit bandwidth tuning in `src/pages/table/[id].tsx` (`dynacast`, `adaptiveStream`, `videoEncoding.maxBitrate`, `videoSimulcastLayers`).

### Open Tasks / Next Steps

- _(None tracked in-repo.)_

### APIs & Routes

- **tRPC** `tableRouter` in `src/server/api/routers/table.ts` — queries: `livekitToken`, `list`, `get`; mutations: `create`, `dealerJoin`, `dealerLeave`, `join`, `leave`, `changeSeat`, `action` (incl. `VOLUNTEER_SHOW`, `DEAL_RANDOM`, `RESET_TABLE`). Full listing: [`docs/api-endpoints.md`](docs/api-endpoints.md).
- **REST**: `GET /api/pi/room`, `POST /api/webhook` (LiveKit). Same doc.

### Services & Daemons

- **Ingest**: `lambda/consumer/consumer.ts` — SQS FIFO → shared `game-logic.ts` → Pusher notify.
- **Pi**: `raspberrypi/scanner-daemon.ts`, `hand-daemon.ts`, `dealer-daemon.ts` — scanner → SQS; cameras via Pusher `device-{serial}` events (`start-stream`, `stop-stream`, `dealer-start-stream`, `dealer-stop-stream`). Detail: [`docs/card-scanning-ingestion.md`](docs/card-scanning-ingestion.md), [`docs/video-streaming.md`](docs/video-streaming.md).

### Database / Schema Notes

- Core: `users`, `pokerTables`, `seats`, `games`, `piDevices`. Notable columns: `games.lastRaiseIncrement`, `games.wasReset`, `seats.voluntaryShow`. Enums: `game_state`, `seat_status`, `pi_device_type`. Full tables: [`docs/database-schema.md`](docs/database-schema.md).

### Env/Config Notes

- Server: `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `DATABASE_URL`, `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `PUSHER_*`, `AWS_*`, `SQS_QUEUE_URL`, `NODE_ENV`.
- Client: `NEXT_PUBLIC_PUSHER_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER`.
- Pi: see `raspberrypi/.env` template in [`docs/development.md`](docs/development.md).

### Known Issues

- Dealer browser stream can lag on custom LiveKit Cloud WSS while public demo remains smooth; UDP path confirmed (`local=srflx`, `remote=host`) from publisher stats.

---

## Start here (new chat / assistant)

1. Read **Project Status** above, then open **only** the doc that matches the task (table below).
2. **Non‑negotiables**: All dealing and state transitions go through shared `src/server/api/game-logic.ts` (keep `lambda/consumer/link/game-logic.ts` in sync). DB via Drizzle; table UI state in `src/stores/table-store.ts` + `src/hooks/use-table-selectors.ts`.

| If you are… | Open |
|-------------|------|
| Orienting / explaining the system | [`docs/architecture.md`](docs/architecture.md), [`docs/overview-and-technology.md`](docs/overview-and-technology.md) |
| Changing schema or migrations | [`docs/database-schema.md`](docs/database-schema.md), `src/server/db/schema.ts` |
| Game rules, states, betting | [`docs/game-state-machine.md`](docs/game-state-machine.md), `src/server/api/game-logic.ts` |
| tRPC / REST contracts | [`docs/api-endpoints.md`](docs/api-endpoints.md) |
| SQS, barcode scan pipeline, Lambda consumer | [`docs/card-scanning-ingestion.md`](docs/card-scanning-ingestion.md) |
| LiveKit, Pusher video signaling | [`docs/video-streaming.md`](docs/video-streaming.md) |
| React components, Zustand, mobile UI | [`docs/key-components.md`](docs/key-components.md), [`docs/mobile-support.md`](docs/mobile-support.md) |
| Local setup, env, test, deploy | [`docs/development.md`](docs/development.md) |
| Why something is built this way; contributor tasks | [`docs/design-and-workflows.md`](docs/design-and-workflows.md) |

## Documentation map

| Document | Contents |
|----------|----------|
| [`docs/overview-and-technology.md`](docs/overview-and-technology.md) | Product overview, frontend/backend/Pi stack |
| [`docs/architecture.md`](docs/architecture.md) | Data-flow diagram, component responsibilities |
| [`docs/database-schema.md`](docs/database-schema.md) | Tables, columns, enums |
| [`docs/game-state-machine.md`](docs/game-state-machine.md) | States, transitions, TDA notes, logic file index |
| [`docs/api-endpoints.md`](docs/api-endpoints.md) | tRPC procedures, REST routes |
| [`docs/card-scanning-ingestion.md`](docs/card-scanning-ingestion.md) | Pi scanner, SQS FIFO, barcode format |
| [`docs/video-streaming.md`](docs/video-streaming.md) | LiveKit rooms, encryption, Pi streaming, Pusher events |
| [`docs/key-components.md`](docs/key-components.md) | Main UI, mobile, server modules, hooks |
| [`docs/mobile-support.md`](docs/mobile-support.md) | Mobile landscape UX summary |
| [`docs/development.md`](docs/development.md) | Setup, migrations, env templates, testing, deploy, repo tree |
| [`docs/design-and-workflows.md`](docs/design-and-workflows.md) | Design decisions, common tasks, contributing |

## Table of Contents (this file)

- [Project Status](#project-status)
- [Start here (new chat / assistant)](#start-here-new-chat--assistant)
- [Documentation map](#documentation-map)
