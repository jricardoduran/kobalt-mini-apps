#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
D=$(mktemp -d)
QIPU_ROOT="$D" php -S 127.0.0.1:18931 -t public >"$D/server.log" 2>&1 &
PID=$!
trap 'kill "$PID" 2>/dev/null || true; rm -rf "$D"' EXIT
sleep .5
kill -0 "$PID"
node tests/http.cjs
php tests/recovery.php
