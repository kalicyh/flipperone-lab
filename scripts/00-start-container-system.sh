#!/usr/bin/env bash
set -euo pipefail

container system start --enable-kernel-install --timeout 300 || true
container system status

if ! container run --rm mirror.gcr.io/library/alpine:latest uname -m; then
    container system kernel set --recommended --arch arm64
    container run --rm mirror.gcr.io/library/alpine:latest uname -m
fi
