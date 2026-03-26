# API Routes & Endpoints

## tRPC Router: `tableRouter` (`src/server/api/routers/table.ts`)

### Queries

- **`livekitToken`**: Generate LiveKit JWT token for table room
  - Input: `{ tableId: string, roomName?: string }`
  - Output: `{ token: string, serverUrl: string }`
  - Auth: Must be seated player or dealer at table

- **`list`**: List all poker tables
  - Output: Array of table summaries with `isJoinable`, `availableSeats`, `playerCount`

- **`get`**: Get table snapshot (redacted for caller)
  - Input: `{ tableId: string }`
  - Output: `TableSnapshot` (see types below)
  - Redaction: Hides other players' cards unless in SHOWDOWN or all players are all-in
  - Each seat includes `cardsVisibleToOthers` (computed): true if this seat's cards are visible to other players

### Mutations

- **`create`**: Create new poker table (dealer-only)
  - Input: `{ name: string, smallBlind: number, bigBlind: number, maxSeats?: number }`
  - Output: `{ tableId: string }`

- **`dealerJoin`**: Assign dealer to existing table (dealer-only)
  - Input: `{ tableId: string }`
  - Side effects: Overwrites existing dealer if table already has one; allows dealer to switch from another table

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
    - `DEAL_RANDOM` (dealer-only): Deal a random card that hasn't been dealt yet (has access to all player hands and community cards for true randomness)
    - `RAISE`: Raise to total amount (validated: must meet min re-raise rule)
    - `CHECK`: Check (no bet increase)
    - `FOLD`: Fold hand
    - `VOLUNTEER_SHOW`: Reveal hand at showdown (when folded or single winner; only during SHOWDOWN)
    - `RESET_TABLE` (dealer-only): Reset table for next hand (marks game with `wasReset` flag; prevents button advancement on next game start)

## REST API Routes

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
