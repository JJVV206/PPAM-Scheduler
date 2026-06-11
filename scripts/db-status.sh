#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="ppam-scheduler-postgres"

if docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
  docker ps -a --filter "name=^/${CONTAINER_NAME}$"
  exit 0
fi

docker compose ps
