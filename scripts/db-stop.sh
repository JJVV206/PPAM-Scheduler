#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="ppam-scheduler-postgres"

if docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
  if [ "$(docker inspect --format '{{.State.Running}}' "$CONTAINER_NAME")" = "true" ]; then
    docker stop "$CONTAINER_NAME" >/dev/null
    echo "Contenedor $CONTAINER_NAME detenido."
  else
    echo "El contenedor $CONTAINER_NAME ya estaba detenido."
  fi
  exit 0
fi

docker compose stop postgres
