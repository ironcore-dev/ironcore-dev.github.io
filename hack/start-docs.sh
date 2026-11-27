#!/usr/bin/env bash

# Install dependencies
npm ci

# Enable file polling: inotify events from macOS host edits do not reach the container through
# Docker Desktop's bind mount, so live-reload only works with chokidar's polling watcher.
#
# Note on Linux polling is not required and these exports could be guarded to macOS. However, for
# simplicity, keeping it uniform.
export CHOKIDAR_USEPOLLING=true
export CHOKIDAR_INTERVAL=2000

# Run VitePress dev server
npx vitepress dev docs --host 0.0.0.0 &

# Store the PID of the VitePress process
VITEPRESS_PID=$!

# Function to handle SIGINT (Ctrl+C)
handle_sigint() {
    echo "Stopping VitePress dev server..."
    kill -TERM "$VITEPRESS_PID"
    wait "$VITEPRESS_PID"
    exit 0
}

# Trap SIGINT and call the handle_sigint function
trap handle_sigint SIGINT

# Wait for the VitePress process to finish
wait "$VITEPRESS_PID"
