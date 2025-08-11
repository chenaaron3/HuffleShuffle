#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Optionally load .env (LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
if [[ -f "$SCRIPT_DIR/.env" ]]; then
  set -a; source "$SCRIPT_DIR/.env"; set +a
fi

# Config
ROOM_NAME="huffle-shuffle"
IDENTITY="dealer-camera"
HOST="127.0.0.1"
PORT="6000"
LOG_FILE="$SCRIPT_DIR/dealer_gst.log"
DEV="${V4L2_DEVICE:-/dev/video0}"

# Ensure tools
need_install=false
command -v gst-launch-1.0 >/dev/null 2>&1 || need_install=true
command -v v4l2-ctl >/dev/null 2>&1 || need_install=true
command -v lk >/dev/null 2>&1 || echo "Install LiveKit CLI: curl -sSL https://get.livekit.io/cli | bash" >&2

if $need_install; then
  echo "Installing GStreamer and v4l2 utilities..." >&2
  if command -v sudo >/dev/null 2>&1; then
    sudo apt-get update || sudo apt update || true
    sudo apt-get install -y \
      gstreamer1.0-tools gstreamer1.0-libav \
      gstreamer1.0-plugins-base gstreamer1.0-plugins-good \
      gstreamer1.0-plugins-bad gstreamer1.0-plugins-ugly \
      v4l-utils || true
  else
    apt-get update || apt update || true
    apt-get install -y \
      gstreamer1.0-tools gstreamer1.0-libav \
      gstreamer1.0-plugins-base gstreamer1.0-plugins-good \
      gstreamer1.0-plugins-bad gstreamer1.0-plugins-ugly \
      v4l-utils || true
  fi
fi

command -v gst-launch-1.0 >/dev/null 2>&1 || { echo "gst-launch-1.0 not found" >&2; exit 1; }
command -v v4l2-ctl >/dev/null 2>&1 || { echo "v4l2-ctl not found" >&2; exit 1; }
command -v lk >/dev/null 2>&1 || { echo "lk not found" >&2; exit 1; }

echo "Using V4L2 device: $DEV" >&2

# Pre-configure device for stability (best-effort)
v4l2-ctl -d "$DEV" --set-fmt-video=width=1920,height=1080,pixelformat=YUYV || true
v4l2-ctl -d "$DEV" --set-parm=30 || true

# Start GStreamer H.264 over TCP
rm -f "$LOG_FILE"

PIPELINE="v4l2src device=$DEV ! \
  videoconvert ! videoscale ! videorate ! \
  video/x-raw,format=I420,width=1280,height=720,framerate=30/1 ! \
  x264enc tune=zerolatency speed-preset=ultrafast bitrate=3000 key-int-max=60 \
    byte-stream=true aud=true bframes=0 sliced-threads=false threads=1 sync-lookahead=0 ! \
  h264parse config-interval=-1 ! \
  video/x-h264,stream-format=byte-stream,alignment=au ! \
  tcpserversink host=$HOST port=$PORT sync=false recover-policy=keyframe"

echo "Starting GStreamer pipeline..." >&2
sh -c "gst-launch-1.0 -v $PIPELINE" >"$LOG_FILE" 2>&1 &
GST_PID=$!

cleanup() { kill "$GST_PID" >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM

# Wait for listener (up to ~15s)
for _ in $(seq 1 150); do
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


