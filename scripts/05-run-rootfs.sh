#!/usr/bin/env bash
set -euo pipefail

# Also clean the early lab name so the fixed ports can be reused after upgrading.
container stop flipperone-rootfs flipperone-phase2 >/dev/null 2>&1 || true
container delete flipperone-rootfs flipperone-phase2 >/dev/null 2>&1 || true

container run \
    --detach \
    --name flipperone-rootfs \
    --memory 6g \
    --cpus 4 \
    --shm-size 1g \
    --publish 127.0.0.1:6081:6080 \
    --publish 127.0.0.1:8898:8899 \
    flipperone-rootfs:latest

printf 'noVNC: http://127.0.0.1:6081/vnc.html?host=127.0.0.1&port=6081&autoconnect=true&resize=scale\n'
printf 'UI:    http://127.0.0.1:8898\n'
