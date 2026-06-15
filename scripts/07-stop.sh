#!/usr/bin/env bash
set -euo pipefail

container stop flipperone-phase1 flipperone-phase2 >/dev/null 2>&1 || true
container delete flipperone-phase1 flipperone-phase2 >/dev/null 2>&1 || true

printf 'Stopped flipperone-phase1 and flipperone-phase2 if they existed.\n'
