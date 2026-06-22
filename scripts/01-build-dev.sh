#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

git submodule update --init --recursive upstream/flipperone-testing upstream/flipperone-linux-build-scripts
FLIPPERONE_TESTING_SHA="$(git -C upstream/flipperone-testing rev-parse HEAD)"
FLIPPERONE_BUILD_SCRIPTS_SHA="$(git -C upstream/flipperone-linux-build-scripts rev-parse HEAD)"

container builder start --memory 8g --cpus 4 >/dev/null || true

container build \
    --platform linux/arm64 \
    --memory 8g \
    --cpus 4 \
    --build-arg "FLIPPERONE_TESTING_SHA=${FLIPPERONE_TESTING_SHA}" \
    --build-arg "FLIPPERONE_BUILD_SCRIPTS_SHA=${FLIPPERONE_BUILD_SCRIPTS_SHA}" \
    --tag flipperone-dev:latest \
    --file Containerfile.dev \
    .
