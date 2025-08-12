#!/usr/bin/env bash
set -euo pipefail

echo "[setup] Starting Raspberry Pi setup for HuffleShuffle dealer daemon"

if [[ $EUID -ne 0 ]]; then
  echo "[setup] Please run as root (use sudo)" >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -y || true

echo "[setup] Installing system dependencies (curl, libcamera-apps, gstreamer, nodejs)"
apt-get install -y curl ca-certificates gnupg || true

if ! command -v libcamera-vid >/dev/null 2>&1; then
  apt-get install -y libcamera-apps || true
fi

# Install Node.js (using NodeSource for current LTS)
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

echo "[setup] Installing LiveKit CLI"
if ! command -v lk >/dev/null 2>&1; then
  bash -lc "curl -sSL https://get.livekit.io/cli | bash"
fi

echo "[setup] Installing PM2 to manage the daemon"
npm i -g pm2 >/dev/null 2>&1 || true

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "[setup] Installing local Node dependencies"
npm install --no-audit --no-fund || true

echo "[setup] Launching dealer daemon with PM2 (tsx runtime)"
pm2 start npm --name huffle-dealer -- run dev
pm2 save

echo "[setup] Setup complete. Use 'pm2 logs huffle-dealer' to view logs."

