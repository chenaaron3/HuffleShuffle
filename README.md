# Huffle Shuffle

A Next.js T3-based poker table management and streaming control system that integrates LiveKit for video streaming, Pusher for device signaling, Raspberry Pi camera pipelines for dealer/hand views, and a tRPC backend managing table state, seats, and betting logic.

## Project Status

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
| Lambda / CloudWatch ingest logs (AWS CLI) | [`.cursor/skills/query-aws-logs/SKILL.md`](.cursor/skills/query-aws-logs/SKILL.md) |
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
| [`docs/development.md`](docs/development.md) | Setup, migrations, env templates, testing (incl. headless API+bot runner), deploy, repo tree |
| [`docs/design-and-workflows.md`](docs/design-and-workflows.md) | Design decisions, common tasks, contributing |

## Table of Contents (this file)

- [Project Status](#project-status)
- [Start here (new chat / assistant)](#start-here-new-chat--assistant)
- [Documentation map](#documentation-map)
