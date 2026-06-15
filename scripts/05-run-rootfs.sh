#!/usr/bin/env bash
set -euo pipefail

# Also clean the early lab name so the fixed ports can be reused after upgrading.
container stop flipperone-rootfs flipperone-phase2 >/dev/null 2>&1 || true
container delete flipperone-rootfs flipperone-phase2 >/dev/null 2>&1 || true

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

container run \
    --detach \
    --name flipperone-rootfs \
    --memory 6g \
    --cpus 4 \
    --publish 127.0.0.1:8898:8899 \
    --mount "type=bind,source=${ROOT_DIR}/config,target=/opt/flipperone-lab-config,readonly" \
    --mount "type=bind,source=${ROOT_DIR}/assets/flipperone-protopie,target=/opt/flipperone-lab-assets/protopie,readonly" \
    flipperone-rootfs:latest

printf 'UI:      http://127.0.0.1:8898\n'
printf 'Raw UI:  http://127.0.0.1:8898/__flipper_ui.html\n'
printf 'Config:  %s/config/device-shell.json\n' "${ROOT_DIR}"
printf 'Keys:    %s/config/key-map.json\n' "${ROOT_DIR}"
