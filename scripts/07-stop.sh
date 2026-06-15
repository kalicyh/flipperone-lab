#!/usr/bin/env bash
set -euo pipefail

# Also clean the early lab names so the fixed ports can be reused after upgrading.
container stop flipperone-dev flipperone-rootfs flipperone-phase1 flipperone-phase2 >/dev/null 2>&1 || true
container delete flipperone-dev flipperone-rootfs flipperone-phase1 flipperone-phase2 >/dev/null 2>&1 || true

printf 'Stopped Flipper One lab containers if they existed.\n'
