# HuffleShuffle Raspberry Pi Setup

This directory contains the Raspberry Pi daemon components for the HuffleShuffle poker system.

## Quick Setup

1. **Run the setup script as root:**

   ```bash
   sudo ./setup.sh
   ```

2. **Create environment file:**

   ```bash
   cp env.example .env
   # Edit .env with your actual configuration values
   ```

3. **Start the service:**
   ```bash
   sudo systemctl start huffle-shuffle
   ```

## Auto-Startup Configuration

The systemd service (`huffle-shuffle.service`) is configured to:

- **Automatically start on boot**
- **Download/update the repository** from GitHub on every boot
- **Wait for network connectivity** before attempting to connect
- **Run the generic daemon** which determines the device type and launches the appropriate daemon
- **Restart automatically** if the daemon crashes

## Service Management

```bash
# Check service status
sudo systemctl status huffle-shuffle

# Start the service
sudo systemctl start huffle-shuffle

# Stop the service
sudo systemctl stop huffle-shuffle

# Restart the service
sudo systemctl restart huffle-shuffle

# View logs
sudo journalctl -u huffle-shuffle -f

# Disable auto-startup
sudo systemctl disable huffle-shuffle

# Enable auto-startup
sudo systemctl enable huffle-shuffle
```

## Daemon Types

The generic daemon automatically determines which type of daemon to run based on the Pi's device configuration:

- **dealer**: Runs dealer camera streaming daemon
- **card**: Runs hand camera streaming daemon
- **scanner**: Runs card scanner daemon with AWS SQS integration

## Environment Configuration

Required environment variables (see `env.example`):

- `API_BASE_URL`: Base URL of the HuffleShuffle API
- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`: LiveKit video streaming configuration
- `PUSHER_*`: Pusher real-time messaging configuration
- `SQS_QUEUE_URL`, `AWS_REGION`: AWS SQS configuration for scanner daemon

## Logs

- **Service logs**: `sudo journalctl -u huffle-shuffle -f`
- **Application logs**: `/home/pi/huffle-shuffle.log`
- **Repository location**: `/home/pi/huffle-shuffle/`

## Troubleshooting

1. **Service won't start**: Check logs with `sudo journalctl -u huffle-shuffle`
2. **Network issues**: The startup script waits up to 60 seconds for network connectivity
3. **Repository update fails**: Ensure GitHub is accessible and the repository URL is correct
4. **Environment issues**: Verify `.env` file exists and contains all required variables

## Manual Operation

If you need to run the daemon manually without the systemd service:

```bash
cd /home/pi/huffle-shuffle/raspberrypi
npm run start
```
