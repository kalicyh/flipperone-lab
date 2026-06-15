#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARTIFACT_DIR="${ROOT_DIR}/artifacts"
SRC_DIR="${ROOT_DIR}/src/flipperone-linux-build-scripts"
BUILD_CONTEXT="${ROOT_DIR}/.build/official-builder-context"
REQUIRED_FREE_GB="${REQUIRED_FREE_GB:-30}"

mkdir -p "${ARTIFACT_DIR}" "${ROOT_DIR}/src"

free_kb="$(df -Pk "${ROOT_DIR}" | awk 'NR == 2 {print $4}')"
required_kb="$((REQUIRED_FREE_GB * 1024 * 1024))"
if [ "${free_kb}" -lt "${required_kb}" ]; then
    printf 'Need at least %sGB free on the workspace filesystem before building the official ospack.\n' "${REQUIRED_FREE_GB}" >&2
    df -h "${ROOT_DIR}" >&2
    exit 1
fi

if [ ! -d "${SRC_DIR}/.git" ]; then
    git clone --depth=1 -b dev https://github.com/flipperdevices/flipperone-linux-build-scripts "${SRC_DIR}"
fi

cd "${SRC_DIR}"
git fetch --depth=1 origin dev
git checkout dev
git reset --hard origin/dev

cd "${ROOT_DIR}"

rm -rf "${BUILD_CONTEXT}"
mkdir -p "${BUILD_CONTEXT}/src/flipperone-linux-build-scripts"
cp "${ROOT_DIR}/Containerfile.official-builder" "${BUILD_CONTEXT}/Dockerfile"
git -C "${SRC_DIR}" archive --format=tar HEAD | tar -xf - -C "${BUILD_CONTEXT}/src/flipperone-linux-build-scripts"

container builder start --memory 12g --cpus 6 >/dev/null || true

container build \
    --platform linux/arm64 \
    --memory 12g \
    --cpus 6 \
    --tag flipperone-official-builder:latest \
    "${BUILD_CONTEXT}"

container run \
    --rm \
    --cap-add ALL \
    --memory 12g \
    --cpus 6 \
    --volume "${ARTIFACT_DIR}:/artifacts" \
    --entrypoint /bin/bash \
    flipperone-official-builder:latest \
    -lc 'cd /rk3576-linux-build && IMG_OUT=/artifacts ./build-ospack.sh'

test -f "${ARTIFACT_DIR}/debian-ospack.tar.gz"
ls -lh "${ARTIFACT_DIR}/debian-ospack.tar.gz"
