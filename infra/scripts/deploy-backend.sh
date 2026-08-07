#!/usr/bin/env bash
set -e

echo "=== Deploying Backend (Spring Boot) ==="
docker compose build backend
docker compose up -d --no-deps backend
echo "=== Backend Deployment Finished ==="
