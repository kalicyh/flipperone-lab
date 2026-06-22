#!/usr/bin/env bash
set -euo pipefail

export FLIPPER_UI_PORT="${FLIPPER_UI_PORT:-8899}"
export FLIPPER_DEVICE_SHELL="${FLIPPER_DEVICE_SHELL:-1}"

log() {
    printf '[flipper-ui] %s\n' "$*"
}

cleanup() {
    jobs -pr | xargs -r kill 2>/dev/null || true
}
trap cleanup EXIT INT TERM

prepare_apt_metadata() {
    command -v apt-get >/dev/null 2>&1 || return
    if find /var/lib/apt/lists -type f -name '*Packages*' -print -quit 2>/dev/null | grep -q .; then
        return
    fi

    log "refreshing apt package metadata"
    if ! apt-get update >/tmp/apt-get-update.log 2>&1; then
        log "warning: apt-get update failed; package installs may fail"
    fi
}

prepare_device_shell() {
    local ui_dir="$1"
    local overlay_dir="${FLIPPER_OVERLAY_DIR:-/opt/flipperone-lab-overlay}"
    local overlay_config_dir="${FLIPPER_OVERLAY_CONFIG_DIR:-/opt/flipperone-lab-config}"
    local lab_assets_dir="${FLIPPER_LAB_ASSETS_DIR:-/opt/flipperone-lab-assets}"

    if [ "${FLIPPER_DEVICE_SHELL}" = "0" ]; then
        log "device shell disabled"
        return
    fi

    if [ ! -f "${ui_dir}/index.html" ] || [ ! -f "${overlay_dir}/shell.html" ]; then
        log "device shell unavailable; using raw UI"
        return
    fi

    log "installing device shell wrapper"

    awk '
        /<\/head>/ && !done {
            print "    <link rel=\"stylesheet\" href=\"/lab-overlay/flipper-ui-fit.css\">";
            print "    <script src=\"/lab-overlay/lab-browser-runtime.js\"></script>";
            done = 1
        }
        { print }
    ' "${ui_dir}/index.html" > "${ui_dir}/__flipper_ui.html"

    rm -rf "${ui_dir}/lab-overlay" "${ui_dir}/lab-assets"
    mkdir -p "${ui_dir}/lab-overlay"

    ln -sfn "${overlay_dir}/flipper-ui-fit.css" "${ui_dir}/lab-overlay/flipper-ui-fit.css"
    ln -sfn "${overlay_dir}/lab-browser-runtime.js" "${ui_dir}/lab-overlay/lab-browser-runtime.js"
    [ -f "${overlay_dir}/version.json" ] && ln -sfn "${overlay_dir}/version.json" "${ui_dir}/lab-overlay/version.json"
    if [ -f "${overlay_config_dir}/device-shell.json" ]; then
        ln -sfn "${overlay_config_dir}/device-shell.json" "${ui_dir}/lab-overlay/device-shell.json"
    else
        ln -sfn "${overlay_dir}/device-shell.json" "${ui_dir}/lab-overlay/device-shell.json"
    fi
    if [ -f "${overlay_config_dir}/key-map.json" ]; then
        ln -sfn "${overlay_config_dir}/key-map.json" "${ui_dir}/lab-overlay/key-map.json"
    else
        ln -sfn "${overlay_dir}/key-map.json" "${ui_dir}/lab-overlay/key-map.json"
    fi
    ln -sfn "${lab_assets_dir}" "${ui_dir}/lab-assets"

    cp "${overlay_dir}/shell.html" "${ui_dir}/index.html"
}

touch /tmp/fake-flipctl.log
prepare_apt_metadata

if [ -d /flipperone-testing/active-flipctl ]; then
    prepare_device_shell /flipperone-testing/active-flipctl
    log "starting fake FlipCTL on port ${FLIPPER_UI_PORT}"
    (
        overlay_dir="${FLIPPER_OVERLAY_DIR:-/opt/flipperone-lab-overlay}"
        node_args=()
        if [ -f "${overlay_dir}/lab-runtime-preload.js" ]; then
            node_args=(--require "${overlay_dir}/lab-runtime-preload.js")
        fi
        cd /flipperone-testing/active-flipctl
        FLIPPER_LAB_MODE=1 PORT="${FLIPPER_UI_PORT}" node "${node_args[@]}" server.js
    ) >/tmp/fake-flipctl.log 2>&1 &
else
    log "warning: /flipperone-testing/active-flipctl not found"
fi

log "ready: fake FlipCTL on :${FLIPPER_UI_PORT}"
tail -f /tmp/fake-flipctl.log
