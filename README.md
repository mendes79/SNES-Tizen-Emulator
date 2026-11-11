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

## Installation

### 1. Enable Developer Mode on your TV

1. From the Apps screen, press `1 2 3 4 5` on the remote.
2. Toggle Developer Mode = ON.
3. Enter your PC's LAN IP in Host PC IP.
4. Reboot the TV.

### 2. Build, sign and install the app

Samsung signs every TV app with a certificate bound to that specific TV's DUID,
so a prebuilt `.wgt` cannot be shared between TVs. Using Tizen Studio on Windows,
create a Samsung certificate with your TV's DUID, then build, sign and install
the app over the network and launch it. This is a one-time setup; later installs
are quick.

Need a detailed step by step with screenshots? See the installation guide:
[docs/INSTALL.md](docs/INSTALL.md) (Portuguese:
[docs/INSTALACAO.md](docs/INSTALACAO.md)).

## License

- Original application code: MIT (see LICENSE).
- Third-party components keep their own licenses (see THIRD-PARTY.md): the
  snes9x2002 core under the Snes9x non-commercial license, and the 240p Test
  Suite under GPL v2. This project is free and non-commercial.

## Legal Disclaimer

This project is an independent, unofficial emulator developed for educational
purposes only.

- This repository does not include any copyrighted ROMs or proprietary assets.
  The only bundled ROM is the 240p Test Suite, freely distributable under
  GPL v2.
- Users must provide their own legally obtained SNES ROMs to play other games.
  Private commercial ROMs stay local and are never published.
- This project is not affiliated with, endorsed by or associated with Nintendo
  or the Super Nintendo Entertainment System.
- All trademarks and registered trademarks are the property of their respective
  owners.

## Credits

- snes9x2002 core: the Snes9x authors and the libretro team.
- 240p Test Suite: Artemio Urbina and contributors.
- Controller photo: Ravi Palwe on Unsplash (Unsplash License).
- GameBoy reference harness and the lilauncher project, which this emulator
  plugs into.

## Related

- lilauncher (custom TV home screen): https://github.com/mendes79/lilauncher
