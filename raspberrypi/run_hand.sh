#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Optionally load .env (LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
if [[ -f "$SCRIPT_DIR/.env" ]]; then
  set -a; source "$SCRIPT_DIR/.env"; set +a
fi

# Config
ROOM_NAME="huffle-shuffle"
IDENTITY="rover-camera"
HOST="127.0.0.1"
PORT="5000"
LOG_FILE="$SCRIPT_DIR/camera.log"

# Ensure tools
if ! command -v libcamera-vid >/dev/null 2>&1; then
  echo "libcamera-vid not found; attempting to install libcamera-apps..." >&2
  if command -v apt-get >/dev/null 2>&1 || command -v apt >/dev/null 2>&1; then
    if command -v sudo >/dev/null 2>&1; then
      sudo apt-get update || sudo apt update || true
      sudo apt-get install -y libcamera-apps || sudo apt install -y libcamera-apps || true
    else
      apt-get update || apt update || true
      apt-get install -y libcamera-apps || apt install -y libcamera-apps || true
    fi
  fi
fi

if ! command -v libcamera-vid >/dev/null 2>&1; then
  echo "libcamera-vid still not found. Please install 'libcamera-apps' and re-run." >&2
  exit 1
fi

command -v lk >/dev/null 2>&1 || { echo "Please Install LiveKit CLI: curl -sSL https://get.livekit.io/cli | bash" >&2; exit 1; }

# Start camera → H.264 TCP
rm -f "$LOG_FILE"
libcamera-vid -n --inline -t 0 \
  --width 1280 --height 720 --framerate 30 \
  --codec h264 --profile baseline \
  --listen -o "tcp://$HOST:$PORT" \
  >"$LOG_FILE" 2>&1 &
VID_PID=$!

cleanup() { kill "$VID_PID" >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM

# Wait for TCP listener (up to ~10s)
for _ in $(seq 1 100); do
  if command -v ss >/dev/null 2>&1 && ss -ltn | grep -q ":$PORT\b"; then break; fi
  if command -v netstat >/dev/null 2>&1 && netstat -ltn 2>/dev/null | grep -q ":$PORT\b"; then break; fi
  sleep 0.1
done

# Join and publish
exec lk ${LIVEKIT_URL:+--url "$LIVEKIT_URL"} \
       ${LIVEKIT_API_KEY:+--api-key "$LIVEKIT_API_KEY"} \
       ${LIVEKIT_API_SECRET:+--api-secret "$LIVEKIT_API_SECRET"} \
       room join --identity "$IDENTITY" \
       --publish "h264://$HOST:$PORT" \
       "$ROOM_NAME"