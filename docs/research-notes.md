# Research Notes

These notes capture the repository choices behind this lab.

## Flipper One Repository Roles

- `flipperone-testing` is the fastest entry point for UI access because it includes `fake-flipctl2`, which can run without real Flipper One hardware.
- `flipperone-linux-build-scripts` is the closest public source for building the Linux userspace rootfs. This is the base of Phase 2.
- `flipper-linux-kernel`, `u-boot`, and `rkbin` are board boot components. They matter for real hardware bring-up, but they are not enough to make a useful macOS container target.
- `flipperone-mcu-firmware`, `flipperone-hardware`, and `flipperone-mechanics` are outside the container scope.
- `flipctl` and `rkbin` are referenced by upstream materials but are not public at the time this lab was built.

## Container Scope

Apple `container` is useful here for ARM64 Linux userspace access. It is not a full RK3576 board emulator.

The practical split is:

- Use `flipperone-testing` to get a quick VNC-accessible UI.
- Use `flipperone-linux-build-scripts` to build the official Debian rootfs.
- Add a VNC/noVNC layer to make that userspace accessible from macOS.

## Phase 1

Phase 1 clones `flipperone-testing` directly in the image and runs:

```text
/flipperone-testing/fake-flipctl2
```

This is intentionally quick and does not depend on the official rootfs build.

## Phase 2

Phase 2 builds:

```text
artifacts/debian-ospack.tar.gz
```

Then it creates a runtime image by adding that rootfs and installing the VNC/noVNC access packages.

The rootfs build needs extra container capabilities for `debos` and `systemd-nspawn`, so the builder script runs with:

```text
--cap-add ALL
```

The final runtime containers do not require that flag.

## Known Limits

- No RK3576 kernel boot.
- No U-Boot flow.
- No hardware drivers or peripherals.
- No real MCU, modem, Wi-Fi, M.2, battery, or power management devices.
- UI hardware status may be incomplete or fake because the real device tree is absent.

This is still useful for inspecting current userspace behavior, checking web UI assumptions, and developing container-friendly workflows around the public repositories.
