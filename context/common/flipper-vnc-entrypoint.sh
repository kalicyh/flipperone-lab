#!/usr/bin/env bash
set -euo pipefail

export DISPLAY="${DISPLAY:-:1}"
export FLIPPER_UI_PORT="${FLIPPER_UI_PORT:-8899}"
export NOVNC_PORT="${NOVNC_PORT:-6080}"
export VNC_PORT="${VNC_PORT:-5900}"
export SCREEN_GEOMETRY="${SCREEN_GEOMETRY:-1280x720x24}"

log() {
    printf '[flipper-vnc] %s\n' "$*"
}

cleanup() {
    jobs -pr | xargs -r kill 2>/dev/null || true
}
trap cleanup EXIT INT TERM

if [ ! -e /tmp/.X11-unix ]; then
    mkdir -p /tmp/.X11-unix
    chmod 1777 /tmp/.X11-unix
fi

log "starting Xvfb on ${DISPLAY}"
Xvfb "${DISPLAY}" -screen 0 "${SCREEN_GEOMETRY}" -nolisten tcp &

sleep 1

log "starting Openbox"
openbox >/tmp/openbox.log 2>&1 &

if [ -d /flipperone-testing/active-flipctl ]; then
    log "starting fake FlipCTL on port ${FLIPPER_UI_PORT}"
    (
        cd /flipperone-testing/active-flipctl
        PORT="${FLIPPER_UI_PORT}" node server.js
    ) >/tmp/fake-flipctl.log 2>&1 &
else
    log "warning: /flipperone-testing/active-flipctl not found"
fi

log "starting x11vnc on ${VNC_PORT}"
x11vnc -display "${DISPLAY}" -forever -shared -nopw -listen 127.0.0.1 -rfbport "${VNC_PORT}" >/tmp/x11vnc.log 2>&1 &

log "starting noVNC on ${NOVNC_PORT}"
websockify --web=/usr/share/novnc "0.0.0.0:${NOVNC_PORT}" "127.0.0.1:${VNC_PORT}" >/tmp/novnc.log 2>&1 &

sleep 2

if command -v chromium >/dev/null 2>&1; then
    log "starting Chromium"
    chromium \
        --no-sandbox \
        --disable-dev-shm-usage \
        --disable-gpu \
        --window-size=1280,720 \
        "http://127.0.0.1:${FLIPPER_UI_PORT}" >/tmp/chromium.log 2>&1 &
else
    log "warning: Chromium is not installed"
fi

log "ready: noVNC on :${NOVNC_PORT}, fake FlipCTL on :${FLIPPER_UI_PORT}"
tail -f /tmp/fake-flipctl.log /tmp/openbox.log /tmp/x11vnc.log /tmp/novnc.log /tmp/chromium.log

