#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLATFORM="${DOCKER_PLATFORM:-linux/arm64}"

usage() {
    cat <<'EOF'
Usage: ./scripts/docker-lab.sh COMMAND

Commands:
  build-dev        Build flipperone-dev with Docker
  run-dev          Run flipperone-dev on http://127.0.0.1:8899
  build-rootfs     Build the rootfs artifact and flipperone-rootfs image
  run-rootfs       Run flipperone-rootfs on http://127.0.0.1:8898
  status           Show lab containers
  stop             Stop lab containers
EOF
}

build_dev() {
    cd "${ROOT_DIR}"
    git submodule update --init --recursive upstream/flipperone-testing
    docker build \
        --platform "${PLATFORM}" \
        --tag flipperone-dev:latest \
        --file Containerfile.dev \
        .
}

run_dev() {
    docker rm -f flipperone-dev >/dev/null 2>&1 || true
    docker run \
        --detach \
        --name flipperone-dev \
        --platform "${PLATFORM}" \
        --publish 127.0.0.1:8899:8899 \
        --mount "type=bind,source=${ROOT_DIR}/config,target=/opt/flipperone-lab-config,readonly" \
        --mount "type=bind,source=${ROOT_DIR}/assets/flipperone-protopie,target=/opt/flipperone-lab-assets/protopie,readonly" \
        flipperone-dev:latest

    printf 'UI:      http://127.0.0.1:8899\n'
    printf 'Raw UI:  http://127.0.0.1:8899/__flipper_ui.html\n'
}

build_rootfs() {
    local context="${ROOT_DIR}/.build/rootfs-image-context"

    cd "${ROOT_DIR}"
    mkdir -p artifacts
    git submodule update --init --recursive upstream/flipperone-linux-build-scripts

    docker build \
        --platform "${PLATFORM}" \
        --tag flipperone-rootfs-builder:latest \
        --file Containerfile.rootfs-builder \
        .

    docker run \
        --rm \
        --privileged \
        --platform "${PLATFORM}" \
        --volume "${ROOT_DIR}/artifacts:/artifacts" \
        --entrypoint /bin/bash \
        flipperone-rootfs-builder:latest \
        -lc 'cd /rk3576-linux-build && IMG_OUT=/artifacts ./build-ospack.sh'

    test -s "${ROOT_DIR}/artifacts/debian-ospack.tar.gz"
    rm -rf "${context}"
    mkdir -p "${context}/artifacts" "${context}/context/common" "${context}/assets"
    cp "${ROOT_DIR}/Containerfile.rootfs" "${context}/Dockerfile"
    cp "${ROOT_DIR}/artifacts/debian-ospack.tar.gz" "${context}/artifacts/debian-ospack.tar.gz"
    cp "${ROOT_DIR}/context/common/flipper-ui-entrypoint.sh" "${context}/context/common/flipper-ui-entrypoint.sh"
    cp -R "${ROOT_DIR}/context/common/lab-overlay" "${context}/context/common/lab-overlay"
    cp -R "${ROOT_DIR}/assets/flipperone-protopie" "${context}/assets/flipperone-protopie"

    docker build \
        --platform "${PLATFORM}" \
        --tag flipperone-rootfs:latest \
        "${context}"
}

run_rootfs() {
    docker rm -f flipperone-rootfs >/dev/null 2>&1 || true
    docker run \
        --detach \
        --name flipperone-rootfs \
        --platform "${PLATFORM}" \
        --publish 127.0.0.1:8898:8899 \
        --mount "type=bind,source=${ROOT_DIR}/config,target=/opt/flipperone-lab-config,readonly" \
        --mount "type=bind,source=${ROOT_DIR}/assets/flipperone-protopie,target=/opt/flipperone-lab-assets/protopie,readonly" \
        flipperone-rootfs:latest

    printf 'UI:      http://127.0.0.1:8898\n'
    printf 'Raw UI:  http://127.0.0.1:8898/__flipper_ui.html\n'
}

case "${1:-}" in
    build-dev) build_dev ;;
    run-dev) run_dev ;;
    build-rootfs) build_rootfs ;;
    run-rootfs) run_rootfs ;;
    status) docker ps --filter name=flipperone --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' ;;
    stop) docker rm -f flipperone-dev flipperone-rootfs >/dev/null 2>&1 || true ;;
    -h|--help|help) usage ;;
    *) usage; exit 2 ;;
esac
