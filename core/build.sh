#!/usr/bin/env bash
# build.sh — Build reproduzível do núcleo snes9x2005 (libretro) para WebAssembly, saída em ../js/
# Fonte pinada: https://github.com/libretro/snes9x2005 @ a79dfe9047e7fec58808aefe48ad2bf499c7af11
# emcc 3.1.56, single-thread escalar (Chromium M85): -O3 -flto -mno-simd128, sem threads. ROM em memoria: -DLOAD_FROM_MEMORY.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="${SCRIPT_DIR}/snes9x2005"
OUT="${SCRIPT_DIR}/build"
PIN="a79dfe9047e7fec58808aefe48ad2bf499c7af11"
[ -d "$SRC" ] || git clone https://github.com/libretro/snes9x2005.git "$SRC"
git -C "$SRC" checkout "$PIN"
mkdir -p "$OUT"
EMCC="${EMCC:-emcc}"; "$EMCC" --version | head -1
INC=(-I"$SRC/source" -I"$SRC" -I"$SRC/libretro-common/include")
CFLAGS=(-O3 -flto -DNDEBUG -DLOAD_FROM_MEMORY -mno-simd128 -fomit-frame-pointer -fno-strict-aliasing -w)
CORE=(c4.c c4emu.c cheats2.c cheats.c clip.c cpu.c cpuexec.c cpuops.c data.c dma.c dsp1.c \
 fxemu.c fxinst.c gfx.c getset.c globals.c memmap.c obc1.c ppu.c sa1.c sa1cpu.c sdd1.c \
 sdd1emu.c seta010.c seta011.c seta018.c seta.c spc7110.c spc7110dec.c srtc.c tile.c \
 apu.c soundux.c spc700.c)
OBJS=()
for s in "${CORE[@]}"; do o="$OUT/core_${s//\//_}.o"; "$EMCC" -c "$SRC/source/$s" -o "$o" "${CFLAGS[@]}" "${INC[@]}"; OBJS+=("$o"); done
"$EMCC" -c "$SRC/libretro.c" -o "$OUT/libretro.o" "${CFLAGS[@]}" "${INC[@]}"; OBJS+=("$OUT/libretro.o")
EXPORTS='["_retro_init","_retro_deinit","_retro_api_version","_retro_get_system_info","_retro_get_system_av_info","_retro_set_environment","_retro_set_video_refresh","_retro_set_audio_sample","_retro_set_audio_sample_batch","_retro_set_input_poll","_retro_set_input_state","_retro_set_controller_port_device","_retro_reset","_retro_run","_retro_load_game","_retro_unload_game","_retro_get_region","_retro_serialize_size","_retro_serialize","_retro_unserialize","_retro_get_memory_data","_retro_get_memory_size","_malloc","_free"]'
RT='["cwrap","ccall","addFunction","removeFunction","UTF8ToString","stringToUTF8","HEAPU8","HEAP8","HEAPU16","HEAP16","HEAPU32","HEAP32","HEAPF32"]'
"$EMCC" "${OBJS[@]}" -o "$OUT/snes9x2005.js" \
  -O3 -flto -mno-simd128 -sWASM=1 -sMODULARIZE=1 -sEXPORT_NAME=Snes9xCore \
  -sALLOW_TABLE_GROWTH=1 -sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=67108864 \
  -sFILESYSTEM=0 -sENVIRONMENT='web,node' \
  -sEXPORTED_FUNCTIONS="$EXPORTS" -sEXPORTED_RUNTIME_METHODS="$RT"
cp "$OUT/snes9x2005.wasm" "$OUT/snes9x2005.js" "${SCRIPT_DIR}/../js/"
ls -lh "${SCRIPT_DIR}/../js/snes9x2005.wasm" "${SCRIPT_DIR}/../js/snes9x2005.js"
