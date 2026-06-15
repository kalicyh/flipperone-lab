#!/usr/bin/env bash
set -euo pipefail

container list --all

printf '\nDev UI:       http://127.0.0.1:8899\n'
printf 'Dev Raw UI:   http://127.0.0.1:8899/__flipper_ui.html\n'
printf 'Rootfs UI:    http://127.0.0.1:8898\n'
printf 'Rootfs Raw:   http://127.0.0.1:8898/__flipper_ui.html\n'
