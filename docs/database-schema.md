# Database Schema

## Core Tables

### `users` (huffle-shuffle_user)

- `id`: UUID primary key
- `email`: User email (unique)
- `name`: Display name
- `role`: Enum (`player` | `dealer`)
- `balance`: Integer (non-negative, default 100000)
- `publicKey`: Optional RSA public key for encryption

### `pokerTables` (huffle-shuffle_poker_table)

- `id`: UUID primary key
- `name`: Table name
- `dealerId`: Foreign key to users (nullable, unique)
- `smallBlind`: Integer
- `bigBlind`: Integer
- `maxSeats`: Integer (default 8)

### `seats` (huffle-shuffle_seat)

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
- `voluntaryShow`: Boolean (player opted to reveal hand at showdown; default false)

### `games` (huffle-shuffle_game)

- `id`: UUID primary key
- `tableId`: Foreign key to pokerTables
- `state`: Enum (see [Game state machine](./game-state-machine.md))
- `dealerButtonSeatId`: Foreign key to seats
- `assignedSeatId`: Foreign key to seats (current player to act)
- `communityCards`: Text array (flop, turn, river)
- `potTotal`: Integer (total pot amount)
- `sidePots`: JSONB array `[{amount: number, eligibleSeatIds: string[]}]`
- `betCount`: Integer (current betting round action count)
- `requiredBetCount`: Integer (actions needed to complete round)
- `effectiveSmallBlind`: Integer (computed at game start)
- `effectiveBigBlind`: Integer (computed at game start)
- `lastRaiseIncrement`: Integer (min raise increment for current betting round; TDA rule)
- `turnStartTime`: Timestamp (when current player's turn started)
- `isCompleted`: Boolean
- `wasReset`: Boolean (true if game was reset via RESET_TABLE action; prevents button advancement on next game)

### `piDevices` (huffle-shuffle_pi_device)

- `serial`: String primary key (device serial number)
- `tableId`: Foreign key to pokerTables
- `type`: Enum (`scanner` | `dealer` | `card` | `button`)
- `seatNumber`: Integer (nullable, for `card` type devices)
- `publicKey`: Text (RSA public key for encryption)
- `lastSeenAt`: Timestamp

## Enums

- `user_role`: `player`, `dealer`
- `game_state`: `INITIAL`, `GAME_START`, `DEAL_HOLE_CARDS`, `BETTING`, `DEAL_FLOP`, `DEAL_TURN`, `DEAL_RIVER`, `SHOWDOWN`, `RESET_TABLE`
- `pi_device_type`: `scanner`, `dealer`, `card`, `button`
- `seat_status`: `active`, `folded`, `all-in`, `eliminated`
- `last_action`: `fold`, `check`, `call`, `raise`, `all-in`
