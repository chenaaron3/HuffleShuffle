#!/usr/bin/env bash
set -euo pipefail

echo "[setup] Starting Raspberry Pi setup for HuffleShuffle dealer daemon"
echo "[setup] Running as pi user - will use sudo only when needed"

# Check if running as pi user
if [[ $EUID -eq 0 ]]; then
  echo "[setup] WARNING: Running as root. Please run as pi user instead." >&2
  echo "[setup] Use: su - pi, then run this script" >&2
  exit 1
fi

# Update package lists
echo "[setup] Updating package lists..."
sudo apt-get update -y || true

echo "[setup] Installing system dependencies (curl, jq, libcamera-apps, nodejs)"
sudo apt-get install -y curl ca-certificates gnupg jq || true

if ! command -v libcamera-vid >/dev/null 2>&1; then
  sudo apt-get install -y libcamera-apps || true
fi

# Install Node.js (using NodeSource for current LTS)
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
  sudo apt-get install -y nodejs
fi

echo "[setup] Installing LiveKit CLI"
if ! command -v lk >/dev/null 2>&1; then
  bash -lc "curl -sSL https://get.livekit.io/cli | bash"
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "[setup] Installing local Node dependencies (dealer + hand)"
npm install --no-audit --no-fund || true

echo "[setup] Setting up udev rules for scanner device access"
# Copy udev rules for scanner device access
sudo cp 99-huffle-scanner.rules /etc/udev/rules.d/

# Reload udev rules
sudo udevadm control --reload-rules
sudo udevadm trigger

# Add pi user to necessary groups
sudo usermod -a -G input pi

echo "[setup] Setting up systemd service for auto-startup"
# Make startup script executable
chmod +x startup.sh

# Copy systemd service file
sudo cp huffle-shuffle.service /etc/systemd/system/

# Reload systemd and enable service
sudo systemctl daemon-reload
sudo systemctl enable huffle-shuffle.service

echo "[setup] HuffleShuffle systemd service installed and enabled"
echo "[setup] The service will start automatically on boot"
echo "[setup] To start the service now: sudo systemctl start huffle-shuffle"
echo "[setup] To check service status: sudo systemctl status huffle-shuffle"
echo "[setup] To view logs: sudo journalctl -u huffle-shuffle -f"
