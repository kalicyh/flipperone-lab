# Apple Container Workflow

This optional path uses Apple's native `container` CLI instead of Docker.

## Prerequisites

- Apple Silicon Mac
- macOS version supported by [apple/container](https://github.com/apple/container)
- `container` installed and usable
- Network access to Debian mirrors and GitHub
- At least 30GB free disk space before building `flipperone-rootfs`

Start Apple `container` first:

```bash
./scripts/apple-container-lab.sh start
```

## flipperone-dev

```bash
./scripts/apple-container-lab.sh build-dev
./scripts/apple-container-lab.sh run-dev
```

Open:

```text
http://127.0.0.1:8899
```

Raw UI:

```text
http://127.0.0.1:8899/__flipper_ui.html
```

## flipperone-rootfs

```bash
./scripts/apple-container-lab.sh build-rootfs
./scripts/apple-container-lab.sh run-rootfs
```

Open:

```text
http://127.0.0.1:8898
```

Raw UI:

```text
http://127.0.0.1:8898/__flipper_ui.html
```

The generated rootfs tarball is stored at:

```text
artifacts/debian-ospack.tar.gz
```

## Runtime

```bash
./scripts/apple-container-lab.sh status
./scripts/apple-container-lab.sh stop
```

Logs:

```bash
container logs flipperone-dev
container logs flipperone-rootfs
```

If Apple `container` has no ARM64 kernel installed, `./scripts/apple-container-lab.sh start` attempts the recommended kernel install. If that still fails, follow the Apple `container` kernel setup documentation for your installed version.
