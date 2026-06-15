#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_CONTEXT="${ROOT_DIR}/.build/rootfs-image-context"
cd "${ROOT_DIR}"

container builder start --memory 8g --cpus 4 >/dev/null || true

test -f artifacts/debian-ospack.tar.gz || {
    echo "Missing artifacts/debian-ospack.tar.gz. Run ./scripts/03-build-rootfs-artifact.sh first." >&2
    exit 1
}

rm -rf "${BUILD_CONTEXT}"
mkdir -p "${BUILD_CONTEXT}/artifacts" "${BUILD_CONTEXT}/context/common"
cp "${ROOT_DIR}/Containerfile.rootfs" "${BUILD_CONTEXT}/Dockerfile"
ln "${ROOT_DIR}/artifacts/debian-ospack.tar.gz" "${BUILD_CONTEXT}/artifacts/debian-ospack.tar.gz"
cp "${ROOT_DIR}/context/common/flipper-ui-entrypoint.sh" "${BUILD_CONTEXT}/context/common/flipper-ui-entrypoint.sh"

container build \
    --platform linux/arm64 \
    --memory 8g \
    --cpus 4 \
    --tag flipperone-rootfs:latest \
    "${BUILD_CONTEXT}"
