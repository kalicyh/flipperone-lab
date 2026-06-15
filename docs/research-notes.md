# Research Notes

These notes capture the repository choices behind this lab.

## Upstream Roles

- `flipperone-testing` is the fastest entry point for UI access because it includes `fake-flipctl2`, which can run without real Flipper One hardware.
- `flipperone-linux-build-scripts` is the closest public source for building the Linux userspace rootfs.
- `flipper-linux-kernel`, `u-boot`, and `rkbin` are board boot components. They matter for real hardware bring-up, but they are not enough to make a useful container target.
- `flipperone-mcu-firmware`, `flipperone-hardware`, and `flipperone-mechanics` are outside this container scope.
- `flipctl` and `rkbin` are referenced by upstream materials but are not public at the time this lab was built.

## Why Submodules

The public Flipper One repositories are changing quickly. Submodules make this lab more reproducible because the main repository records exact upstream commits while still allowing explicit updates.

Current submodules:

```text
upstream/flipperone-testing
upstream/flipperone-linux-build-scripts
```

Use this to refresh the checked-out submodules to the recorded commits:

```bash
git submodule update --init --recursive
```

Use this only when intentionally updating to newer upstream commits:

```bash
git submodule update --remote --merge
```

Then commit the changed submodule pointers.

## Image Split

The repository builds two OCI images:

- `flipperone-dev`: quick development/UI image based on Debian plus `flipperone-testing`.
- `flipperone-rootfs`: userspace image based on an official Flipper One Debian rootfs generated from `flipperone-linux-build-scripts`.

The names avoid `official` because these images are not published by Flipper Devices.

## Container Scope

Apple `container` is useful here for ARM64 Linux userspace access. It is not a full RK3576 board emulator.

The practical split is:

- Use `flipperone-dev` to get a quick browser-accessible UI.
- Use `flipperone-rootfs` to inspect a userspace that is closer to the Flipper One Linux rootfs.

## Known Limits

- No RK3576 kernel boot.
- No U-Boot flow.
- No hardware drivers or peripherals.
- No real MCU, modem, Wi-Fi, M.2, battery, or power management devices.
- UI hardware status may be incomplete or fake because the real device tree is absent.

This is still useful for inspecting current userspace behavior, checking web UI assumptions, and developing container-friendly workflows around the public repositories.
