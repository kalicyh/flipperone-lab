# Flipper One Container Lab

Unofficial Apple `container` lab for opening the current Flipper One Linux userspace and UI from macOS.

The goal is practical access, not board emulation. This repository gives you:

- **Phase 1:** a fast Debian-based VNC/noVNC container that runs `flipperone-testing`'s `fake-flipctl2`.
- **Phase 2:** an official Flipper One Debian ARM64 rootfs built from `flipperone-linux-build-scripts`, wrapped with the same VNC/noVNC access layer.

This does **not** boot the RK3576 board kernel, U-Boot, MCU firmware, modem stack, Wi-Fi stack, M.2 devices, power supply interfaces, or other real Flipper One hardware. Apple `container` runs Linux containers in lightweight VMs on macOS, so this project targets userspace inspection and UI access.

## Repository Status

Verified on Apple Silicon macOS with Apple `container`:

- `flipperone-phase1-vnc:latest` builds and runs.
- `flipperone-phase2-vnc:latest` builds and runs.
- `artifacts/debian-ospack.tar.gz` can be generated from the official build scripts.
- noVNC works for both phases.
- The direct `fake-flipctl2` HTTP UI works for both phases.

## Prerequisites

- Apple Silicon Mac
- macOS version supported by [apple/container](https://github.com/apple/container)
- `container` installed and usable
- Network access to Debian mirrors and GitHub
- At least **30GB free disk space** before Phase 2

Start Apple `container` first:

```bash
./scripts/00-start-container-system.sh
```

## Quick Start: Phase 1

Phase 1 is the fastest way to get a Flipper One-like UI in a container.

```bash
./scripts/01-build-phase1.sh
./scripts/02-run-phase1.sh
```

Open noVNC:

```text
http://127.0.0.1:6080/vnc.html?host=127.0.0.1&port=6080&autoconnect=true&resize=scale
```

Direct UI endpoint:

```text
http://127.0.0.1:8899
```

## Official Rootfs: Phase 2

Phase 2 builds the Flipper One Debian ARM64 rootfs from the official build scripts, then packages it into a VNC-enabled runtime image.

```bash
./scripts/03-build-official-ospack.sh
./scripts/04-build-phase2.sh
./scripts/05-run-phase2.sh
```

Open noVNC:

```text
http://127.0.0.1:6081/vnc.html?host=127.0.0.1&port=6081&autoconnect=true&resize=scale
```

Direct UI endpoint:

```text
http://127.0.0.1:8898
```

The generated rootfs tarball is stored at:

```text
artifacts/debian-ospack.tar.gz
```

It is intentionally ignored by Git because it is large.

## Runtime Commands

Show container status:

```bash
./scripts/06-status.sh
```

Stop both lab containers:

```bash
./scripts/07-stop.sh
```

## How It Works

Phase 1 builds from Debian `trixie`, installs Chromium, Xvfb, Openbox, x11vnc, noVNC, Node.js, and `flipperone-testing`, then launches `fake-flipctl2` in a browser inside the VNC session.

Phase 2 uses `flipperone-linux-build-scripts` to build `debian-ospack.tar.gz`, starts a new image `FROM scratch`, adds that rootfs, installs the same VNC access layer, and launches the `fake-flipctl2` already present in the official userspace.

The official rootfs builder runs with `--cap-add ALL` because `debos`/`systemd-nspawn` needs mount and tmpfs capabilities while building the rootfs. The final Phase 1 and Phase 2 VNC containers do not run with that capability.

## Project Layout

```text
Containerfile.phase1              Fast Debian + flipperone-testing VNC image
Containerfile.official-builder    Builder image for official Flipper One rootfs
Containerfile.phase2              VNC image layered on top of official rootfs
context/common/                   Shared VNC/noVNC entrypoint
scripts/                          Build, run, status, and stop commands
docs/research-notes.md            Notes about repository choice and scope
artifacts/                        Generated rootfs tarballs, ignored by Git
src/                              Cloned upstream sources, ignored by Git
.build/                           Temporary build contexts, ignored by Git
```

## Troubleshooting

If Phase 2 fails with `Input/output error` during package install or BuildKit layer commit, check disk space first. The rootfs build creates large temporary apt, BuildKit, and rootfs layers; keep at least 30GB free.

If noVNC opens but the UI is blank, check logs:

```bash
container logs flipperone-phase1
container logs flipperone-phase2
```

If Apple `container` has no ARM64 kernel installed, `00-start-container-system.sh` attempts the recommended kernel install. If that still fails, follow the Apple `container` kernel setup documentation for your installed version.

## Upstream Repositories

- [flipperone-linux-build-scripts](https://github.com/flipperdevices/flipperone-linux-build-scripts)
- [flipperone-testing](https://github.com/flipperdevices/flipperone-testing)
- [flipper-linux-kernel](https://github.com/flipperdevices/flipper-linux-kernel)
- [u-boot](https://github.com/flipperdevices/u-boot)
- [flipperone-mcu-firmware](https://github.com/flipperdevices/flipperone-mcu-firmware)

## License

No license is declared for this lab repository yet. Check upstream repositories for their own licenses before redistributing derived images or artifacts.
