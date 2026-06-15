#!/usr/bin/env bash
set -euo pipefail

container stop flipperone-phase1 >/dev/null 2>&1 || true
container delete flipperone-phase1 >/dev/null 2>&1 || true

container run \
    --detach \
    --name flipperone-phase1 \
    --memory 4g \
    --cpus 4 \
    --shm-size 1g \
    --publish 127.0.0.1:6080:6080 \
    --publish 127.0.0.1:8899:8899 \
    flipperone-phase1-vnc:latest

printf 'noVNC: http://127.0.0.1:6080/vnc.html?host=127.0.0.1&port=6080&autoconnect=true&resize=scale\n'
printf 'UI:    http://127.0.0.1:8899\n'
