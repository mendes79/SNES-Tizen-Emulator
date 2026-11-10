# SNES Tizen Emulator

A Super Nintendo emulator for Samsung Smart TVs running Tizen, packaged as a
web app (`.wgt`) and launched from the lilauncher home screen. It runs the
snes9x2002 core recompiled to WebAssembly and plays at full speed on a modest
TV SoC.

Portuguese version: see [README.pt-BR.md](README.pt-BR.md).

## What it is

- Target device: Samsung 65BU8000 (2022, Crystal UHD), Tizen 6.5, web engine
  Chromium M85.
- Core: snes9x2002 recompiled to a lean single-thread scalar WebAssembly module
  (no SIMD, no threads), so it validates and runs on the old Chromium M85.
- Delivered as a Tizen `.wgt` package. It is the same WebView used by the TV
  browser, so there is no native binary on the app side.

## Features

- Full-speed emulation on the target TV (validated with an honest speed meter:
  emulated frames per real second, not nominal FPS).
- Game selection screen rendered over a themed wallpaper, with vertical
  navigation and a settings panel.
- Settings: sound on/off and speed reduction presets (100%, -6%, -8%, -10%),
  persisted locally.
- Interactive joystick configuration: a guided wizard maps each button, with a
  live controller diagram that highlights the pressed button.
- Controller: 8BitDo Ultimate 2.4G (USB HID dongle) via the Gamepad API.
  Select+Start returns to the carousel from a game.
- Catalog split: private commercial ROMs stay local and are never published;
  freely distributable ROMs ship in `roms_pub/`.

## Included free ROM

- 240p Test Suite (SNES) by Artemio Urbina, GNU GPL v2. A video test suite that
  also works as a free test ROM for the emulator. See `roms_pub/CREDITS.md`.

## Repository layout

- `index.html` plus `js/` : the application (UI, input, audio, HUD, libretro
  frontend adapter).
- `js/snes9x2002.wasm` / `js/snes9x2002.js` : the compiled core.
- `core/` : core build record (reproducible build with Emscripten 3.1.56).
- `img/` : wallpaper, app icon, controller diagram and highlight overlays.
- `roms_pub/` : freely distributable ROMs (published).
- `roms/`, `roms.json` : private commercial ROMs and catalog (git-ignored, not
  published).

## Build and install (overview)

Tooling is Tizen Studio on Windows (sdb.exe and the tizen CLI) with a Samsung
signing profile. The short path is:

1. Enable Developer Mode on the TV and note its IP.
2. Build and sign the `.wgt` with your Samsung certificate profile.
3. Install over the network with sdb/tizen CLI and launch.

Important about distribution: Samsung TV app signing uses a distributor
certificate bound to the specific TV's DUID. A `.wgt` signed for one TV will not
install on another person's TV. Each user must create a certificate with their
own TV's DUID (Samsung account plus the Samsung Certificate Extension) and sign
the package themselves. A detailed, illustrated installation guide is planned.

## License

- Original application code: MIT (see LICENSE).
- Third-party components keep their own licenses (see THIRD-PARTY.md): the
  snes9x2002 core under the Snes9x non-commercial license, and the 240p Test
  Suite under GPL v2. This project is free and non-commercial.

## Credits

- snes9x2002 core: the Snes9x authors and the libretro team.
- 240p Test Suite: Artemio Urbina and contributors.
- GameBoy reference harness and the lilauncher project, which this emulator
  plugs into.

## Related

- lilauncher (custom TV home screen): https://github.com/mendes79/lilauncher
