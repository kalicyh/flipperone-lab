# Flipper One Key Mapping

This note tracks the mapping used by the lab device shell. It combines three
layers:

- MCU firmware physical input bits
- Linux kernel evdev key codes
- The current `fake-flipctl2` browser key map used by `flipperone-dev`

The editable runtime source for the shell hit areas is:

```text
config/key-map.json
```

The run scripts bind-mount `config/` into the container, so key hit areas can be
edited without rebuilding the image. Change the JSON, then refresh the browser.

## Sources

Current source snapshots used for this mapping:

```text
flipperone-mcu-firmware dev a6bee37
flipper-linux-kernel flipper-devel 0a148c9
upstream/flipperone-testing fake-flipctl2/js/input.js e29fe86
```

The MCU firmware and kernel snapshots were read from temporary clones under
`.build/research/`; they are not committed into this repository.

## Confirmed Physical Inputs

The MCU firmware defines `InputKeyMask = 0x1FFF`, so the Flipper One button
state register has 13 physical input bits:

| Firmware key | I2C bit | MCU name | Kernel name | Linux key | Browser key | Current fake UI action |
| --- | ---: | --- | --- | --- | --- | --- |
| `InputKey2` | 0 | `Key2` | `FO_BTN_VIEW` | `KEY_X` | `x` | `edit` |
| `InputKey1` | 1 | `Key1` | `FO_BTN_ESCAPE` | `KEY_Z` | `z` | `esc` |
| `InputKey3` | 2 | `Power` | `FO_BTN_POWER` | `KEY_C` | `c` | `power` |
| `InputKey4` | 3 | `Key4` | `FO_BTN_EDIT` | `KEY_V` | `v` | `del` |
| `InputKey5` | 4 | `Key5` | `FO_BTN_RUN` | `KEY_B` | `b` | `run` |
| `InputKeySw` | 5 | `Sw` | `FO_BTN_APPSELECT` | `KEY_TAB` | `Tab` | `appsw` |
| `InputKeyBack` | 6 | `Back` | `FO_BTN_BACK` | `KEY_BACKSPACE` | `Backspace` | `back` |
| `InputKeyDown` | 7 | `Down` | `FO_BTN_DOWN` | `KEY_DOWN` | `ArrowDown` | `down` |
| `InputKeyRight` | 8 | `Right` | `FO_BTN_RIGHT` | `KEY_RIGHT` | `ArrowRight` | `right` |
| `InputKeyOk` | 9 | `OK` | `FO_BTN_CENTER` | `KEY_ENTER` | `Enter` | `ok` |
| `InputKeyLeft` | 10 | `Left` | `FO_BTN_LEFT` | `KEY_LEFT` | `ArrowLeft` | `left` |
| `InputKeyUp` | 11 | `Up` | `FO_BTN_UP` | `KEY_UP` | `ArrowUp` | `up` |
| `InputKeyPtt` | 12 | `PTT` | `FO_BTN_PTT` | `KEY_A` | `a` | `ptt` |

## Browser Aliases

`fake-flipctl2/js/input.js` also accepts these keyboard aliases:

| Action | Primary browser key | Alias keys |
| --- | --- | --- |
| `up` | `ArrowUp` | `i` |
| `down` | `ArrowDown` | `m` |
| `left` | `ArrowLeft` | `j` |
| `right` | `ArrowRight` | `l` |
| `ok` | `Enter` | `k` |
| `appsw` | `Tab` | `h` |
| `back` | `Backspace` | `Escape`, `n` |
| `ptt` | `a` | none |
| `esc` | `z` | none |
| `edit` | `x` | none |
| `power` | `c` | none |
| `del` | `v` | none |
| `run` | `b` | none |

## Important Drift

The current kernel driver names the bottom-row `KEY_X` button `View` and
`KEY_V` button `Edit`.

The current `fake-flipctl2` runtime maps:

```text
x -> edit
v -> del
```

So the lab shell sends the browser keys that the current fake UI expects, while
`config/key-map.json` keeps the kernel names beside them for traceability.

## Shell Hit Areas

`config/key-map.json` stores each clickable device-shell button as an image-space
rectangle:

```json
{
  "browserKey": "ArrowUp",
  "hitArea": { "x": 2030, "y": 350, "width": 175, "height": 135 }
}
```

Coordinates are based on the 2622x1206 overlay image. To tune them:

1. Set `"debugHitAreas": true`.
2. Refresh `http://127.0.0.1:8899`.
3. Adjust the `hitArea` rectangles.
4. Set `"debugHitAreas": false` when done.

No image rebuild is needed for these edits.

## Real Hardware Verification

On a real Flipper One Linux boot, the kernel exposes:

```text
/dev/input/event0  Flipper One Buttons   phys flipper-one-input/input0
/dev/input/event1  Flipper One Touchpad  phys flipper-one-input/input1
```

Use `evtest /dev/input/event0` or `libinput debug-events` to confirm each
physical key's emitted `KEY_*` code.
