#!/usr/bin/env bash
set -euo pipefail

export FLIPPER_UI_PORT="${FLIPPER_UI_PORT:-8899}"

log() {
    printf '[flipper-ui] %s\n' "$*"
}

cleanup() {
    jobs -pr | xargs -r kill 2>/dev/null || true
}
trap cleanup EXIT INT TERM

touch /tmp/fake-flipctl.log

if [ -d /flipperone-testing/active-flipctl ]; then
    log "starting fake FlipCTL on port ${FLIPPER_UI_PORT}"
    (
        cd /flipperone-testing/active-flipctl
        PORT="${FLIPPER_UI_PORT}" node server.js
    ) >/tmp/fake-flipctl.log 2>&1 &
else
    log "warning: /flipperone-testing/active-flipctl not found"
fi

log "ready: fake FlipCTL on :${FLIPPER_UI_PORT}"
tail -f /tmp/fake-flipctl.log
