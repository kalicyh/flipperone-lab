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
    --publish 127.0.0.1:8898:8899 \
    flipperone-rootfs:latest

printf 'UI:    http://127.0.0.1:8898\n'
