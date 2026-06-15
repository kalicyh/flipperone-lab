#!/usr/bin/env bash
set -euo pipefail

# Also clean the early lab name so the fixed ports can be reused after upgrading.
container stop flipperone-dev flipperone-phase1 >/dev/null 2>&1 || true
container delete flipperone-dev flipperone-phase1 >/dev/null 2>&1 || true

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

container run \
    --detach \
    --name flipperone-dev \
    --memory 4g \
    --cpus 4 \
    --publish 127.0.0.1:8899:8899 \
    --mount "type=bind,source=${ROOT_DIR}/config,target=/opt/flipperone-lab-config,readonly" \
    --mount "type=bind,source=${ROOT_DIR}/assets/flipperone-protopie,target=/opt/flipperone-lab-assets/protopie,readonly" \
    flipperone-dev:latest

printf 'UI:      http://127.0.0.1:8899\n'
printf 'Raw UI:  http://127.0.0.1:8899/__flipper_ui.html\n'
printf 'Config:  %s/config/device-shell.json\n' "${ROOT_DIR}"
