#!/usr/bin/env bash
set -euo pipefail

# Also clean the early lab name so the fixed ports can be reused after upgrading.
container stop flipperone-dev flipperone-phase1 >/dev/null 2>&1 || true
container delete flipperone-dev flipperone-phase1 >/dev/null 2>&1 || true

container run \
    --detach \
    --name flipperone-dev \
    --memory 4g \
    --cpus 4 \
    --publish 127.0.0.1:8899:8899 \
    flipperone-dev:latest

printf 'UI:    http://127.0.0.1:8899\n'
