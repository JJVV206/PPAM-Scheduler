#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="ppam-scheduler-postgres"

if docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
  if [ "$(docker inspect --format '{{.State.Running}}' "$CONTAINER_NAME")" = "true" ]; then
    echo "PostgreSQL ya está en ejecución en $CONTAINER_NAME."
  else
    echo "Iniciando contenedor existente $CONTAINER_NAME..."
    docker start "$CONTAINER_NAME" >/dev/null
  fi

  docker ps --filter "name=^/${CONTAINER_NAME}$"
  exit 0
fi

docker compose up -d postgres
