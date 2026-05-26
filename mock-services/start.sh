#!/usr/bin/env bash
#
# Start both mock external-dependency services (Repository Registry :4001 and
# VM Order Service :4002). Installs dependencies on first run.
#
# Usage: ./mock-services/start.sh
set -euo pipefail

# Resolve to this script's directory so it works from anywhere.
cd "$(dirname "$0")"

# Free the ports if something is already listening (e.g. a previous run).
if lsof -ti:4001,4002 >/dev/null 2>&1; then
  echo "Stopping existing processes on ports 4001/4002..."
  lsof -ti:4001,4002 | xargs kill 2>/dev/null || true
  sleep 1
fi

# Install dependencies on first run.
if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install
fi

echo "Starting mock services (Ctrl+C to stop)..."
echo "  Repository Registry → http://localhost:4001/docs"
echo "  VM Order Service    → http://localhost:4002/docs"
exec npm start
