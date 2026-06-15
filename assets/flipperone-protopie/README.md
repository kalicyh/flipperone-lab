# Flipper One ProtoPie Assets

Assets collected from the public ProtoPie Cloud prototype:

```text
https://cloud.protopie.io/p/8b3ce95e854c87471d14d3a0
```

Use these as local lab/reference assets. Check rights before publishing them in a public release or production UI.

## Main Overlay

Use this file when wrapping the lab UI in the Flipper One device shell:

```text
flipperone-shell-overlay.png
```

It is a copy of:

```text
images/000-6c984a918eec5dcf7d09f9a4d671e137d8f35888.png
```

Image metrics:

```text
size: 2622 x 1206
format: PNG RGBA
alpha: yes
screen transparent hole: x=884, y=292, width=892, height=501
```

The screen center is transparent, so the UI can be placed behind this PNG and clipped/aligned to the screen rectangle.

The lab UI uses this asset through:

```text
config/device-shell.json
```

When running with `scripts/02-run-dev.sh` or `scripts/05-run-rootfs.sh`, this asset directory is bind-mounted into the container. Replacing `flipperone-shell-overlay.png` or editing the JSON config only needs a browser refresh, not an image rebuild.

## Folder Contents

```text
images/                         All extracted PNG image resources
flipperone-shell-overlay.png    Friendly name for the main device shell overlay
screen-overlay-metrics.json     Screen rectangle measured from the main overlay
resources-ua.json               Network resources captured from a desktop Chrome user agent
cloud-data-resources.json       Filtered cloud-data.protopie.io resource list
page-ua.png                     Screenshot of the loaded prototype without browser chrome
thumbnail.png                   Public preview thumbnail from the page metadata
top-images.txt                  Largest extracted images with dimensions
page*.html, resources.json      Raw fetch/debug outputs
```

## Observed VNC Key Mapping

This mapping was observed in the current VNC/UI flow, not inside the ProtoPie prototype:

```text
M = down
I = up
L = right
J = left
K = confirm
H = background / task switcher
N = back
Z = close current background item, also behaves like back in some cases
Z X C V B = likely the five physical buttons below the screen
B = also behaves like confirm in some cases
```
