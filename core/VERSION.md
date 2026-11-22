# snes9x2005 (WASM) — build record
- Fonte: https://github.com/libretro/snes9x2005 @ a79dfe9047e7fec58808aefe48ad2bf499c7af11
- Emscripten: emcc 3.1.56 (cf90417346b78455089e64eb909d71d091ecc055)
- Flags: -O3 -flto -DNDEBUG -DLOAD_FROM_MEMORY -mno-simd128 -fomit-frame-pointer -fno-strict-aliasing (single-thread escalar, Chromium M85; sem -pthread, sem -msimd128)
- APU padrao (apu.c / soundux.c / spc700.c). ROM em memoria (-DLOAD_FROM_MEMORY, FILESYSTEM=0).
- EXPORT_NAME=Snes9xCore ; INITIAL_MEMORY=64MB ; FILESYSTEM=0 ; MODULARIZE=1
- Saida: snes9x2005.wasm (633134 bytes) + snes9x2005.js (19128 bytes) -> ../js/
- Pixel format RGB565. av_info: 256x224, fps 59.923 (NTSC), sample_rate 32040.
- Build reproduzivel equivalente no repositorio de trabalho: cores/snes9x2005/ (build.sh e build.ps1).

## Reproduzir
No Linux/WSL: `cd core && ./build.sh`  (emcc 3.1.56 no PATH)
