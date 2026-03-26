# Architecture

## High-Level Flow

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Raspberry  │────▶│  AWS SQS FIFO │────▶│   Lambda/   │
│ Pi Scanner  │     │     Queue     │     │   Worker    │
└─────────────┘     └──────────────┘     └─────────────┘
                                                      │
                                                      ▼
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Browser   │◀────│   Next.js    │◀────│  PostgreSQL │
│   Client    │     │   tRPC API   │     │  Database   │
└─────────────┘     └──────────────┘     └─────────────┘
       │                    │
       │                    │
       ▼                    ▼
┌─────────────┐     ┌──────────────┐
│   LiveKit   │     │    Pusher    │
│   (Video)   │     │  (Signaling) │
└─────────────┘     └──────────────┘
```

## Component Responsibilities

1. **Next.js Frontend** (`src/pages/`, `src/components/`)
   - Table view UI with seat management
   - Real-time game state display
   - Video player integration
   - Player actions (bet, fold, check, raise)

2. **tRPC API** (`src/server/api/routers/`)
   - Table CRUD operations
   - Game state management
   - Player actions (betting, folding, etc.)
   - LiveKit token generation

3. **Shared Game Logic** (`src/server/api/game-logic.ts`)
   - Card dealing logic
   - Game state transitions
   - Betting round management
   - Pot calculation and side pots
   - Used by both tRPC API and ingest worker

4. **Ingest Worker** (`lambda/consumer/consumer.ts`)
   - Consumes SQS FIFO messages
   - Processes card scans from Raspberry Pi
   - Applies DEAL_CARD transactions using shared game logic

5. **Raspberry Pi Daemons** (`raspberrypi/`)
   - `scanner-daemon.ts`: Reads HID barcode scanner, sends to SQS
   - `hand-daemon.ts`: Manages hand camera streaming per seat
   - `dealer-daemon.ts`: Manages dealer camera streaming
