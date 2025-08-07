#!/bin/bash
set -e

echo "Stopping and cleaning Docker setup..."

docker-compose down --volumes --remove-orphans

# Remove images
docker image rm network-manager-web-frontend network-manager-web-backend -f || true

# Remove backups and logs
rm -rf mongo_backups setup.log

echo "Uninstall complete."
