#!/usr/bin/env bash
# build.sh — Build reproduzível do núcleo snes9x2002 (libretro) para WebAssembly (SNES Lab)
# Fonte pinada:    https://github.com/libretro/snes9x2002 @ 6ffbf9ef4f0063e1f1b78a40d10c50fc52f2524c
# Compilador:      Emscripten emcc 3.1.56 (mesma versão do núcleo Stella/Atari, compatível com Chromium M85)
# WASM single-thread escalar: -O3 -flto, SEM -pthread, SEM -msimd128. Caminho SEM ASM (ppu_.c/gfx.c/tile.c, -D__OLD_RASTER_FX__).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="${SCRIPT_DIR}/snes9x2002"
OUT="${SCRIPT_DIR}/build"
REPO="https://github.com/libretro/snes9x2002.git"
PIN="6ffbf9ef4f0063e1f1b78a40d10c50fc52f2524c"
[ -d "$SRC" ] || git clone "$REPO" "$SRC"
git -C "$SRC" checkout "$PIN"
mkdir -p "$OUT"
EMCC="${EMCC:-emcc}"; "$EMCC" --version | head -1
INC=(-I"$SRC" -I"$SRC/libretro" -I"$SRC/libretro/libretro-common/include" -I"$SRC/src")
DEF=(-D__OLD_RASTER_FX__ -DHAVE_STRINGS_H -DHAVE_STDINT_H -DHAVE_INTTYPES_H -D__LIBRETRO__ -DUSE_SA1)
CFLAGS=(-O3 -flto -DNDEBUG -mno-simd128 -fomit-frame-pointer -w)
SRCS=(
 src/apu.c src/apuaux.c src/c4.c src/c4emu.c src/cheats.c src/cheats2.c src/clip.c src/data.c
 src/dsp1.c src/fxemu.c src/fxinst.c src/globals.c src/dma.c src/memmap.c src/cpu.c src/cpuexec.c
 src/cpuops.c src/sa1.c src/sa1cpu.c src/sdd1.c src/sdd1emu.c src/snapshot.c src/soundux.c
 src/spc700.c src/srtc.c src/ppu_.c src/gfx.c src/tile.c
 libretro/libretro.c libretro/libretro-common/streams/memory_stream.c
)
OBJS=()
for s in "${SRCS[@]}"; do
  o="$OUT/$(echo "$s" | tr '/.' '__').o"
  "$EMCC" -c "$SRC/$s" -o "$o" "${CFLAGS[@]}" "${DEF[@]}" "${INC[@]}"
  OBJS+=("$o")
done
EXPORTS='["_retro_init","_retro_deinit","_retro_api_version","_retro_get_system_info","_retro_get_system_av_info","_retro_set_environment","_retro_set_video_refresh","_retro_set_audio_sample","_retro_set_audio_sample_batch","_retro_set_input_poll","_retro_set_input_state","_retro_set_controller_port_device","_retro_reset","_retro_run","_retro_load_game","_retro_unload_game","_retro_get_region","_retro_serialize_size","_retro_serialize","_retro_unserialize","_retro_get_memory_data","_retro_get_memory_size","_malloc","_free"]'
RT='["cwrap","ccall","addFunction","removeFunction","UTF8ToString","stringToUTF8","HEAPU8","HEAP8","HEAPU16","HEAP16","HEAPU32","HEAP32","HEAPF32"]'
"$EMCC" "${OBJS[@]}" -o "$OUT/snes9x2002.js" \
  -O3 -flto -mno-simd128 -sWASM=1 -sMODULARIZE=1 -sEXPORT_NAME=Snes9xCore \
  -sALLOW_TABLE_GROWTH=1 -sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=67108864 \
  -sFILESYSTEM=0 -sENVIRONMENT='web,node' \
  -sEXPORTED_FUNCTIONS="$EXPORTS" -sEXPORTED_RUNTIME_METHODS="$RT"
ls -lh "$OUT/snes9x2002.wasm" "$OUT/snes9x2002.js"
echo "Copie snes9x2002.wasm e snes9x2002.js para ../../snes-core/js/"
