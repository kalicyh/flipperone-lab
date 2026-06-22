#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

usage() {
    cat <<'EOF'
Usage: ./scripts/apple-container-lab.sh COMMAND

Commands:
  start            Start Apple container system
  build-dev        Build flipperone-dev with Apple container
  run-dev          Run flipperone-dev on http://127.0.0.1:8899
  build-rootfs     Build the rootfs artifact and flipperone-rootfs image
  run-rootfs       Run flipperone-rootfs on http://127.0.0.1:8898
  status           Show lab containers
  stop             Stop lab containers
EOF
}

start_system() {
    container system start --enable-kernel-install --timeout 300 || true
    container system status

    if ! container run --rm mirror.gcr.io/library/alpine:latest uname -m; then
        container system kernel set --recommended --arch arm64
        container run --rm mirror.gcr.io/library/alpine:latest uname -m
    fi
}

build_dev() {
    cd "${ROOT_DIR}"
    git submodule update --init --recursive upstream/flipperone-testing upstream/flipperone-linux-build-scripts
    local testing_sha build_scripts_sha
    testing_sha="$(git -C upstream/flipperone-testing rev-parse HEAD)"
    build_scripts_sha="$(git -C upstream/flipperone-linux-build-scripts rev-parse HEAD)"

    container builder start --memory 8g --cpus 4 >/dev/null || true
    container build \
        --platform linux/arm64 \
        --memory 8g \
        --cpus 4 \
        --build-arg "FLIPPERONE_TESTING_SHA=${testing_sha}" \
        --build-arg "FLIPPERONE_BUILD_SCRIPTS_SHA=${build_scripts_sha}" \
        --tag flipperone-dev:latest \
        --file Containerfile.dev \
        .
}

run_dev() {
    container stop flipperone-dev flipperone-phase1 >/dev/null 2>&1 || true
    container delete flipperone-dev flipperone-phase1 >/dev/null 2>&1 || true

    container run \
        --detach \
        --name flipperone-dev \
        --memory 4g \
        --cpus 4 \
        --publish 127.0.0.1:8899:8899 \
        --mount "type=bind,source=${ROOT_DIR}/config,target=/opt/flipperone-lab-config,readonly" \
        --mount "type=bind,source=${ROOT_DIR}/assets/flipperone-protopie,target=/opt/flipperone-lab-assets/protopie,readonly" \
        flipperone-dev:latest

    printf 'UI:      http://127.0.0.1:8899\n'
    printf 'Raw UI:  http://127.0.0.1:8899/__flipper_ui.html\n'
}

build_rootfs() {
    local artifact_dir="${ROOT_DIR}/artifacts"
    local src_dir="${ROOT_DIR}/upstream/flipperone-linux-build-scripts"
    local builder_context="${ROOT_DIR}/.build/rootfs-builder-context"
    local image_context="${ROOT_DIR}/.build/rootfs-image-context"
    local required_free_gb="${REQUIRED_FREE_GB:-30}"
    local free_kb required_kb testing_sha build_scripts_sha

    cd "${ROOT_DIR}"
    mkdir -p "${artifact_dir}"
    free_kb="$(df -Pk "${ROOT_DIR}" | awk 'NR == 2 {print $4}')"
    required_kb="$((required_free_gb * 1024 * 1024))"
    if [ "${free_kb}" -lt "${required_kb}" ]; then
        printf 'Need at least %sGB free on the workspace filesystem before building the official ospack.\n' "${required_free_gb}" >&2
        df -h "${ROOT_DIR}" >&2
        exit 1
    fi

    git submodule update --init --recursive upstream/flipperone-testing upstream/flipperone-linux-build-scripts
    testing_sha="$(git -C upstream/flipperone-testing rev-parse HEAD)"
    build_scripts_sha="$(git -C upstream/flipperone-linux-build-scripts rev-parse HEAD)"

    rm -rf "${builder_context}"
    mkdir -p "${builder_context}/upstream/flipperone-linux-build-scripts"
    cp "${ROOT_DIR}/Containerfile.rootfs-builder" "${builder_context}/Dockerfile"
    git -C "${src_dir}" archive --format=tar HEAD | tar -xf - -C "${builder_context}/upstream/flipperone-linux-build-scripts"

    container builder start --memory 12g --cpus 6 >/dev/null || true
    container build \
        --platform linux/arm64 \
        --memory 12g \
        --cpus 6 \
        --tag flipperone-rootfs-builder:latest \
        "${builder_context}"

    container run \
        --rm \
        --cap-add ALL \
        --memory 12g \
        --cpus 6 \
        --volume "${artifact_dir}:/artifacts" \
        --entrypoint /bin/bash \
        flipperone-rootfs-builder:latest \
        -lc 'cd /rk3576-linux-build && IMG_OUT=/artifacts ./build-ospack.sh'

    test -s "${artifact_dir}/debian-ospack.tar.gz"
    rm -rf "${image_context}"
    mkdir -p "${image_context}/artifacts" "${image_context}/context/common" "${image_context}/assets"
    cp "${ROOT_DIR}/Containerfile.rootfs" "${image_context}/Dockerfile"
    ln "${artifact_dir}/debian-ospack.tar.gz" "${image_context}/artifacts/debian-ospack.tar.gz"
    cp "${ROOT_DIR}/context/common/flipper-ui-entrypoint.sh" "${image_context}/context/common/flipper-ui-entrypoint.sh"
    cp -R "${ROOT_DIR}/context/common/lab-overlay" "${image_context}/context/common/lab-overlay"
    cp -R "${ROOT_DIR}/assets/flipperone-protopie" "${image_context}/assets/flipperone-protopie"

    container builder start --memory 8g --cpus 4 >/dev/null || true
    container build \
        --platform linux/arm64 \
        --memory 8g \
        --cpus 4 \
        --build-arg "FLIPPERONE_TESTING_SHA=${testing_sha}" \
        --build-arg "FLIPPERONE_BUILD_SCRIPTS_SHA=${build_scripts_sha}" \
        --tag flipperone-rootfs:latest \
        "${image_context}"
}

run_rootfs() {
    container stop flipperone-rootfs flipperone-phase2 >/dev/null 2>&1 || true
    container delete flipperone-rootfs flipperone-phase2 >/dev/null 2>&1 || true

    container run \
        --detach \
        --name flipperone-rootfs \
        --memory 6g \
        --cpus 4 \
        --publish 127.0.0.1:8898:8899 \
        --mount "type=bind,source=${ROOT_DIR}/config,target=/opt/flipperone-lab-config,readonly" \
        --mount "type=bind,source=${ROOT_DIR}/assets/flipperone-protopie,target=/opt/flipperone-lab-assets/protopie,readonly" \
        flipperone-rootfs:latest

    printf 'UI:      http://127.0.0.1:8898\n'
    printf 'Raw UI:  http://127.0.0.1:8898/__flipper_ui.html\n'
}

case "${1:-}" in
    start) start_system ;;
    build-dev) build_dev ;;
    run-dev) run_dev ;;
    build-rootfs) build_rootfs ;;
    run-rootfs) run_rootfs ;;
    status) container list --all ;;
    stop)
        container stop flipperone-dev flipperone-rootfs flipperone-phase1 flipperone-phase2 >/dev/null 2>&1 || true
        container delete flipperone-dev flipperone-rootfs flipperone-phase1 flipperone-phase2 >/dev/null 2>&1 || true
        printf 'Stopped Flipper One lab containers if they existed.\n'
        ;;
    -h|--help|help) usage ;;
    *) usage; exit 2 ;;
esac
