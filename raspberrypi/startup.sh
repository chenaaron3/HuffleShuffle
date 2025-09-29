#!/bin/bash
set -euo pipefail

# HuffleShuffle Raspberry Pi Startup Script
# This script downloads/updates the repository and runs the generic daemon

REPO_URL="https://github.com/chenaaron3/HuffleShuffle.git"
REPO_DIR="/home/pi/huffle-shuffle"
RASPBERRYPI_DIR="$REPO_DIR/raspberrypi"
LOG_FILE="$RASPBERRYPI_DIR/startup.log"

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to wait for network connectivity
wait_for_network() {
    log "Waiting for network connectivity..."
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if ping -c 1 github.com >/dev/null 2>&1; then
            log "Network connectivity confirmed"
            return 0
        fi
        log "Network not ready, attempt $((attempt + 1))/$max_attempts"
        sleep 2
        ((attempt++))
    done
    
    log "ERROR: Network connectivity timeout after $max_attempts attempts"
    exit 1
}

# Function to clone or update repository
setup_repository() {
    log "Setting up repository..."
    
    if [ -d "$REPO_DIR" ]; then
        log "Repository exists, updating..."
        cd "$REPO_DIR"
        
        # Check if we're in a git repository
        if [ -d ".git" ]; then
            # Fetch latest changes and reset to main branch
            git fetch origin
            git reset --hard origin/main
            git clean -fd
            log "Repository updated to latest main branch"
        else
            log "ERROR: Directory exists but is not a git repository"
            exit 1
        fi
    else
        log "Cloning repository for the first time..."
        git clone "$REPO_URL" "$REPO_DIR"
        log "Repository cloned successfully"
    fi
}

# Function to install dependencies
install_dependencies() {
    log "Installing Node.js dependencies..."
    cd "$RASPBERRYPI_DIR"
    
    # Install dependencies if package.json exists
    if [ -f "package.json" ]; then
        # Ensure devDependencies are installed even if NODE_ENV=production
        # Prefer ci, but fall back to install if lockfile is out of date
        if ! npm ci --no-audit --no-fund --include=dev; then
            log "npm ci failed (likely lockfile mismatch); running npm install..."
            npm_config_production=false npm install --no-audit --no-fund
        fi
        # Ensure tsx is present locally for runtime
        if [ ! -x "$RASPBERRYPI_DIR/node_modules/.bin/tsx" ]; then
            log "tsx not found; installing as devDependency..."
            npm_config_production=false npm install --no-audit --no-fund --save-dev tsx@^4
        fi
        log "Dependencies installed successfully"
    else
        log "ERROR: package.json not found in raspberrypi directory"
        exit 1
    fi
}

# (no build step required when using tsx)

# Function to check environment file
check_environment() {
    log "Checking environment configuration..."
    
    local env_file="$RASPBERRYPI_DIR/.env"
    if [ ! -f "$env_file" ]; then
        log "WARNING: .env file not found at $env_file"
        log "Please create the .env file with required configuration"
        log "See env.example for reference"
        exit 1
    fi
    
    log "Environment file found"
}

# Function to check scanner device access (for scanner type devices)
check_scanner_device() {
    log "Checking scanner device access..."
    
    local device="${SCANNER_DEVICE:-/dev/hidraw0}"
    if [ ! -e "$device" ]; then
        log "WARNING: Scanner device $device not found"
        log "Available HID devices:"
        ls -la /dev/hidraw* 2>/dev/null || log "No HID devices found"
        return 0  # Don't exit, as this might not be a scanner device
    fi
    
    if [ -r "$device" ] && [ -w "$device" ]; then
        log "Scanner device $device is accessible (read/write)"
    else
        log "WARNING: Scanner device $device is not accessible (need rw permissions)"
        log "Device permissions: $(ls -la "$device" 2>/dev/null || echo 'not found')"
        log "Make sure udev rules are properly installed and device is connected"
        return 0  # Don't exit, as this might not be a scanner device
    fi
}

# Function to run the daemon
run_daemon() {
    log "Starting HuffleShuffle generic daemon..."
    cd "$RASPBERRYPI_DIR"
    
    # Prefer running via local tsx to avoid ESM build path issues
    export PATH="$RASPBERRYPI_DIR/node_modules/.bin:$PATH"
    local tsx_bin="$RASPBERRYPI_DIR/node_modules/.bin/tsx"
    if [ -x "$tsx_bin" ]; then
        exec "$tsx_bin" "$RASPBERRYPI_DIR/generic-daemon.ts"
    else
        # Fallback: try npx (shouldn't normally be needed)
        if command -v npx >/dev/null 2>&1; then
            exec npx tsx "$RASPBERRYPI_DIR/generic-daemon.ts"
        else
            log "ERROR: tsx not found. Ensure devDependencies are installed."
            exit 1
        fi
    fi
}

# Main execution
main() {
    log "Starting HuffleShuffle Raspberry Pi daemon setup"
    
    # Wait for network connectivity
    wait_for_network
    
    # Setup repository
    setup_repository
    
    # Install dependencies
    install_dependencies
    
    # Check environment
    check_environment
    
    # Check scanner device access (if applicable)
    check_scanner_device
    
    # Run the daemon
    run_daemon
}

# Handle script termination
cleanup() {
    log "Shutting down HuffleShuffle daemon"
    exit 0
}

# Set up signal handlers
trap cleanup SIGTERM SIGINT

# Run main function
main "$@"
