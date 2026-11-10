// hud.js — Instrumento de Métrica Honesta (Seção 4 de PLANO-ATARI-WASM.md)
// Custo quase-zero por frame: apenas contadores numéricos em RAM; 1 escrita DOM (textContent) por segundo (>=1000ms).
// Validado no controle GameBoy (gbemu/) e compartilhado com atari2600-core/.
(function (root) {
  "use strict";

  var STORAGE_KEY = "honestHudVisible";
  var engineName = "unknown";
  var romName = "";
  var targetFps = 60.0;
  var nominalLabel = "60 fps (alvo nao-confiavel)";
  var expectedSampleRate = 44100;

  // Contadores na janela atual (>= 1000ms)
  var winStart = 0;
  var warmup = true;
  var emuFrames = 0;
  var paintFrames = 0;
  var audioDelivered = 0;
  var audioExpected = 0;
  var audioBufferLevel = 0;
  var totalUnderruns = 0;
  var winUnderruns = 0;

  // Últimos valores consolidados (1x/s)
  var lastEmuPct = 0;
  var lastEmuFps = 0;
  var lastPaintFps = 0;
  var lastAudioPct = 0;
  var lastAudioHz = 0;
  var historyEmuPct = [];

  // Breakdown de carga (4 fases da Seção 4)
  var loadStats = {
    t0: 0,
    fetchMs: 0,
    fetchKb: 0,
    compileMs: 0,
    instantiateMs: 0,
    firstFrameMs: 0,
    firstFrameRecorded: false
  };

  var hudEl = null;
  var hudTextEl = null;
  var qrModalEl = null;
  var qrCanvasEl = null;
  var qrJsonEl = null;
  var visible = true;
  var qrVisible = false;

  try {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "0") visible = false;
  } catch (e) {}

  function ensureDom() {
    if (hudEl || typeof document === "undefined" || !document.body) return;
    hudEl = document.createElement("div");
    hudEl.id = "honest-hud";
    hudEl.style.cssText =
      "position:fixed;top:10px;left:10px;z-index:9999;background:rgba(0,0,0,0.82);" +
      "color:#e8f5e9;border:1px solid #4caf50;border-radius:6px;padding:8px 12px;" +
      "font:600 13px/1.38 ui-monospace,'Courier New',monospace;pointer-events:none;" +
      "white-space:pre;text-shadow:0 1px 2px #000;";
    hudTextEl = document.createElement("div");
    hudEl.appendChild(hudTextEl);
    document.body.appendChild(hudEl);

    qrModalEl = document.createElement("div");
    qrModalEl.id = "honest-hud-qr";
    qrModalEl.style.cssText =
      "position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.92);display:none;" +
      "flex-direction:column;align-items:center;justify-content:center;color:#fff;" +
      "font:14px/1.4 ui-monospace,'Courier New',monospace;padding:24px;";
    var title = document.createElement("div");
    title.style.cssText = "font-size:18px;font-weight:700;color:#81c784;margin-bottom:12px;";
    title.textContent = "DUMP DE TELEMETRIA HONESTA (QR + JSON) — Pressione Q / Azul / L1+R1 p/ fechar";
    qrCanvasEl = document.createElement("canvas");
    qrCanvasEl.width = 232;
    qrCanvasEl.height = 232;
    qrCanvasEl.style.cssText = "background:#fff;padding:12px;border-radius:8px;image-rendering:pixelated;";
    qrJsonEl = document.createElement("pre");
    qrJsonEl.style.cssText =
      "margin-top:14px;background:#111;border:1px solid #444;padding:10px 14px;" +
      "border-radius:6px;color:#b9f6ca;font-size:12px;max-width:90vw;overflow-x:auto;";
    qrModalEl.appendChild(title);
    qrModalEl.appendChild(qrCanvasEl);
    qrModalEl.appendChild(qrJsonEl);
    document.body.appendChild(qrModalEl);

    updateVisibility();
    renderHudText("AGUARDANDO WARMUP (1s)...");
  }

  function updateVisibility() {
    if (!hudEl) return;
    hudEl.style.display = visible ? "block" : "none";
  }

  function renderHudText(statusLine) {
    if (!hudTextEl || !visible) return;
    var emuColor = lastEmuPct >= 97 ? "OK" : lastEmuPct >= 80 ? "WARN" : "LOW";
    var diag = "";
    if (!warmup) {
      if (lastPaintFps < targetFps * 0.85 && lastEmuPct >= 97) diag = " [gargalo: render/compositor]";
      else if (lastEmuPct < 95 && lastPaintFps >= targetFps * 0.9) diag = " [gargalo: CPU no core]";
      else if (lastEmuPct < 95 && lastPaintFps < targetFps * 0.9) diag = " [gargalo: SoC saturado]";
      else diag = " [estavel]";
    }
    var ctxState = (typeof window !== "undefined" && window.__atariAudioCtx) ? window.__atariAudioCtx.state : "";
    var text =
      "ENGINE : " + engineName + (romName ? " | ROM: " + romName : "") + "\n" +
      "EMU%   : " + (warmup ? "warmup..." : lastEmuPct.toFixed(1) + "% (" + lastEmuFps.toFixed(1) + " efps / alvo " + targetFps + ") [" + emuColor + "]" + diag) + "\n" +
      "PAINT  : " + (warmup ? "warmup..." : lastPaintFps.toFixed(1) + " fps (rAF)") + " | NOMINAL: " + nominalLabel + "\n" +
      "AUDIO  : " + (warmup ? "warmup..." : "pitch " + lastAudioPct.toFixed(1) + "% (" + (lastAudioHz / 1000).toFixed(1) + "kHz) | underruns: " + totalUnderruns + " (jan:" + winUnderruns + ") | buf: " + audioBufferLevel + (ctxState ? " [" + ctxState + "]" : "")) + "\n" +
      "CARGA  : fetch " + loadStats.fetchMs.toFixed(0) + "ms (" + loadStats.fetchKb.toFixed(1) + "KB) | comp " + loadStats.compileMs.toFixed(0) + "ms | inst " + loadStats.instantiateMs.toFixed(0) + "ms | 1o-frame " + loadStats.firstFrameMs.toFixed(0) + "ms\n" +
      "ATALHO : [L1+R1 / Amarelo / H] HUD on/off | [Select+L1 / Azul / Q] Dump QR";
    if (statusLine) text += "\nSTATUS : " + statusLine;
    hudTextEl.textContent = text;
  }

  function checkWindow(now) {
    if (!winStart) {
      winStart = now;
      return;
    }
    var elapsedMs = now - winStart;
    if (elapsedMs < 1000) return;

    var sec = elapsedMs / 1000.0;
    if (warmup) {
      // Descarta a 1ª janela (warmup/JIT) conforme Seção 4
      warmup = false;
      winStart = now;
      emuFrames = 0;
      paintFrames = 0;
      audioDelivered = 0;
      audioExpected = 0;
      winUnderruns = 0;
      renderHudText();
      return;
    }

    lastEmuFps = emuFrames / sec;
    lastEmuPct = (lastEmuFps / targetFps) * 100.0;
    lastPaintFps = paintFrames / sec;
    lastAudioHz = audioDelivered / sec;
    lastAudioPct = expectedSampleRate > 0 ? (lastAudioHz / expectedSampleRate) * 100.0 : 0;

    if (historyEmuPct.length >= 30) historyEmuPct.shift();
    historyEmuPct.push(Number(lastEmuPct.toFixed(1)));

    winStart = now;
    emuFrames = 0;
    paintFrames = 0;
    audioDelivered = 0;
    audioExpected = 0;
    winUnderruns = 0;

    renderHudText();
  }

  // Gerador de Matriz Visual Compacta 2D + QR Code Byte-Mode (Versão 4-L, até 78 bytes) para Dump Offline
  var GF_EXP = new Uint8Array(512);
  var GF_LOG = new Uint8Array(256);
  (function initGF() {
    var x = 1;
    for (var i = 0; i < 255; i++) {
      GF_EXP[i] = x;
      GF_LOG[x] = i;
      x <<= 1;
      if (x & 256) x ^= 0x11d;
    }
    for (var j = 255; j < 512; j++) GF_EXP[j] = GF_EXP[j - 255];
  })();

  function rsEncode(data, ecLen) {
    var gen = new Uint8Array(ecLen + 1);
    gen[0] = 1;
    for (var i = 0; i < ecLen; i++) {
      for (var j = i + 1; j > 0; j--) {
        gen[j] = gen[j] ^ (gen[j - 1] ? GF_EXP[GF_LOG[gen[j - 1]] + i] : 0);
      }
    }
    var msg = new Uint8Array(data.length + ecLen);
    msg.set(data, 0);
    for (var k = 0; k < data.length; k++) {
      var coef = msg[k];
      if (coef !== 0) {
        var logC = GF_LOG[coef];
        for (var m = 1; m <= ecLen; m++) {
          msg[k + m] ^= GF_EXP[GF_LOG[gen[m]] + logC];
        }
      }
    }
    return msg.subarray(data.length);
  }

  function drawQrMatrix(canvas, payloadStr) {
    // Versão 4-L: 33x33 módulos, 80 bytes de dados + 20 bytes ECC = 100 codewords
    var bytes = [];
    for (var i = 0; i < payloadStr.length && bytes.length < 78; i++) {
      bytes.push(payloadStr.charCodeAt(i) & 0xff);
    }
    var dataCw = new Uint8Array(80);
    var bitBuf = [];
    function pushBits(val, len) {
      for (var b = len - 1; b >= 0; b--) bitBuf.push((val >> b) & 1);
    }
    pushBits(4, 4); // Byte mode (0100)
    pushBits(bytes.length, 8);
    for (var p = 0; p < bytes.length; p++) pushBits(bytes[p], 8);
    pushBits(0, Math.min(4, 640 - bitBuf.length));
    while (bitBuf.length % 8 !== 0) bitBuf.push(0);
    for (var c = 0; c < 80; c++) {
      if (c * 8 < bitBuf.length) {
        var v = 0;
        for (var b2 = 0; b2 < 8; b2++) v = (v << 1) | bitBuf[c * 8 + b2];
        dataCw[c] = v;
      } else {
        dataCw[c] = (c & 1) ? 0x11 : 0xec;
      }
    }
    var ecCw = rsEncode(dataCw, 20);
    var allCw = new Uint8Array(100);
    allCw.set(dataCw, 0);
    allCw.set(ecCw, 80);

    var size = 33;
    var mat = new Int8Array(size * size); // 0=unset, 1=white, 2=black, 3=func-white, 4=func-black
    function setFunc(r, c, dark) {
      if (r >= 0 && r < size && c >= 0 && c < size) mat[r * size + c] = dark ? 4 : 3;
    }
    function finder(r0, c0) {
      for (var dy = -1; dy <= 7; dy++) {
        for (var dx = -1; dx <= 7; dx++) {
          var rr = r0 + dy, cc = c0 + dx;
          var dark =
            dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6 &&
            (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4));
          setFunc(rr, cc, dark);
        }
      }
    }
    finder(0, 0);
    finder(0, size - 7);
    finder(size - 7, 0);
    // Alignment pattern V4 at (26, 26)
    for (var ay = -2; ay <= 2; ay++) {
      for (var ax = -2; ax <= 2; ax++) {
        setFunc(26 + ay, 26 + ax, Math.max(Math.abs(ax), Math.abs(ay)) !== 1);
      }
    }
    for (var t = 8; t < size - 8; t++) {
      setFunc(6, t, t % 2 === 0);
      setFunc(t, 6, t % 2 === 0);
    }
    setFunc(size - 8, 8, true);
    // Reserve format info areas
    for (var f = 0; f < 9; f++) {
      if (mat[8 * size + f] === 0) setFunc(8, f, false);
      if (mat[f * size + 8] === 0) setFunc(f, 8, false);
    }
    for (var f2 = 0; f2 < 8; f2++) {
      setFunc(8, size - 1 - f2, false);
      setFunc(size - 1 - f2, 8, false);
    }

    // Place data bits
    var bitIdx = 0;
    var up = true;
    for (var col = size - 1; col >= 1; col -= 2) {
      if (col === 6) col = 5;
      for (var step = 0; step < size; step++) {
        var row = up ? size - 1 - step : step;
        for (var dc = 0; dc < 2; dc++) {
          var cc2 = col - dc;
          if (mat[row * size + cc2] === 0) {
            var bit = 0;
            if (bitIdx < allCw.length * 8) {
              bit = (allCw[bitIdx >> 3] >> (7 - (bitIdx & 7))) & 1;
              bitIdx++;
            }
            // Mask 0: (row + col) % 2 === 0
            if ((row + cc2) % 2 === 0) bit ^= 1;
            mat[row * size + cc2] = bit ? 2 : 1;
          }
        }
      }
      up = !up;
    }

    // Format info for Level L (01), Mask 0 (000) -> 0x77c4
    var fmtBits = 0x77c4;
    var fmtCoords1 = [
      [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
      [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]
    ];
    for (var fi = 0; fi < 15; fi++) {
      var fb = (fmtBits >> fi) & 1;
      var rc = fmtCoords1[fi];
      mat[rc[0] * size + rc[1]] = fb ? 4 : 3;
      if (fi < 8) mat[8 * size + (size - 1 - fi)] = fb ? 4 : 3;
      else mat[(size - 15 + fi) * size + 8] = fb ? 4 : 3;
    }

    var ctx = canvas.getContext("2d");
    var scale = Math.floor(canvas.width / (size + 4));
    var offset = Math.floor((canvas.width - size * scale) / 2);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#000000";
    for (var r = 0; r < size; r++) {
      for (var c2 = 0; c2 < size; c2++) {
        var v2 = mat[r * size + c2];
        if (v2 === 2 || v2 === 4) {
          ctx.fillRect(offset + c2 * scale, offset + r * scale, scale, scale);
        }
      }
    }
  }

  function buildTelemetrySnapshot() {
    var avgEmu = 0;
    if (historyEmuPct.length > 0) {
      var sum = 0;
      for (var i = 0; i < historyEmuPct.length; i++) sum += historyEmuPct[i];
      avgEmu = Number((sum / historyEmuPct.length).toFixed(1));
    }
    return {
      eng: engineName,
      rom: romName || "default",
      emuPct: Number(lastEmuPct.toFixed(1)),
      avgPct: avgEmu,
      efps: Number(lastEmuFps.toFixed(1)),
      pfps: Number(lastPaintFps.toFixed(1)),
      target: targetFps,
      audPct: Number(lastAudioPct.toFixed(1)),
      und: totalUnderruns,
      loadMs: [
        Math.round(loadStats.fetchMs),
        Math.round(loadStats.compileMs),
        Math.round(loadStats.instantiateMs),
        Math.round(loadStats.firstFrameMs)
      ]
    };
  }

  var prevGamepadCombo = false;
  var prevQrCombo = false;

  var HonestHUD = {
    init: function (opts) {
      opts = opts || {};
      engineName = opts.engine || engineName;
      romName = opts.rom || romName;
      targetFps = opts.targetFps || 60.0;
      expectedSampleRate = opts.sampleRate || 44100;
      ensureDom();
      this.resetWindow();
    },
    setMeta: function (opts) {
      if (!opts) return;
      if (opts.engine !== undefined) engineName = opts.engine;
      if (opts.rom !== undefined) romName = opts.rom;
      if (opts.targetFps !== undefined) targetFps = opts.targetFps;
      if (opts.sampleRate !== undefined) expectedSampleRate = opts.sampleRate;
      ensureDom();
      renderHudText();
    },
    resetWindow: function () {
      winStart = typeof performance !== "undefined" ? performance.now() : Date.now();
      warmup = true;
      emuFrames = 0;
      paintFrames = 0;
      audioDelivered = 0;
      audioExpected = 0;
      totalUnderruns = 0;
      winUnderruns = 0;
      historyEmuPct = [];
      renderHudText("WARMUP (1s)...");
    },
    markLoadStart: function () {
      loadStats.t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
      loadStats.fetchMs = 0;
      loadStats.fetchKb = 0;
      loadStats.compileMs = 0;
      loadStats.instantiateMs = 0;
      loadStats.firstFrameMs = 0;
      loadStats.firstFrameRecorded = false;
    },
    markFetchDone: function (bytesLength) {
      var now = typeof performance !== "undefined" ? performance.now() : Date.now();
      loadStats.fetchMs = Math.max(0, now - loadStats.t0);
      loadStats.fetchKb = (bytesLength || 0) / 1024.0;
    },
    markCompileDone: function (ms) {
      loadStats.compileMs = ms || 0;
    },
    markInstantiateDone: function (ms) {
      loadStats.instantiateMs = ms || 0;
    },
    onEmulatedFrame: function () {
      var now = typeof performance !== "undefined" ? performance.now() : Date.now();
      if (!loadStats.firstFrameRecorded && loadStats.t0 > 0) {
        loadStats.firstFrameMs = Math.max(0, now - loadStats.t0);
        loadStats.firstFrameRecorded = true;
      }
      emuFrames++;
      checkWindow(now);
    },
    onPaintFrame: function () {
      var now = typeof performance !== "undefined" ? performance.now() : Date.now();
      paintFrames++;
      checkWindow(now);
    },
    onAudioCallback: function (delivered, expected, bufferLevel) {
      audioDelivered += delivered;
      audioExpected += expected;
      if (bufferLevel !== undefined) audioBufferLevel = bufferLevel;
      if (!warmup && delivered < expected) {
        totalUnderruns++;
        winUnderruns++;
      }
    },
    toggle: function () {
      ensureDom();
      visible = !visible;
      try {
        localStorage.setItem(STORAGE_KEY, visible ? "1" : "0");
      } catch (e) {}
      updateVisibility();
      if (visible) renderHudText();
    },
    toggleQrDump: function () {
      ensureDom();
      qrVisible = !qrVisible;
      if (!qrModalEl) return;
      if (qrVisible) {
        var snap = buildTelemetrySnapshot();
        var fullJson = JSON.stringify(snap, null, 2);
        // Compact <=76 chars string for V4-L QR Code
        var compact =
          snap.eng.slice(0, 12) + "|" +
          snap.rom.slice(0, 14) + "|E:" +
          snap.emuPct + "%|P:" +
          snap.pfps + "|A:" +
          snap.audPct + "%|U:" +
          snap.und + "|L:" +
          snap.loadMs.join(",");
        drawQrMatrix(qrCanvasEl, compact);
        qrJsonEl.textContent = "QR String: " + compact + "\n\n" + fullJson;
        qrModalEl.style.display = "flex";
      } else {
        qrModalEl.style.display = "none";
      }
    },
    pollGamepadShortcuts: function (pad) {
      if (!pad || !pad.buttons) return;
      var l1 = !!(pad.buttons[4] && pad.buttons[4].pressed);
      var r1 = !!(pad.buttons[5] && pad.buttons[5].pressed);
      var sel = !!(pad.buttons[8] && pad.buttons[8].pressed);
      var comboHud = l1 && r1;
      if (comboHud && !prevGamepadCombo) this.toggle();
      prevGamepadCombo = comboHud;

      var comboQr = sel && l1;
      if (comboQr && !prevQrCombo) this.toggleQrDump();
      prevQrCombo = comboQr;
    },
    getSnapshot: buildTelemetrySnapshot
  };

  if (typeof window !== "undefined") {
    window.addEventListener("keydown", function (ev) {
      var k = ev.keyCode;
      if (k === 72 || k === 405) { // 'H' ou Botão Amarelo (ColorF2Yellow)
        HonestHUD.toggle();
      } else if (k === 81 || k === 406) { // 'Q' ou Botão Azul (ColorF3Blue)
        HonestHUD.toggleQrDump();
      }
    });
  }

  root.HonestHUD = HonestHUD;
})(typeof window !== "undefined" ? window : globalThis);

