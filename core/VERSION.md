# snes9x2002 (WASM) — build record
- Fonte: https://github.com/libretro/snes9x2002 @ 6ffbf9ef4f0063e1f1b78a40d10c50fc52f2524c
- Emscripten: emcc 3.1.56
- Flags: -O3 -flto -mno-simd128 (single-thread escalar, M85) ; caminho sem ASM (-D__OLD_RASTER_FX__, ppu_.c/gfx.c/tile.c)
- EXPORT_NAME=Snes9xCore ; INITIAL_MEMORY=64MB ; FILESYSTEM=0
- Saída: snes9x2002.wasm (~634 KB) + snes9x2002.js (~20 KB) -> snes-core/js/
- Validado headless (container): SMW carrega, av_info 256x224 @59.923fps, sample_rate 32040, renderiza animando.
- Pixel format do core: RGB565. Áudio: int16 estéreo 32040 Hz (adapter usa canal esquerdo -> mono 44100).
