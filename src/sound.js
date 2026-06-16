/* sound.js - all effects synthesized with the Web Audio API. No files. */
window.GSound = (function () {
  "use strict";
  let actx = null, muted = false;

  function ctx() {
    if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (actx.state === "suspended") actx.resume();
    return actx;
  }

  function tone(freq, dur, type, gain, when) {
    const ax = ctx(); if (!ax || muted) return;
    const t0 = ax.currentTime + (when || 0);
    const osc = ax.createOscillator(), g = ax.createGain();
    osc.type = type || "sine"; osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain || 0.18, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(ax.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  // The woody click of a stone meeting the board (white sits a touch higher).
  function clack(forWhite) {
    const ax = ctx(); if (!ax || muted) return;
    const len = 0.05, buf = ax.createBuffer(1, ax.sampleRate * len, ax.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    const src = ax.createBufferSource(); src.buffer = buf;
    const bp = ax.createBiquadFilter(); bp.type = "bandpass";
    bp.frequency.value = forWhite ? 1700 : 1250; bp.Q.value = 0.9;
    const g = ax.createGain(); g.gain.value = 0.5;
    src.connect(bp).connect(g).connect(ax.destination); src.start();
    tone(forWhite ? 320 : 240, 0.07, "triangle", 0.1);
  }

  return {
    unlock: function () { ctx(); },
    isMuted: function () { return muted; },
    toggle: function () { muted = !muted; if (!muted) this.join(); return muted; },
    clack: clack,
    win: function () { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.32, "sine", 0.16, i * 0.1)); },
    draw: function () { tone(392, 0.2, "sine", 0.12); tone(330, 0.28, "sine", 0.1, 0.12); },
    join: function () { tone(660, 0.12, "sine", 0.14); tone(880, 0.16, "sine", 0.12, 0.1); },
    deny: function () { tone(150, 0.13, "sawtooth", 0.12); },
    sweep: function () { tone(300, 0.18, "sine", 0.08); tone(500, 0.18, "sine", 0.07, 0.05); },
  };
})();
