#!/bin/bash

# Set error handling
set -e

# Function to handle exit
function cleanup {
  echo "Stopping servers..."
  if [ ! -z "$CLIENT_PID" ]; then
    kill $CLIENT_PID 2>/dev/null || true
  fi
  if [ ! -z "$SERVER_PID" ]; then
    kill $SERVER_PID 2>/dev/null || true
  fi
  exit
}

# Function to kill process running on a specific port
function kill_port {
  local PORT=$1
  local PID=$(lsof -t -i:$PORT)
  if [ ! -z "$PID" ]; then
    echo "Killing process on port $PORT (PID: $PID)..."
    kill -9 $PID 2>/dev/null || true
  fi
}

# Trap SIGINT (Ctrl+C) and EXIT
trap cleanup SIGINT EXIT

# Kill any existing servers
echo "Checking for existing servers..."
kill_port 3000  # Client port
kill_port 3001  # Server port
kill_port 3002  # Possible alternative port
kill_port 3003  # Possible alternative port
kill_port 8080  # Preview port

echo "Starting development servers..."

# Start the server development server
echo "Starting server..."
cd server
npm run dev &
SERVER_PID=$!
sleep 2  # Give the server a moment to start

# Start the client development server
echo "Starting client..."
cd ../client
npm run dev &
CLIENT_PID=$!

echo "Development servers started"
echo "Client running at http://localhost:3000"
echo "Server running at http://localhost:3001"
echo "Press Ctrl+C to stop both servers"

# Check if servers are running
sleep 3
if ps -p $SERVER_PID > /dev/null; then
  echo "Server is running (PID: $SERVER_PID)"
else
  echo "Warning: Server may have failed to start. Check logs above."
fi

if ps -p $CLIENT_PID > /dev/null; then
  echo "Client is running (PID: $CLIENT_PID)"
else
  echo "Warning: Client may have failed to start. Check logs above."
fi

# Wait for both processes
wait
