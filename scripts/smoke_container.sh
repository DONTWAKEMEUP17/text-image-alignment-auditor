#!/usr/bin/env bash
set -euo pipefail

image="${1:-alignment-auditor:ci}"
container="alignment-auditor-smoke-$$"

docker run --detach --name "$container" --read-only --tmpfs /tmp \
  --publish 127.0.0.1::8000 "$image" >/dev/null

cleanup() {
  status=$?
  if (( status != 0 )); then
    docker logs "$container" >&2 || true
  fi
  docker rm --force "$container" >/dev/null 2>&1 || true
}
trap cleanup EXIT

base_url="http://$(docker port "$container" 8000/tcp)"
ready=false
for attempt in {1..30}; do
  if curl --fail --silent --max-time 2 "$base_url/health/ready" >/dev/null; then
    ready=true
    break
  fi
  if [[ "$(docker inspect --format '{{.State.Running}}' "$container")" != true ]]; then
    echo "Container exited before becoming ready" >&2
    exit 1
  fi
  sleep 1
done

if [[ "$ready" != true ]]; then
  echo "Container did not become ready within 30 attempts" >&2
  exit 1
fi

curl --fail --silent --show-error --max-time 5 "$base_url/" >/dev/null
curl --fail --silent --show-error --max-time 5 "$base_url/api/stats" >/dev/null

logs_found=false
for attempt in {1..5}; do
  logs="$(docker logs "$container" 2>&1)"
  if [[ "$logs" == *'"event": "request_completed"'* &&
        "$logs" == *'"path": "/api/stats"'* ]]; then
    logs_found=true
    break
  fi
  sleep 1
done

if [[ "$logs_found" != true ]]; then
  echo "Container did not emit a structured API request log" >&2
  exit 1
fi

echo "Smoke test passed: readiness, homepage, API stats, and JSON request log"
