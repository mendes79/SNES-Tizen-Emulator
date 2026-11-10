// adapter-stella.js — Frontend Libretro Mínimo para Stella 2014 WASM (Etapa 2 de PLANO-ATARI-WASM.md)
// Implementa a mesma Fronteira Canônica de Adaptador:
//   init(romBytes, romName), runFrame() -> ImageData, pushInput(state), getAudio(outFloat32Array),
//   reset(), getTargetFps(), getVideoStandardName(), getFrameSize()
// Inclui cache de WebAssembly.Module compilado em IndexedDB (Etapa 4) e zero callbacks por scanline/sample no caminho quente.
(function (root) {
  "use strict";

  var IDB_NAME = "AtariWasmCacheDB";
  var IDB_STORE = "modules";
  var IDB_KEY = "snes9x2002_v1_3.1.56";

  var wasmModulePromise = null;
  var instancePromise = null;
  var Mod = null;

  var lastCompileMs = 0;
  var lastInstantiateMs = 0;

  // Callbacks registrados na tabela de funções do WASM (1x na inicialização)
  var envCbPtr = 0;
  var videoCbPtr = 0;
  var audioSampleCbPtr = 0;
  var audioBatchCbPtr = 0;
  var inputPollCbPtr = 0;
  var inputStateCbPtr = 0;

  // Estado de vídeo
  var pixelFormat = 2; // 1 = XRGB8888 (4 bytes), 2 = RGB565 (2 bytes)
  var frameWidth = 256;
  var frameHeight = 224;
  var targetFps = 60.0;
  var speedScale = 1.0;
  var sampleRateCore = 32040.0;
  var videoStdName = "NTSC";
  var imgData = null;
  var pixelsU32 = null;
  var rgbaBuffer = null;

  // LUT RGB565 -> ABGR8888 (little-endian p/ ImageData Uint32Array) pré-calculada (64 KB)
  var rgb565Lut = new Uint32Array(65536);
  (function initRgb565Lut() {
    for (var c = 0; c < 65536; c++) {
      var r5 = (c >> 11) & 0x1f;
      var g6 = (c >> 5) & 0x3f;
      var b5 = c & 0x1f;
      var r8 = (r5 << 3) | (r5 >> 2);
      var g8 = (g6 << 2) | (g6 >> 4);
      var b8 = (b5 << 3) | (b5 >> 2);
      rgb565Lut[c] = (0xff000000 | (b8 << 16) | (g8 << 8) | r8) >>> 0;
    }
  })();

  // Ring buffer de áudio a 44100 Hz (alimentado por retro_audio_sample_batch_cb 1x/quadro)
  // MAX_AUDIO_LEAD_SAMPLES limita a fila a ~110 ms (4850 samples), eliminando atraso perceptível sem jamais zerar o buffer!
  var HOST_SAMPLE_RATE = 44100;
  var RING_CAPACITY = 16384;
  var MAX_AUDIO_LEAD_SAMPLES = 4850; // ~110 ms a 44,1 kHz
  var TARGET_AUDIO_FILL = 3072;      // ~69 ms (1,5 blocos de 2048 do ScriptProcessor)
  var ringBuf = new Float32Array(RING_CAPACITY);   // canal L
  var ringBufR = new Float32Array(RING_CAPACITY);  // canal R (estereo)
  var ringRead = 0;
  var ringWrite = 0;
  var ringAvailable = 0;
  var resamplePhase = 0.0;
  var lastSampleOut = 0.0;
  var lastSampleOutR = 0.0;

  // Bitmask de input libretro (RETRO_DEVICE_JOYPAD)
  // 0=B(Fire), 2=Select, 3=Start(Reset), 4=Up, 5=Down, 6=Left, 7=Right
  var currentJoyMask = 0;
  var gameLoaded = false;
  var romBufPtr = 0;
  var romBufCap = 0;
  var gameInfoPtr = 0;
  var avInfoPtr = 0;

  // Strings de opções de core pré-alocadas em WASM RAM
  var optStrings = {};

  function allocateFramebuffer(w, h) {
    frameWidth = w;
    frameHeight = h;
    if (typeof ImageData !== "undefined") {
      imgData = new ImageData(w, h);
      rgbaBuffer = imgData.data;
      pixelsU32 = new Uint32Array(rgbaBuffer.buffer);
    } else {
      rgbaBuffer = new Uint8ClampedArray(w * h * 4);
      pixelsU32 = new Uint32Array(rgbaBuffer.buffer);
      imgData = { width: w, height: h, data: rgbaBuffer };
    }
    pixelsU32.fill(0xff000000);
  }
  allocateFramebuffer(256, 224);

  // IndexedDB helper para cachear o WebAssembly.Module compilado no M85
  function loadCachedModule() {
    return new Promise(function (resolve) {
      if (typeof indexedDB === "undefined") return resolve(null);
      try {
        var req = indexedDB.open(IDB_NAME, 1);
        req.onupgradeneeded = function (e) {
          var db = e.target.result;
          if (!db.objectStoreNames.contains(IDB_STORE)) {
            db.createObjectStore(IDB_STORE);
          }
        };
        req.onsuccess = function (e) {
          try {
            var db = e.target.result;
            var tx = db.transaction(IDB_STORE, "readonly");
            var getReq = tx.objectStore(IDB_STORE).get(IDB_KEY);
            getReq.onsuccess = function () { resolve(getReq.result || null); };
            getReq.onerror = function () { resolve(null); };
          } catch (err) { resolve(null); }
        };
        req.onerror = function () { resolve(null); };
      } catch (e) { resolve(null); }
    });
  }

  function saveCachedModule(mod) {
    if (typeof indexedDB === "undefined" || !mod) return;
    try {
      var req = indexedDB.open(IDB_NAME, 1);
      req.onsuccess = function (e) {
        try {
          var db = e.target.result;
          var tx = db.transaction(IDB_STORE, "readwrite");
          tx.objectStore(IDB_STORE).put(mod, IDB_KEY);
        } catch (err) {}
      };
    } catch (e) {}
  }

  function fetchWasmBytes(url) {
    return new Promise(function (resolve, reject) {
      if (typeof XMLHttpRequest !== "undefined") {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", url, true);
        xhr.responseType = "arraybuffer";
        xhr.onload = function () {
          if ((xhr.status >= 200 && xhr.status < 300) || (xhr.status === 0 && xhr.response)) {
            resolve(new Uint8Array(xhr.response));
          } else {
            reject(new Error("Falha ao carregar " + url + " (HTTP " + xhr.status + ")"));
          }
        };
        xhr.onerror = function () { reject(new Error("Erro XHR ao carregar " + url)); };
        xhr.send();
      } else if (typeof require !== "undefined") {
        var fs = require("fs");
        var path = require("path");
        resolve(new Uint8Array(fs.readFileSync(path.resolve(url))));
      } else {
        reject(new Error("Sem mecanismo para ler " + url));
      }
    });
  }

  function allocCString(str) {
    var len = (str.length << 2) + 1;
    var ptr = Mod._malloc(len);
    Mod.stringToUTF8(str, ptr, len);
    return ptr;
  }

  // Callback de ambiente libretro
  function onRetroEnvironment(cmd, dataPtr) {
    var rawCmd = cmd & 0xffff;
    switch (rawCmd) {
      case 10: // RETRO_ENVIRONMENT_SET_PIXEL_FORMAT
        var fmt = Mod.HEAP32[dataPtr >> 2];
        if (fmt === 2 || fmt === 1) { // 2 = RGB565, 1 = XRGB8888
          pixelFormat = fmt;
          return 1;
        }
        return 0;

      case 15: // RETRO_ENVIRONMENT_GET_VARIABLE
        var keyPtr = Mod.HEAPU32[dataPtr >> 2];
        if (!keyPtr) return 0;
        var key = Mod.UTF8ToString(keyPtr);
        var valPtr = optStrings[key] || 0;
        Mod.HEAPU32[(dataPtr >> 2) + 1] = valPtr;
        return valPtr ? 1 : 0;

      case 17: // RETRO_ENVIRONMENT_GET_VARIABLE_UPDATE
        if (dataPtr) Mod.HEAPU8[dataPtr] = 0;
        return 0;

      case 51: // RETRO_ENVIRONMENT_GET_INPUT_BITMASKS
        return 1; // Ativa leitura em 1 chamada bitmask por frame!

      case 3: // RETRO_ENVIRONMENT_GET_CAN_DUPE
        if (dataPtr) Mod.HEAPU8[dataPtr] = 1;
        return 1;

      case 9:  // RETRO_ENVIRONMENT_GET_SYSTEM_DIRECTORY
      case 31: // RETRO_ENVIRONMENT_GET_SAVE_DIRECTORY
        if (dataPtr) Mod.HEAPU32[dataPtr >> 2] = optStrings["."] || 0;
        return 1;

      case 8:  // RETRO_ENVIRONMENT_SET_PERFORMANCE_LEVEL
      case 11: // RETRO_ENVIRONMENT_SET_INPUT_DESCRIPTORS
      case 16: // RETRO_ENVIRONMENT_SET_VARIABLES
      case 35: // RETRO_ENVIRONMENT_SET_CONTROLLER_INFO
      case 52: // RETRO_ENVIRONMENT_GET_CORE_OPTIONS_VERSION
      case 53: // RETRO_ENVIRONMENT_SET_CORE_OPTIONS
      case 54: // RETRO_ENVIRONMENT_SET_CORE_OPTIONS_INTL
      case 55: // RETRO_ENVIRONMENT_SET_CORE_OPTIONS_DISPLAY
        return 1;

      default:
        return 0;
    }
  }

  // Callback de vídeo (1x por quadro): converte RGB565/XRGB8888 para RGBA8888 do ImageData
  function onRetroVideoRefresh(dataPtr, width, height, pitch) {
    if (!dataPtr || width <= 0 || height <= 0) return;
    if (width !== frameWidth || height !== frameHeight || !imgData) {
      allocateFramebuffer(width, height);
    }

    var dst = pixelsU32;
    var dstIdx = 0;

    if (pixelFormat === 2) {
      // RGB565 (2 bytes por pixel)
      var heapU16 = Mod.HEAPU16;
      var rowU16 = dataPtr >>> 1;
      var pitchU16 = pitch >>> 1;
      for (var y = 0; y < height; y++) {
        var srcIdx = rowU16;
        for (var x = 0; x < width; x++) {
          dst[dstIdx++] = rgb565Lut[heapU16[srcIdx++]];
        }
        rowU16 += pitchU16;
      }
    } else {
      // XRGB8888 (0x00RRGGBB -> 0xFFBBGGRR)
      var heapU32 = Mod.HEAPU32;
      var rowU32 = dataPtr >>> 2;
      var pitchU32 = pitch >>> 2;
      for (var y2 = 0; y2 < height; y2++) {
        var srcIdx2 = rowU32;
        for (var x2 = 0; x2 < width; x2++) {
          var c = heapU32[srcIdx2++];
          dst[dstIdx++] = (0xff000000 | ((c & 0xff) << 16) | (c & 0xff00) | ((c >>> 16) & 0xff)) >>> 0;
        }
        rowU32 += pitchU32;
      }
    }
  }

  // Callback de áudio em lote (1x por quadro): int16 estéreo intercalado a 31400 Hz -> mono Float32 a 44100 Hz
  function onRetroAudioSampleBatch(dataPtr, frames) {
    if (!dataPtr || frames <= 0) return frames;
    var heap16 = Mod.HEAP16;
    var base16 = dataPtr >> 1;

    // IMPORTANTE: Em libretro.cxx, tiaSamplesPerFrame é calculado pelo framerate do 1º jogo carregado!
    // Portanto, usamos exatamente `frames` recebidos neste quadro para gerar os samples de saída necessários
    // para 1 quadro em (targetFps * speedScale), com ajuste suave de nível em torno de TARGET_AUDIO_FILL (3072 samples = ~69ms).
    var effectiveFps = (targetFps || 60.0) * speedScale;
    var hostSamplesPerFrame = HOST_SAMPLE_RATE / effectiveFps;
    var fillError = ringAvailable - TARGET_AUDIO_FILL;
    // Se o buffer estiver abaixo do alvo (fillError < 0), reduzimos ligeiramente o passo (gerando +samples p/ repor o buffer).
    // Se estiver acima do alvo (fillError > 0), aumentamos ligeiramente o passo (gerando -samples p/ conter a latência).
    var adjust = fillError * 0.000015;
    if (adjust > 0.025) adjust = 0.025;
    else if (adjust < -0.025) adjust = -0.025;

    var ratio = (frames / hostSamplesPerFrame) * (1.0 + adjust);
    var pos = resamplePhase;

    while (pos < frames) {
      var idx = (pos | 0) << 1;
      // int16 estereo intercalado [L,R] normalizado para float [-1..1]
      var sampleL = heap16[base16 + idx] * 0.000030517578125;
      var sampleR = heap16[base16 + idx + 1] * 0.000030517578125;
      ringBuf[ringWrite] = sampleL;
      ringBufR[ringWrite] = sampleR;
      ringWrite = (ringWrite + 1) & (RING_CAPACITY - 1);
      if (ringAvailable < MAX_AUDIO_LEAD_SAMPLES) {
        ringAvailable++;
      } else {
        ringRead = (ringRead + 1) & (RING_CAPACITY - 1);
      }
      pos += ratio;
    }
    resamplePhase = pos - frames;
    if (resamplePhase < 0) resamplePhase = 0;
    return frames;
  }

  function onRetroAudioSample(left, right) {}
  function onRetroInputPoll() {}

  function onRetroInputState(port, device, index, id) {
    if (port !== 0) return 0;
    if (device === 1) { // RETRO_DEVICE_JOYPAD
      if (id === 256) { // RETRO_DEVICE_ID_JOYPAD_MASK
        return currentJoyMask;
      }
      return (currentJoyMask >>> id) & 1;
    }
    return 0;
  }

  function ensureStellaLoaded(wasmUrl) {
    if (instancePromise) return instancePromise;
    var url = wasmUrl || "js/snes9x2002.wasm";

    instancePromise = Promise.all([
      loadCachedModule(),
      wasmModulePromise || fetchWasmBytes(url)
    ]).then(function (res) {
      var cachedMod = res[0];
      var wasmBytes = res[1];
      if (cachedMod) {
        lastCompileMs = 0;
        return cachedMod;
      }
      var tComp0 = typeof performance !== "undefined" ? performance.now() : Date.now();
      return WebAssembly.compile(wasmBytes).then(function (compiled) {
        var tComp1 = typeof performance !== "undefined" ? performance.now() : Date.now();
        lastCompileMs = Math.max(0, tComp1 - tComp0);
        saveCachedModule(compiled);
        return compiled;
      });
    }).then(function (compiledModule) {
      var tInst0 = typeof performance !== "undefined" ? performance.now() : Date.now();
      return root.Snes9xCore({
        instantiateWasm: function (imports, successCallback) {
          WebAssembly.instantiate(compiledModule, imports).then(function (inst) {
            var tInst1 = typeof performance !== "undefined" ? performance.now() : Date.now();
            lastInstantiateMs = Math.max(0, tInst1 - tInst0);
            successCallback(inst, compiledModule);
          });
          return {};
        }
      });
    }).then(function (moduleInstance) {
      Mod = moduleInstance;

      // Aloca strings de opções de core (sem blending por software e sem filtro passa-baixa extra)
      optStrings["."] = allocCString(".");

      envCbPtr = Mod.addFunction(onRetroEnvironment, "iii");
      videoCbPtr = Mod.addFunction(onRetroVideoRefresh, "viiii");
      audioSampleCbPtr = Mod.addFunction(onRetroAudioSample, "vii");
      audioBatchCbPtr = Mod.addFunction(onRetroAudioSampleBatch, "iii");
      inputPollCbPtr = Mod.addFunction(onRetroInputPoll, "v");
      inputStateCbPtr = Mod.addFunction(onRetroInputState, "iiiii");

      Mod._retro_set_environment(envCbPtr);
      Mod._retro_set_video_refresh(videoCbPtr);
      Mod._retro_set_audio_sample(audioSampleCbPtr);
      Mod._retro_set_audio_sample_batch(audioBatchCbPtr);
      Mod._retro_set_input_poll(inputPollCbPtr);
      Mod._retro_set_input_state(inputStateCbPtr);
      Mod._retro_init();

      gameInfoPtr = Mod._malloc(16); // struct retro_game_info { path, data, size, meta }
      avInfoPtr = Mod._malloc(64);   // struct retro_system_av_info
      return Mod;
    });

    return instancePromise;
  }

  var StellaAdapter = {
    name: "Snes9x2002 (WASM)",

    init: function (romBytes, romName, wasmUrl) {
      return ensureStellaLoaded(wasmUrl).then(function () {
        if (gameLoaded) {
          Mod._retro_unload_game();
          gameLoaded = false;
        }

        var bytes = romBytes instanceof Uint8Array ? romBytes : new Uint8Array(romBytes);
        if ((bytes.length % 1024) === 512) { bytes = bytes.subarray(512); } // remove header SMC
        if (bytes.length > romBufCap) {
          if (romBufPtr) Mod._free(romBufPtr);
          romBufCap = Math.max(bytes.length, 65536);
          romBufPtr = Mod._malloc(romBufCap);
        }
        Mod.HEAPU8.set(bytes, romBufPtr);

        // Preenche retro_game_info { path=0, data=romBufPtr, size=bytes.length, meta=0 }
        Mod.HEAPU32[(gameInfoPtr >> 2) + 0] = 0;
        Mod.HEAPU32[(gameInfoPtr >> 2) + 1] = romBufPtr;
        Mod.HEAPU32[(gameInfoPtr >> 2) + 2] = bytes.length;
        Mod.HEAPU32[(gameInfoPtr >> 2) + 3] = 0;

        var ok = Mod._retro_load_game(gameInfoPtr);
        if (!ok) {
          throw new Error("Stella retro_load_game falhou para " + romName);
        }
        gameLoaded = true;

        // Lê retro_system_av_info:
        // geometry: base_width(u32 @0), base_height(u32 @4), max_width(u32 @8), max_height(u32 @12), aspect_ratio(f32 @16)
        // timing (alinhado em 8 bytes @24): fps(f64 @24), sample_rate(f64 @32)
        Mod._retro_get_system_av_info(avInfoPtr);
        var f64Idx = (avInfoPtr + 24) >> 3;
        var fps = new Float64Array(Mod.HEAPU8.buffer, avInfoPtr + 24, 2)[0];
        var srate = new Float64Array(Mod.HEAPU8.buffer, avInfoPtr + 24, 2)[1];

        if (fps > 40 && fps < 70) {
          targetFps = fps > 55 ? 60.0 : 50.0;
          videoStdName = fps > 55 ? "NTSC" : "PAL";
        } else {
          targetFps = 60.0;
          videoStdName = "NTSC";
        }
        if (srate > 10000 && srate < 96000) {
          sampleRateCore = srate;
        }

        ringRead = 0;
        ringWrite = 0;
        ringAvailable = 0;
        resamplePhase = 0.0;
        lastSampleOut = 0.0;
        lastSampleOutR = 0.0;
        currentJoyMask = 0;
        // Pré-aquece 2048 amostras silenciosas (~46ms) para absorver o 1º callback de áudio sem underrun inicial
        for (var p = 0; p < 2048; p++) {
          ringBuf[p] = 0.0;
          ringBufR[p] = 0.0;
        }
        ringWrite = 2048;
        ringAvailable = 2048;

        return true;
      });
    },

    runFrame: function () {
      if (Mod && gameLoaded) {
        Mod._retro_run();
      }
      return imgData;
    },

    pushInput: function (state) {
      if (!state) return;
      var mask = 0;
      // Compat com o app atual (Atari-style): fire->B, select->SELECT, reset->START
      if (state.fire)   mask |= (1 << 0);
      if (state.select) mask |= (1 << 2);
      if (state.reset)  mask |= (1 << 3);
      // SNES-style (quando o app enviar o pad completo)
      if (state.b)      mask |= (1 << 0);  // B
      if (state.y)      mask |= (1 << 1);  // Y
      if (state.start)  mask |= (1 << 3);  // START
      if (state.a)      mask |= (1 << 8);  // A
      if (state.x)      mask |= (1 << 9);  // X
      if (state.l)      mask |= (1 << 10); // L
      if (state.r)      mask |= (1 << 11); // R
      if (state.up)     mask |= (1 << 4);
      if (state.down)   mask |= (1 << 5);
      if (state.left)   mask |= (1 << 6);
      if (state.right)  mask |= (1 << 7);
      currentJoyMask = mask;
    },

    getAudio: function (outFloat32Array) {
      var needed = outFloat32Array.length;
      var count = ringAvailable < needed ? ringAvailable : needed;
      for (var i = 0; i < count; i++) {
        lastSampleOut = ringBuf[ringRead];
        outFloat32Array[i] = lastSampleOut;
        ringRead = (ringRead + 1) & (RING_CAPACITY - 1);
      }
      ringAvailable -= count;
      // Se ocorrer micro-underrun, mantém o nível DC da última amostra com decaimento suave (evita estalo grave de degrau para 0!)
      for (var j = count; j < needed; j++) {
        lastSampleOut *= 0.985;
        outFloat32Array[j] = lastSampleOut;
      }
      return count;
    },

    getAudioStereo: function (outL, outR) {
      var needed = outL.length;
      var count = ringAvailable < needed ? ringAvailable : needed;
      for (var i = 0; i < count; i++) {
        lastSampleOut = ringBuf[ringRead];
        lastSampleOutR = ringBufR[ringRead];
        outL[i] = lastSampleOut;
        outR[i] = lastSampleOutR;
        ringRead = (ringRead + 1) & (RING_CAPACITY - 1);
      }
      ringAvailable -= count;
      // micro-underrun: mantem nivel DC com decaimento suave nos dois canais
      for (var j = count; j < needed; j++) {
        lastSampleOut *= 0.985; lastSampleOutR *= 0.985;
        outL[j] = lastSampleOut; outR[j] = lastSampleOutR;
      }
      return count;
    },

    getAudioAvailable: function () {
      return ringAvailable;
    },

    reset: function () {
      if (Mod && gameLoaded) {
        Mod._retro_reset();
      }
    },

    getTargetFps: function () {
      return targetFps;
    },

    setSpeedScale: function (scale) {
      if (scale > 0.5 && scale <= 1.2) {
        speedScale = scale;
      }
    },

    getSpeedScale: function () {
      return speedScale;
    },

    getVideoStandardName: function () {
      return videoStdName;
    },

    getFrameSize: function () {
      return { width: frameWidth, height: frameHeight };
    },

    getLoadTimings: function () {
      return {
        compileMs: lastCompileMs,
        instantiateMs: lastInstantiateMs
      };
    }
  };

  root.CoreAdapters = root.CoreAdapters || {};
  root.CoreAdapters.snes9x = StellaAdapter;
})(typeof window !== "undefined" ? window : globalThis);

