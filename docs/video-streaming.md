# Video Streaming

## LiveKit Integration

- **Purpose**: WebRTC-based video streaming for dealer camera and hand cameras
- **Room Naming**: Each table has a LiveKit room (room name = table ID)
- **Participants**:
  - `dealer-camera`: Dealer's camera feed (published by Raspberry Pi)
  - `Your Hand`: Player's hand camera feed (one per seat, published by Raspberry Pi)
  - Browser clients: Subscribe to all feeds

## Encryption & Security

- **RSA Encryption**: Each seat has encrypted nonces stored in database
- **User Nonce**: Encrypted LiveKit room name for user's hand camera
- **Pi Nonce**: Encrypted LiveKit room name for Pi device to publish hand camera
- **Key Generation**: Per-table RSA keypairs generated on join/seat change

## Raspberry Pi Streaming

### Hand Camera (`raspberrypi/hand-daemon.ts`)

- Listens on Pusher channel `device-{serial}` for `start-stream` / `stop-stream`
- Decrypts `encryptedPiNonce` to get LiveKit room name
- Runs `run_hand.sh` script:
  - Uses `libcamera-vid` to capture H.264 video
  - Publishes via LiveKit CLI: `lk room join --publish h264://...`

### Dealer Camera (`raspberrypi/dealer-daemon.ts`)

- Listens on Pusher channel `device-{serial}` for `dealer-start-stream` / `dealer-stop-stream`
- Runs `run_dealer.sh` script:
  - Uses GStreamer + x264 for video capture
  - Publishes via LiveKit CLI as `dealer-camera`

## Pusher Signaling

- **Channels**: `device-{serial}` (per-device channels)
- **Events**:
  - `start-stream`: Start hand camera stream for seat
  - `stop-stream`: Stop hand camera stream
  - `dealer-start-stream`: Start dealer camera stream
  - `dealer-stop-stream`: Stop dealer camera stream
