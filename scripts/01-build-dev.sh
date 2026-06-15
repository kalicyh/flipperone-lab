#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

git submodule update --init --recursive upstream/flipperone-testing

container builder start --memory 8g --cpus 4 >/dev/null || true

container build \
    --platform linux/arm64 \
    --memory 8g \
    --cpus 4 \
    --tag flipperone-dev:latest \
    --file Containerfile.dev \
    .
