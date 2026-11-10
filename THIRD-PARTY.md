# Third-party components and their licenses

The original application code of this project is under the MIT License (see LICENSE).
The components below are third-party and keep their own licenses. This project is
free and non-commercial.

## snes9x2002 (emulation core)
- Files: `js/snes9x2002.wasm`, `js/snes9x2002.js` (compiled with Emscripten).
- Origin: https://github.com/libretro/snes9x2002 (derived from Snes9x).
- License: the Snes9x license. Snes9x and its derivatives are free for
  non-commercial use; they may be redistributed provided the license and
  credits are kept, and may not be sold or used commercially.
- This project does not sell the core nor the application. The core is bundled
  only to run the emulator on the target TV.
- Build reproducibility: see `core/` (build.sh and VERSION.md), Emscripten
  emcc 3.1.56, single-thread scalar, `-mno-simd128`.

## 240p Test Suite (bundled free ROM)
- File: `roms_pub/240pSuite.sfc`.
- Author: Artemio Urbina and contributors.
- License: GNU GPL v2 (`roms_pub/240pSuite-GPLv2.txt`).
- Source and documentation: https://github.com/ArtemioUrbina/240pTestSuite
  and http://junkerhq.net/xrgb/index.php/240p_test_suite
- The binary is redistributed unmodified; corresponding source is publicly
  available at the links above. See `roms_pub/CREDITS.md`.

## Artwork
- Controller photo (`img/joy_photo.jpg`): photo by Ravi Palwe on Unsplash
  (https://unsplash.com/photos/_Vrw58wU4aI), used under the Unsplash License
  (free for commercial and non-commercial use, attribution not required;
  credited here regardless).
- The highlight overlays (`img/overlays/`), the app icon and the selection
  wallpaper are authored for this project.

## Commercial ROMs
- Commercial game ROMs are NOT included in this repository. The private `roms/`
  folder and `roms.json` are git-ignored. Only freely distributable ROMs ship
  in `roms_pub/`.
