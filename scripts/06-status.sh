#!/usr/bin/env bash
set -euo pipefail

container list --all

printf '\nDev UI:       http://127.0.0.1:8899\n'
printf 'Rootfs UI:    http://127.0.0.1:8898\n'
