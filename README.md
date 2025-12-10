# Huffle Shuffle

A Next.js T3-based poker table management and streaming control system that integrates LiveKit for video streaming, Pusher for device signaling, Raspberry Pi camera pipelines for dealer/hand views, and a tRPC backend managing table state, seats, and betting logic.

## Table of Contents

- [Overview](#overview)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [Database Schema](#database-schema)
- [Game State Machine](#game-state-machine)
- [API Routes & Endpoints](#api-routes--endpoints)
- [Card Scanning & Ingestion](#card-scanning--ingestion)
- [Video Streaming](#video-streaming)
- [Key Components](#key-components)
- [Mobile Support](#mobile-support)
- [Development Setup](#development-setup)
- [Environment Variables](#environment-variables)
- [Testing](#testing)
- [Deployment](#deployment)

## Overview

Huffle Shuffle is a real-time poker table management system that enables:

- **Live Poker Games**: Manage 8-seat poker tables with full Texas Hold'em rules
- **Card Scanning**: Physical card scanning via Raspberry Pi devices with barcode readers
- **Video Streaming**: Live video feeds from dealer camera and individual hand cameras per seat
- **Real-time Updates**: WebSocket-based updates using Pusher for table state synchronization
- **Role-based Access**: Separate dealer and player roles with different permissions
- **Blind Management**: Configurable blind levels with automatic progression timers

## Technology Stack

### Frontend

- **Next.js 15** (App Router) with React 19
- **TypeScript** for type safety
- **tRPC** for type-safe API calls
- **Zustand** for client-side state management
- **Tailwind CSS** for styling
- **Framer Motion** for animations
- **LiveKit React Components** for video streaming
- **Pusher JS** for real-time events

### Backend

- **Next.js API Routes** (tRPC + REST)
- **Drizzle ORM** with PostgreSQL
- **NextAuth.js** for authentication (Google OAuth)
- **LiveKit Server SDK** for video room management
- **Pusher Server SDK** for device signaling
- **AWS SQS FIFO** for card scan message queue

### Infrastructure

- **PostgreSQL** database
- **AWS SQS FIFO** for message queuing
- **AWS Lambda** for card ingestion (optional, can use always-on worker)
- **LiveKit** for WebRTC video streaming
- **Pusher** for WebSocket signaling

### Raspberry Pi Components

- **Node.js** daemons for device management
- **libcamera-vid** for hand camera streaming
- **GStreamer** for dealer camera streaming
- **LiveKit CLI** for H.264 stream publishing

## Architecture

### High-Level Flow

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Raspberry  │────▶│  AWS SQS FIFO │────▶│   Lambda/   │
│ Pi Scanner  │     │     Queue     │     │   Worker    │
└─────────────┘     └──────────────┘     └─────────────┘
                                                      │
                                                      ▼
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Browser   │◀────│   Next.js    │◀────│  PostgreSQL │
│   Client    │     │   tRPC API   │     │   Database  │
└─────────────┘     └──────────────┘     └─────────────┘
       │                    │
       │                    │
       ▼                    ▼
┌─────────────┐     ┌──────────────┐
│   LiveKit   │     │    Pusher    │
│   (Video)   │     │  (Signaling) │
└─────────────┘     └──────────────┘
```

### Component Responsibilities

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

## Database Schema

### Core Tables

#### `users` (huffle-shuffle_user)

- `id`: UUID primary key
- `email`: User email (unique)
- `name`: Display name
- `role`: Enum (`player` | `dealer`)
- `balance`: Integer (non-negative, default 100000)
- `publicKey`: Optional RSA public key for encryption

#### `pokerTables` (huffle-shuffle_poker_table)

- `id`: UUID primary key
- `name`: Table name
- `dealerId`: Foreign key to users (nullable, unique)
- `smallBlind`: Integer
- `bigBlind`: Integer
- `maxSeats`: Integer (default 8)

#### `seats` (huffle-shuffle_seat)

- `id`: UUID primary key
- `tableId`: Foreign key to pokerTables
- `playerId`: Foreign key to users (unique per player)
- `seatNumber`: Integer (0-7, unique per table)
- `buyIn`: Integer (current chip count)
- `startingBalance`: Integer (snapshot at game start)
- `currentBet`: Integer (current bet in this round)
- `cards`: Text array (hole cards, format: `["AS", "KH"]`)
- `seatStatus`: Enum (`active` | `folded` | `all-in` | `eliminated`)
- `lastAction`: Enum (`fold` | `check` | `call` | `raise` | `all-in`) or null
- `encryptedUserNonce`: Encrypted LiveKit room name for user
- `encryptedPiNonce`: Encrypted LiveKit room name for Pi device
- `handType`: Text (e.g., "Royal Flush", "One Pair")
- `handDescription`: Text (e.g., "Ace-High Straight Flush")
- `winAmount`: Integer (winnings from last hand)
- `winningCards`: Text array (cards that made the winning hand)

#### `games` (huffle-shuffle_game)

- `id`: UUID primary key
- `tableId`: Foreign key to pokerTables
- `state`: Enum (see Game State Machine below)
- `dealerButtonSeatId`: Foreign key to seats
- `assignedSeatId`: Foreign key to seats (current player to act)
- `communityCards`: Text array (flop, turn, river)
- `potTotal`: Integer (total pot amount)
- `sidePots`: JSONB array `[{amount: number, eligibleSeatIds: string[]}]`
- `betCount`: Integer (current betting round action count)
- `requiredBetCount`: Integer (actions needed to complete round)
- `effectiveSmallBlind`: Integer (computed at game start)
- `effectiveBigBlind`: Integer (computed at game start)
- `turnStartTime`: Timestamp (when current player's turn started)
- `isCompleted`: Boolean

#### `piDevices` (huffle-shuffle_pi_device)

- `serial`: String primary key (device serial number)
- `tableId`: Foreign key to pokerTables
- `type`: Enum (`scanner` | `dealer` | `card` | `button`)
- `seatNumber`: Integer (nullable, for `card` type devices)
- `publicKey`: Text (RSA public key for encryption)
- `lastSeenAt`: Timestamp

### Enums

- `user_role`: `player`, `dealer`
- `game_state`: `INITIAL`, `GAME_START`, `DEAL_HOLE_CARDS`, `BETTING`, `DEAL_FLOP`, `DEAL_TURN`, `DEAL_RIVER`, `SHOWDOWN`, `RESET_TABLE`
- `pi_device_type`: `scanner`, `dealer`, `card`, `button`
- `seat_status`: `active`, `folded`, `all-in`, `eliminated`
- `last_action`: `fold`, `check`, `call`, `raise`, `all-in`

## Game State Machine

The game progresses through these states:

1. **INITIAL**: Table created, no game started
2. **GAME_START**: Game initialization (collecting blinds)
3. **DEAL_HOLE_CARDS**: Dealing two cards to each active player
4. **BETTING**: Pre-flop betting round
5. **DEAL_FLOP**: Dealing three community cards
6. **BETTING**: Post-flop betting round
7. **DEAL_TURN**: Dealing fourth community card
8. **BETTING**: Post-turn betting round
9. **DEAL_RIVER**: Dealing fifth community card
10. **BETTING**: Post-river betting round
11. **SHOWDOWN**: Evaluating hands and determining winners
12. **RESET_TABLE**: Resetting for next hand

### State Transitions

- **DEAL_HOLE_CARDS → BETTING**: When all active players have 2 cards
- **BETTING → DEAL_FLOP**: When betting round completes (all active bets equal, all active players acted)
- **DEAL_FLOP → BETTING**: After 3 community cards dealt
- **BETTING → DEAL_TURN**: When betting round completes
- **DEAL_TURN → BETTING**: After 4th community card dealt
- **BETTING → DEAL_RIVER**: When betting round completes
- **DEAL_RIVER → BETTING**: After 5th community card dealt
- **BETTING → SHOWDOWN**: When betting round completes
- **SHOWDOWN → RESET_TABLE**: After winners determined and chips distributed
- **RESET_TABLE → DEAL_HOLE_CARDS**: When dealer starts new hand

### Key Logic Files

- `src/server/api/game-logic.ts`: Core game state machine and card dealing
- `src/server/api/hand-solver.ts`: Poker hand evaluation and winner determination
- `src/server/api/game-utils.ts`: Helper functions for seat rotation, betting validation
- `src/server/api/game-helpers.ts`: Betting action execution, bot integration
- `src/server/api/blind-timer.ts`: Blind level progression logic

## API Routes & Endpoints

### tRPC Router: `tableRouter` (`src/server/api/routers/table.ts`)

#### Queries

- **`livekitToken`**: Generate LiveKit JWT token for table room
  - Input: `{ tableId: string, roomName?: string }`
  - Output: `{ token: string, serverUrl: string }`
  - Auth: Must be seated player or dealer at table

- **`list`**: List all poker tables
  - Output: Array of table summaries with `isJoinable`, `availableSeats`, `playerCount`

- **`get`**: Get table snapshot (redacted for caller)
  - Input: `{ tableId: string }`
  - Output: `TableSnapshot` (see types below)
  - Redaction: Hides other players' cards unless in SHOWDOWN

#### Mutations

- **`create`**: Create new poker table (dealer-only)
  - Input: `{ name: string, smallBlind: number, bigBlind: number, maxSeats?: number }`
  - Output: `{ tableId: string }`

- **`dealerJoin`**: Assign dealer to existing table (dealer-only)
  - Input: `{ tableId: string }`

- **`dealerLeave`**: Remove dealer from table (dealer-only)
  - Input: `{ tableId: string }`

- **`join`**: Player joins table and takes a seat
  - Input: `{ tableId: string, seatNumber: number, buyIn: number, userPublicKey: string }`
  - Output: `TableSnapshot`
  - Side effects: Deducts buy-in from user balance, generates encrypted nonces for LiveKit rooms

- **`leave`**: Player leaves table
  - Input: `{ tableId: string }`
  - Side effects: Refunds remaining buy-in, blocks during active hands

- **`changeSeat`**: Player moves to different seat
  - Input: `{ tableId: string, toSeatNumber: number, userPublicKey: string }`
  - Output: `TableSnapshot`

- **`action`**: Execute game action
  - Input: `{ tableId: string, action: ActionType, params?: ActionParams }`
  - Output: `TableSnapshot`
  - Actions:
    - `START_GAME` (dealer-only): Initialize new hand
    - `DEAL_CARD` (dealer-only): Deal card to current assigned seat or community
    - `RAISE`: Raise bet amount
    - `CHECK`: Check (no bet increase)
    - `FOLD`: Fold hand
    - `RESET_TABLE` (dealer-only): Reset table for next hand

### REST API Routes

- **`GET /api/pi/room`** (`src/pages/api/pi/room.ts`)
  - Query params: `serial` (device serial number)
  - Output: `{ tableId: string, type: string, seatNumber?: number, encNonce: string }`
  - Updates `piDevices.lastSeenAt`

- **`POST /api/webhook`** (`src/pages/api/webhook.ts`)
  - LiveKit webhook handler
  - Events:
    - `participant_joined`: Triggers `start-stream` to seat-mapped `card` device
    - `participant_left`: Triggers `stop-stream` to seat-mapped device
    - `room_started`: Triggers `dealer-start-stream`
    - `room_finished`: Triggers stop to all `card` devices and `dealer-stop-stream`

## Card Scanning & Ingestion

### Architecture

The card scanning system uses **AWS SQS FIFO** for reliable, ordered message processing:

1. **Raspberry Pi Scanner** (`raspberrypi/scanner-daemon.ts`)
   - Reads HID barcode scanner device (`/dev/hidraw0` or configured path)
   - Parses barcode to card rank/suit
   - Sends message to SQS FIFO queue with:
     - `MessageGroupId`: Table ID (ensures FIFO ordering per table)
     - `MessageDeduplicationId`: Card code + game ID (prevents duplicates)
     - Body: `{ serial: string, barcode: string, ts: number }`

2. **Ingest Worker** (`lambda/consumer/consumer.ts`)
   - AWS Lambda function triggered by SQS events
   - Processes messages sequentially (maintains FIFO ordering)
   - Validates device registration
   - Calls `dealCard()` from shared game logic
   - Deletes message after successful processing
   - Notifies clients via Pusher

### Card Format

- **Barcode Format**: `{suit}{rank}` (e.g., `1010` = Ace of Spades)
  - Suit: `1`=Spades, `2`=Hearts, `3`=Clubs, `4`=Diamonds
  - Rank: `010`=Ace, `020`=2, ..., `100`=10, `110`=Jack, `120`=Queen, `130`=King
- **Internal Format**: `{rank}{suit}` (e.g., `AS`, `KH`, `2C`, `TD`)
  - Rank: `A`, `2`-`9`, `T`, `J`, `Q`, `K`
  - Suit: `S`=Spades, `H`=Hearts, `C`=Clubs, `D`=Diamonds

### Conversion Functions

- `parseBarcodeToRankSuit(barcode: string)`: Converts barcode to rank/suit
- `parseRankSuitToBarcode(rank: string, suit: string)`: Converts rank/suit to barcode

### SQS Configuration

- **Queue Type**: FIFO (First-In-First-Out)
- **Deduplication**: Content-based
- **MessageGroupId**: Table ID (ensures per-table ordering)
- **MessageDeduplicationId**: `{cardCode}-{gameId}` (prevents duplicate cards)

## Video Streaming

### LiveKit Integration

- **Purpose**: WebRTC-based video streaming for dealer camera and hand cameras
- **Room Naming**: Each table has a LiveKit room (room name = table ID)
- **Participants**:
  - `dealer-camera`: Dealer's camera feed (published by Raspberry Pi)
  - `Your Hand`: Player's hand camera feed (one per seat, published by Raspberry Pi)
  - Browser clients: Subscribe to all feeds

### Encryption & Security

- **RSA Encryption**: Each seat has encrypted nonces stored in database
- **User Nonce**: Encrypted LiveKit room name for user's hand camera
- **Pi Nonce**: Encrypted LiveKit room name for Pi device to publish hand camera
- **Key Generation**: Per-table RSA keypairs generated on join/seat change

### Raspberry Pi Streaming

#### Hand Camera (`raspberrypi/hand-daemon.ts`)

- Listens on Pusher channel `device-{serial}` for `start-stream` / `stop-stream`
- Decrypts `encryptedPiNonce` to get LiveKit room name
- Runs `run_hand.sh` script:
  - Uses `libcamera-vid` to capture H.264 video
  - Publishes via LiveKit CLI: `lk room join --publish h264://...`

#### Dealer Camera (`raspberrypi/dealer-daemon.ts`)

- Listens on Pusher channel `device-{serial}` for `dealer-start-stream` / `dealer-stop-stream`
- Runs `run_dealer.sh` script:
  - Uses GStreamer + x264 for video capture
  - Publishes via LiveKit CLI as `dealer-camera`

### Pusher Signaling

- **Channels**: `device-{serial}` (per-device channels)
- **Events**:
  - `start-stream`: Start hand camera stream for seat
  - `stop-stream`: Stop hand camera stream
  - `dealer-start-stream`: Start dealer camera stream
  - `dealer-stop-stream`: Stop dealer camera stream

## Key Components

### Frontend Components

#### `src/pages/table/[id].tsx`

- Main table view page
- Manages LiveKit room connection
- Handles player actions and game state updates
- Coordinates Pusher subscriptions for real-time updates
- Requests camera and microphone permissions for players on page load
- Conditionally renders desktop or mobile layout based on screen size

#### `src/components/ui/seat-section.tsx`

- Renders 4 seats (left or right side)
- Displays player info, cards, chips, status indicators
- Handles seat selection and movement
- Shows blind indicators and dealer button
- Supports `fullHeight` prop for mobile layouts

#### `src/components/ui/dealer-camera.tsx`

- Dealer camera view with community cards overlay
- Pot and blinds display
- Player action controls (bet, fold, check, raise)
- Dealer controls (deal cards, reset table)
- Responsive sizing: `h-full` on mobile, `aspect-video` on desktop (`lg:` breakpoint)
- Supports `hidePlayerBettingControls` prop to hide controls on mobile (shown in betting tab instead)

#### `src/components/ui/hand-camera.tsx`

- Player's hand camera view
- Connects to encrypted LiveKit room

#### `src/components/ui/quick-actions.tsx`

- Quick betting controls (fold, check, call, raise)
- Disabled when not player's turn

#### `src/components/ui/event-feed.tsx`

- Game event log (card deals, bets, folds, etc.)

### Mobile Components (`src/components/ui/mobile/`)

Mobile-specific components organized in a dedicated folder for landscape mobile devices:

#### `src/components/ui/mobile/table-layout.tsx`

- Wrapper component that conditionally renders desktop or mobile layout
- Uses `useIsMobileLandscape` hook to detect mobile landscape orientation (< 1024px width, width > height)
- Shows "Rotate Device" message for mobile portrait
- Non-invasive architecture - doesn't modify child components

#### `src/components/ui/mobile/table-tabs.tsx`

- Tab navigation for mobile landscape view
- Two tabs: "Dealer" and "Betting"
- Toggle button on left middle of screen that switches between tabs
- Icon changes based on active tab (shows destination tab icon)
- Smooth transitions using Framer Motion

#### `src/components/ui/mobile/betting-view.tsx`

- Mobile betting interface layout
- Top half: All 8 player seats in horizontal scrollable row
- Bottom half: Horizontal scrollable layout with:
  - Community cards (left)
  - Hand camera (middle)
  - Betting controls (right - `VerticalRaiseControls` or `QuickActions`)
- Displays only when player is seated or it's their turn

#### `src/components/ui/mobile/seat-section.tsx`

- Renders all 8 seats horizontally for mobile betting view
- Uses `SeatCard` component with `fullHeight={true}` prop
- Each seat card is half the height of mobile screen
- Scrollable horizontal layout with `overflow-x-auto`

#### `src/components/ui/mobile/community-cards-display.tsx`

- Displays community cards in horizontal row
- Highlights winning cards during showdown
- Extracted from `DealerCamera` for mobile reuse
- Uses Framer Motion for card animations

#### Mobile Hooks

- `src/hooks/use-is-mobile-landscape.ts`: Detects mobile devices in landscape orientation

#### `src/components/ui/media-permissions-modal.tsx`

- Self-contained modal component for requesting camera and microphone permissions
- Automatically shows for players when joining a table (checks if permissions already granted)
- Manages its own state and permission request logic
- Provides "Allow" and "Skip" options
- Explains why permissions are needed and what happens if skipped
- Requests permissions before LiveKit connects
- Allows page to continue loading even if permissions are denied
- LiveKit handles connection gracefully with or without media permissions

### Backend Components

#### `src/server/api/game-logic.ts`

**Core game logic shared between tRPC and ingest worker:**

- `dealCard(tx, tableId, game, cardCode)`: Deals card to seat or community
- `createNewGame(tx, table, seats, previousGame)`: Initializes new hand
- `resetGame(tx, game, seats, resetBalance)`: Resets table for next hand
- `ensureHoleCardsProgression()`: Advances to betting after all hole cards dealt
- `ensurePostflopProgression()`: Starts betting round after flop/turn/river
- `startBettingRound()`: Transitions to BETTING state
- `collectBigAndSmallBlind()`: Collects blinds at game start
- `notifyTableUpdate()`: Sends Pusher event to update clients

#### `src/server/api/hand-solver.ts`

**Poker hand evaluation:**

- `solvePokerHand(cards)`: Evaluates single hand
- `findPokerWinners(hands)`: Determines winners among multiple hands
- `evaluateBettingTransition()`: Checks if betting round should complete
- Uses `pokersolver` library for hand ranking

#### `src/server/api/game-helpers.ts`

**Betting actions and helpers:**

- `executeBettingAction()`: Processes RAISE, CHECK, FOLD actions
- `createSeatTransaction()`: Creates seat with encryption
- `removePlayerSeatTransaction()`: Removes player and refunds
- `triggerBotActions()`: Auto-actions for bot players

#### `src/server/api/blind-timer.ts`

**Blind level management:**

- `computeBlindState(table)`: Calculates effective blinds based on timer
- Supports blind progression over time

### State Management

#### `src/stores/table-store.ts`

- Zustand store for table snapshot
- Updated via `useTableQuery` hook
- Provides reactive state for components

#### `src/hooks/use-table-selectors.ts`

- Selector hooks for computed values:
  - `useTableSnapshot()`: Raw snapshot
  - `usePaddedSeats()`: Seats array padded to maxSeats (for rendering)
  - `useOriginalSeats()`: Actual seats only (for calculations)
  - `useGameState()`: Current game state
  - `useBettingActorSeatId()`: Current player to act
  - `useTotalPot()`: Total pot amount
  - `useCommunityCards()`: Community cards array
  - And more...

## Development Setup

### Prerequisites

- Node.js 20+ and npm
- PostgreSQL database
- AWS account (for SQS FIFO)
- LiveKit server (self-hosted or cloud)
- Pusher account
- Google OAuth credentials (for NextAuth)

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables (see Environment Variables section)
cp env.example .env

# Run database migrations
npm run db:migrate

# Start development server
npm run dev
```

### Database Migrations

```bash
# Generate migration from schema changes
npm run db:generate

# Apply migrations
npm run db:migrate

# Push schema directly (dev only)
npm run db:push

# Open Drizzle Studio (database GUI)
npm run db:studio
```

### Raspberry Pi Setup

```bash
cd raspberrypi
npm install

# Configure environment
cp env.example .env
# Edit .env with device serial, table ID, etc.

# Run daemons (use PM2 or systemd for production)
npm run start
```

### Lambda Consumer Setup

```bash
cd lambda/consumer
npm install

# Configure environment
cp env.example .env

# Deploy to AWS Lambda
npm run deploy
# Or use serverless framework:
serverless deploy
```

## Environment Variables

### Server-Side (`src/env.js`)

```bash
# Authentication
AUTH_SECRET=                    # NextAuth secret (required in production)
AUTH_GOOGLE_ID=                 # Google OAuth client ID
AUTH_GOOGLE_SECRET=             # Google OAuth client secret

# Database
DATABASE_URL=                   # PostgreSQL connection string

# LiveKit
LIVEKIT_URL=                    # LiveKit server URL
LIVEKIT_API_KEY=                # LiveKit API key
LIVEKIT_API_SECRET=             # LiveKit API secret

# Pusher
PUSHER_APP_ID=                  # Pusher app ID
PUSHER_KEY=                     # Pusher key
PUSHER_SECRET=                  # Pusher secret
PUSHER_CLUSTER=                 # Pusher cluster (e.g., "us2")

# AWS SQS
AWS_REGION=                     # AWS region (e.g., "us-east-1")
AWS_ACCESS_KEY_ID=              # AWS access key
AWS_SECRET_ACCESS_KEY=          # AWS secret key
SQS_QUEUE_URL=                  # SQS FIFO queue URL

# Environment
NODE_ENV=development            # development | test | production
```

### Client-Side

```bash
NEXT_PUBLIC_PUSHER_KEY=         # Pusher public key
NEXT_PUBLIC_PUSHER_CLUSTER=     # Pusher cluster
```

### Raspberry Pi (`raspberrypi/.env`)

```bash
SCANNER_DEVICE=/dev/hidraw0     # HID barcode scanner device path
SQS_QUEUE_URL=                  # SQS FIFO queue URL
AWS_REGION=                     # AWS region
AWS_ACCESS_KEY_ID=              # AWS access key (for Pi device)
AWS_SECRET_ACCESS_KEY=          # AWS secret key
PUSHER_APP_ID=                  # Pusher app ID
PUSHER_KEY=                     # Pusher key
PUSHER_SECRET=                  # Pusher secret
PUSHER_CLUSTER=                 # Pusher cluster
LIVEKIT_URL=                    # LiveKit server URL
LIVEKIT_API_KEY=                # LiveKit API key
LIVEKIT_API_SECRET=             # LiveKit API secret
```

## Testing

```bash
# Run tests with database
npm test

# Type checking
npm run typecheck

# Linting
npm run lint

# Format checking
npm run format:check
```

## Deployment

### Next.js Application

Deploy to Vercel, Railway, or any Node.js hosting:

```bash
npm run build
npm start
```

### Lambda Consumer

Deploy using Serverless Framework:

```bash
cd lambda/consumer
serverless deploy
```

Or use AWS SAM, CDK, or direct Lambda deployment.

### Database

Use managed PostgreSQL (AWS RDS, Railway, Supabase, etc.) or self-hosted.

### Infrastructure Checklist

- [ ] PostgreSQL database with connection string
- [ ] AWS SQS FIFO queue created
- [ ] AWS IAM credentials for SQS access
- [ ] LiveKit server running (or cloud account)
- [ ] Pusher app created
- [ ] Google OAuth app configured
- [ ] Environment variables set in hosting platform
- [ ] Lambda function deployed (or always-on worker)
- [ ] Raspberry Pi devices configured and running

## Project Structure

```
huffle-shuffle/
├── src/
│   ├── app/                    # Next.js app router (API routes)
│   ├── components/             # React components
│   │   ├── ui/                 # UI components (seats, cards, etc.)
│   │   │   ├── mobile/         # Mobile-specific components
│   │   │   │   ├── betting-view.tsx
│   │   │   │   ├── community-cards-display.tsx
│   │   │   │   ├── seat-section.tsx
│   │   │   │   ├── table-layout.tsx
│   │   │   │   ├── table-tabs.tsx
│   │   │   │   └── index.ts
│   │   │   └── ...
│   │   ├── livekit/            # LiveKit-specific components
│   │   └── table-setup/        # Table configuration modals
│   ├── hooks/                  # React hooks
│   │   ├── use-table-selectors.ts  # Table state selectors
│   │   ├── use-table-query.ts     # Table data fetching
│   │   ├── use-is-mobile-landscape.ts  # Mobile landscape detection
│   │   └── ...
│   ├── pages/                  # Next.js pages
│   │   └── table/[id].tsx     # Main table view
│   ├── server/
│   │   ├── api/
│   │   │   ├── routers/        # tRPC routers
│   │   │   │   └── table.ts    # Table router
│   │   │   ├── game-logic.ts   # Shared game logic
│   │   │   ├── game-utils.ts   # Game utilities
│   │   │   ├── hand-solver.ts  # Poker hand evaluation
│   │   │   └── game-helpers.ts # Betting helpers
│   │   ├── db/
│   │   │   └── schema.ts       # Drizzle schema
│   │   ├── livekit.ts          # LiveKit client
│   │   └── signal.ts           # Pusher signaling
│   ├── stores/                 # Zustand stores
│   ├── utils/                  # Utility functions
│   └── types/                  # TypeScript types
├── raspberrypi/                # Raspberry Pi daemons
│   ├── scanner-daemon.ts       # Card scanner
│   ├── hand-daemon.ts          # Hand camera
│   ├── dealer-daemon.ts        # Dealer camera
│   └── ...
├── lambda/
│   └── consumer/               # AWS Lambda consumer
│       └── consumer.ts         # SQS message processor
├── drizzle/                    # Database migrations
└── public/                     # Static assets
```

## Mobile Support

### Mobile Landscape Layout

The application supports mobile landscape orientation (< 1024px width, width > height) with a dedicated mobile layout:

- **Tab-based Navigation**: Two tabs accessible via toggle button (left middle)
  - **Dealer Tab**: Full-screen dealer camera view
  - **Betting Tab**: Split view with player seats (top), community cards/hand camera/betting controls (bottom)
- **Responsive Components**:
  - Dealer camera uses `h-full` on mobile, `aspect-video` on desktop
  - Seat cards support `fullHeight` prop for mobile layouts
  - Betting controls extracted to separate component, hidden in dealer tab on mobile
- **Non-invasive Architecture**: Mobile components don't modify desktop components
- **Portrait Mode**: Shows "Rotate Device" message (only landscape supported)

### Mobile Component Organization

All mobile-specific components are organized in `src/components/ui/mobile/`:

- Centralized location for easier maintenance
- Clean separation from desktop components
- Shared index file for convenient imports

### Mobile Considerations

- Tooltips hidden on mobile to prevent Portal positioning issues
- Horizontal scrolling for seats and betting controls when content overflows
- Full-height seat cards on mobile (half screen height)
- Vertical raise controls only shown in betting tab on mobile

## Key Design Decisions

1. **Shared Game Logic**: `game-logic.ts` is used by both tRPC API and Lambda consumer to ensure consistency
2. **SQS FIFO**: Chosen over AMQP for cost-effectiveness (95% cost reduction) and simpler architecture
3. **RSA Encryption**: Per-table keypairs for securing LiveKit room names
4. **State Machine**: Explicit game states with clear transitions
5. **Side Pots**: JSONB storage for complex side pot calculations
6. **Redaction**: Cards hidden from other players except in SHOWDOWN
7. **Zustand Store**: Lightweight state management for table snapshot
8. **Selector Hooks**: Computed values derived from store for performance
9. **Mobile-first Responsive Design**: Separate mobile components with conditional rendering, maintaining desktop functionality

## Common Tasks

### Adding a New Game Action

1. Add action type to `ActionType` enum in `table.ts`
2. Add handler in `tableRouter.action` mutation
3. Implement logic in `game-helpers.ts` or `game-logic.ts`
4. Update frontend components to trigger action

### Adding a New Database Field

1. Update schema in `src/server/db/schema.ts`
2. Generate migration: `npm run db:generate`
3. Review migration in `drizzle/` directory
4. Apply migration: `npm run db:migrate`

### Debugging Card Scanning

1. Check Raspberry Pi logs: `pm2 logs scanner-daemon`
2. Check SQS queue messages in AWS Console
3. Check Lambda logs: `serverless logs -f consumer`
4. Verify device registration in database: `SELECT * FROM pi_devices WHERE serial = '...'`

### Testing Without Hardware

Use test mode in scanner daemon or send test messages directly to SQS queue.

## Contributing

When contributing to this project:

1. Follow TypeScript best practices
2. Use Drizzle ORM for all database operations
3. Keep game logic in `game-logic.ts` (shared between API and consumer)
4. Update this README if adding new features
5. Write tests for game logic changes
6. Ensure state machine transitions are valid
7. Handle edge cases (all-in players, eliminated players, etc.)

## License

[Add license information]
