#!/bin/bash
set -e

# === Configuration ===
BACKEND_PORT=5001
FRONTEND_PORT=5173   # <-- Updated port
MONGO_ENABLED=true
MONGO_CONTAINER_NAME=netman_mongo
BACKUP_FOLDER="./mongo_backups"
IMAGE_PULL=true
LOG_FILE="setup.log"
# ======================

# Logging to file
exec > >(tee "$LOG_FILE") 2>&1

echo "Starting silent setup..."

# Check Docker
if ! command -v docker &>/dev/null; then
  echo "Docker not found. Please install Docker manually on Linux/macOS."
  exit 1
fi

# Check Docker Compose
if ! command -v docker-compose &>/dev/null; then
  echo "docker-compose not found. Please install it."
  exit 1
fi

# Check internet
echo "Checking internet connection..."
ping -c 1 google.com &>/dev/null || { echo "No internet connection"; exit 1; }

# Check if ports are free
for port in $FRONTEND_PORT $BACKEND_PORT; do
  if lsof -i ":$port" &>/dev/null; then
    echo "Port $port is in use. Please free it."
    exit 1
  fi
done

# Pull latest images if needed
if [ "$IMAGE_PULL" = true ]; then
  echo "Pulling latest Docker images..."
  docker-compose pull || echo "Pull skipped or not needed."
fi

# Optional MongoDB backup
if [ "$MONGO_ENABLED" = true ]; then
  if docker ps --format '{{.Names}}' | grep -q "^$MONGO_CONTAINER_NAME$"; then
    echo "Backing up MongoDB from container: $MONGO_CONTAINER_NAME"
    mkdir -p "$BACKUP_FOLDER"
    docker exec "$MONGO_CONTAINER_NAME" sh -c "mongodump --out /data/backup"
    docker cp "$MONGO_CONTAINER_NAME":/data/backup "$BACKUP_FOLDER"
  else
    echo "MongoDB container '$MONGO_CONTAINER_NAME' is not running. Skipping backup."
  fi
fi

# Build and start containers
echo "Building and starting app..."
docker-compose up --build --remove-orphans -d

# Wait a few seconds and launch frontend in browser
echo "Launching in browser..."
sleep 5
xdg-open "http://localhost:$FRONTEND_PORT" >/dev/null 2>&1 || \
open "http://localhost:$FRONTEND_PORT" || \
echo "Open your browser at http://localhost:$FRONTEND_PORT"

echo "✅ Setup complete!"
