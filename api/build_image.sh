#!/usr/bin/env bash
# Copies the ingested Cognee state into the build context and builds the image.
# Refuses to run while Ladybug has a non-empty write-ahead log: that means a pantheon
# process is still open on the graph and the copy would be unsafe.
set -euo pipefail
STATE_SRC="${STATE_SRC:-/Users/usmanjameel/company-brain-hackathon}"
cd "$(dirname "$0")/.."
if find "$STATE_SRC/.cognee_system" -name '*.wal' -size +0c | grep -q .; then
  echo "refusing: non-empty .lbug.wal under $STATE_SRC/.cognee_system; stop every pantheon process first" >&2
  exit 1
fi
# Keep the laptop's directory names and absolute root: Cognee's relational store records
# per-user database paths as absolute paths, so the container mirrors STATE_SRC exactly.
rm -rf build-state && mkdir -p build-state
cp -R "$STATE_SRC/.cognee_system" build-state/.cognee_system
cp -R "$STATE_SRC/.data_storage" build-state/.data_storage
cp "$STATE_SRC/.pantheon_state.json" build-state/pantheon_state.json
rm -f build-state/.cognee_system/databases/.cognee-migration-*.lock
du -sh build-state
docker build --platform linux/amd64 --build-arg STATE_HOME="$STATE_SRC" -t pantheon-api .
