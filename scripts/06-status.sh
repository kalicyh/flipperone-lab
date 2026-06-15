#!/usr/bin/env bash
set -euo pipefail

container list --all

printf '\nPhase 1 noVNC: http://127.0.0.1:6080/vnc.html?host=127.0.0.1&port=6080&autoconnect=true&resize=scale\n'
printf 'Phase 1 UI:    http://127.0.0.1:8899\n'
printf 'Phase 2 noVNC: http://127.0.0.1:6081/vnc.html?host=127.0.0.1&port=6081&autoconnect=true&resize=scale\n'
printf 'Phase 2 UI:    http://127.0.0.1:8898\n'
