#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_CONTEXT="${ROOT_DIR}/.build/rootfs-image-context"
cd "${ROOT_DIR}"

git submodule update --init --recursive upstream/flipperone-testing upstream/flipperone-linux-build-scripts
FLIPPERONE_TESTING_SHA="$(git -C upstream/flipperone-testing rev-parse HEAD)"
FLIPPERONE_BUILD_SCRIPTS_SHA="$(git -C upstream/flipperone-linux-build-scripts rev-parse HEAD)"

container builder start --memory 8g --cpus 4 >/dev/null || true

test -f artifacts/debian-ospack.tar.gz || {
    echo "Missing artifacts/debian-ospack.tar.gz. Run ./scripts/03-build-rootfs-artifact.sh first." >&2
    exit 1
}

rm -rf "${BUILD_CONTEXT}"
mkdir -p "${BUILD_CONTEXT}/artifacts" "${BUILD_CONTEXT}/context/common" "${BUILD_CONTEXT}/assets"
cp "${ROOT_DIR}/Containerfile.rootfs" "${BUILD_CONTEXT}/Dockerfile"
ln "${ROOT_DIR}/artifacts/debian-ospack.tar.gz" "${BUILD_CONTEXT}/artifacts/debian-ospack.tar.gz"
cp "${ROOT_DIR}/context/common/flipper-ui-entrypoint.sh" "${BUILD_CONTEXT}/context/common/flipper-ui-entrypoint.sh"
cp -R "${ROOT_DIR}/context/common/lab-overlay" "${BUILD_CONTEXT}/context/common/lab-overlay"
cp -R "${ROOT_DIR}/assets/flipperone-protopie" "${BUILD_CONTEXT}/assets/flipperone-protopie"

container build \
    --platform linux/arm64 \
    --memory 8g \
    --cpus 4 \
    --build-arg "FLIPPERONE_TESTING_SHA=${FLIPPERONE_TESTING_SHA}" \
    --build-arg "FLIPPERONE_BUILD_SCRIPTS_SHA=${FLIPPERONE_BUILD_SCRIPTS_SHA}" \
    --tag flipperone-rootfs:latest \
    "${BUILD_CONTEXT}"
