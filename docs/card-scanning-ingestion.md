# Card Scanning & Ingestion

## Architecture

The card scanning system uses **AWS SQS FIFO** for reliable, ordered message processing:

1. **Raspberry Pi Scanner** (`raspberrypi/scanner-daemon.ts`)
   - Reads HID barcode scanner device (`/dev/hidraw0` or configured path)
   - Buffers keypresses until Enter (`0x28`); on HID **read error**, the buffer is discarded so a bad partial read cannot be glued to the next scan
   - **Strict**: only publishes when the trimmed scan line is exactly a valid four-digit card barcode (same validity rules as `parseBarcodeToRankSuit`); anything else is **dropped** (no extraction from longer strings) so bad reads never become deals
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

## Card Format

- **Barcode Format**: `{suit}{rank}` (e.g., `1010` = Ace of Spades)
  - Suit: `1`=Spades, `2`=Hearts, `3`=Clubs, `4`=Diamonds
  - Rank: `010`=Ace, `020`=2, ..., `100`=10, `110`=Jack, `120`=Queen, `130`=King
- **Internal Format**: `{rank}{suit}` (e.g., `AS`, `KH`, `2C`, `TD`)
  - Rank: `A`, `2`-`9`, `T`, `J`, `Q`, `K`
  - Suit: `S`=Spades, `H`=Hearts, `C`=Clubs, `D`=Diamonds

## Conversion Functions

- `parseBarcodeToRankSuit(barcode: string)`: Converts barcode to rank/suit
- `parseRankSuitToBarcode(rank: string, suit: string)`: Converts rank/suit to barcode

## SQS Configuration

- **Queue Type**: FIFO (First-In-First-Out)
- **Deduplication**: Content-based
- **MessageGroupId**: Table ID (ensures per-table ordering)
- **MessageDeduplicationId**: `{cardCode}-{gameId}` (prevents duplicate cards)
