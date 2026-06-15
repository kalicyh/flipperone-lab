#!/usr/bin/env bash
set -euo pipefail

container stop flipperone-phase2 >/dev/null 2>&1 || true
container delete flipperone-phase2 >/dev/null 2>&1 || true

container run \
    --detach \
    --name flipperone-phase2 \
    --memory 6g \
    --cpus 4 \
    --shm-size 1g \
    --publish 127.0.0.1:6081:6080 \
    --publish 127.0.0.1:8898:8899 \
    flipperone-phase2-vnc:latest

printf 'noVNC: http://127.0.0.1:6081/vnc.html?host=127.0.0.1&port=6081&autoconnect=true&resize=scale\n'
printf 'UI:    http://127.0.0.1:8898\n'
