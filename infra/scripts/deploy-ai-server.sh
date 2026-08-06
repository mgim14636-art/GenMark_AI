#!/usr/bin/env bash
set -e

echo "=== Deploying AI Server (FastAPI) ==="
docker compose build ai-server
docker compose up -d --no-deps ai-server
echo "=== AI Server Deployment Finished ==="
