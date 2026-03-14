/**
 * ambientMusic.js — Procedural noir music generator using Web Audio API.
 *
 * Layers:
 *   1. Drone    — deep sine waves (C2 + G2) with LFO detune wobble
 *   2. Harmony  — minor chord oscillators through a lowpass filter
 *   3. Rhythm   — pulsed low-frequency ticks (tense/dramatic/chase only)
 *   4. Noise    — looped white-noise buffer through a bandpass filter
 *
 * All transitions use linearRampToValueAtTime for smooth crossfades.
 * AudioContext is lazily created on the first user gesture (toggleMusic).
 */

let ctx = null;
let masterGain = null;
let enabled = false;
let currentMood = 'calm';
let initialized = false;

// ── Layer nodes ──────────────────────────────────────────────────
let droneGain;
let harmonyOscs = [];
let harmonyGains = [];
let harmonyFilter;
let harmonyMasterGain;
let rhythmMasterGain;
let rhythmInterval = null;
let noiseGain;
let noiseFilter;
let melodyGain;
let melodyFilter;
let melodyReverb;
let melodyInterval = null;

// ── Note frequencies ─────────────────────────────────────────────
const F = {
  C2: 65.41, G2: 98.00,
  B2: 123.47, C3: 130.81, Db3: 138.59,
  Eb3: 155.56, Gb3: 185.00, G3: 196.00,
  // Melody range (C minor pentatonic, octave 4-5)
  C4: 261.63, Eb4: 311.13, F4: 349.23, G4: 392.00, Bb4: 466.16,
  C5: 523.25, Eb5: 622.25, F5: 698.46, G5: 783.99,
};

// ── Mood presets ─────────────────────────────────────────────────
const MOODS = {
  calm:     { droneVol: 0.04, harmVol: 0.025, chords: [F.C3, F.Eb3, F.G3],  cutoff: 200,  tick: 0,   noiseVol: 0.002, melody: 0 },
  tense:    { droneVol: 0.06, harmVol: 0.035, chords: [F.C3, F.Eb3, F.Db3], cutoff: 400,  tick: 2.0, noiseVol: 0.004, melody: 1 },
  dramatic: { droneVol: 0.08, harmVol: 0.040, chords: [F.C3, F.Eb3, F.Gb3], cutoff: 800,  tick: 0.8, noiseVol: 0.006, melody: 2 },
  night:    { droneVol: 0.03, harmVol: 0.020, chords: [F.C3, F.Eb3, F.G3],  cutoff: 150,  tick: 0,   noiseVol: 0.003, melody: 0 },
  chase:    { droneVol: 0.08, harmVol: 0.045, chords: [F.C3, F.Gb3, F.B2],  cutoff: 1200, tick: 0.4, noiseVol: 0.008, melody: 3 },
};

// Melody phrases — sequences of [freq, durationSec] for each intensity level
// 0 = none, 1 = sparse, 2 = active, 3 = urgent
const MELODY_PHRASES = {
  1: [ // tense: slow, sparse, questioning phrases
    [[F.C4, 0.6], [F.Eb4, 0.8], [F.G4, 1.2]],
    [[F.G4, 0.5], [F.F4, 0.5], [F.Eb4, 1.0]],
    [[F.Bb4, 0.8], [F.G4, 0.6], [F.Eb4, 0.4], [F.C4, 1.0]],
    [[F.Eb4, 1.0], [F.F4, 0.6], [F.Eb4, 1.2]],
  ],
  2: [ // dramatic: more movement, descending lines
    [[F.C5, 0.4], [F.Bb4, 0.3], [F.G4, 0.3], [F.F4, 0.3], [F.Eb4, 0.8]],
    [[F.G4, 0.3], [F.Bb4, 0.4], [F.C5, 0.5], [F.Bb4, 0.3], [F.G4, 0.8]],
    [[F.Eb5, 0.5], [F.C5, 0.3], [F.Bb4, 0.3], [F.G4, 0.4], [F.Eb4, 1.0]],
    [[F.F4, 0.3], [F.G4, 0.3], [F.Bb4, 0.5], [F.G4, 0.4], [F.F4, 0.8]],
  ],
  3: [ // chase: rapid ascending, urgent
    [[F.C4, 0.2], [F.Eb4, 0.2], [F.F4, 0.2], [F.G4, 0.2], [F.Bb4, 0.2], [F.C5, 0.4]],
    [[F.G4, 0.15], [F.Bb4, 0.15], [F.C5, 0.15], [F.Eb5, 0.3], [F.C5, 0.2], [F.Bb4, 0.3]],
    [[F.Eb5, 0.2], [F.C5, 0.2], [F.Bb4, 0.15], [F.G4, 0.15], [F.Bb4, 0.2], [F.C5, 0.4]],
    [[F.F4, 0.15], [F.G4, 0.15], [F.Bb4, 0.15], [F.C5, 0.15], [F.Eb5, 0.3], [F.F5, 0.4]],
  ],
};

const RAMP = 2.0; // seconds for mood crossfade

// ── Build audio graph (once) ─────────────────────────────────────
function buildLayers() {
  if (initialized) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();

  masterGain = ctx.createGain();
  masterGain.gain.value = 0;
  masterGain.connect(ctx.destination);

  // ── 1. Drone layer ──
  droneGain = ctx.createGain();
  droneGain.gain.value = 0;
  droneGain.connect(masterGain);

  const makeDrone = (freq, relGain, lfoRate) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = relGain;
    osc.connect(g);
    g.connect(droneGain);
    // LFO for detune wobble
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = lfoRate;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 3; // ±3 cents
    lfo.connect(lfoG);
    lfoG.connect(osc.detune);
    osc.start();
    lfo.start();
  };
  makeDrone(F.C2, 0.6, 0.10);
  makeDrone(F.G2, 0.4, 0.13);

  // ── 2. Harmony layer ──
  harmonyFilter = ctx.createBiquadFilter();
  harmonyFilter.type = 'lowpass';
  harmonyFilter.frequency.value = 200;
  harmonyFilter.Q.value = 1;

  harmonyMasterGain = ctx.createGain();
  harmonyMasterGain.gain.value = 0;
  harmonyFilter.connect(harmonyMasterGain);
  harmonyMasterGain.connect(masterGain);

  for (let i = 0; i < 3; i++) {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = F.C3;
    const g = ctx.createGain();
    g.gain.value = 0.33;
    osc.connect(g);
    g.connect(harmonyFilter);
    osc.start();
    harmonyOscs.push(osc);
    harmonyGains.push(g);
  }

  // ── 3. Rhythm layer ──
  rhythmMasterGain = ctx.createGain();
  rhythmMasterGain.gain.value = 0;
  rhythmMasterGain.connect(masterGain);

  // ── 4. Atmosphere (noise) layer ──
  noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.value = 400;
  noiseFilter.Q.value = 1.5;

  noiseGain = ctx.createGain();
  noiseGain.gain.value = 0;
  noiseFilter.connect(noiseGain);
  noiseGain.connect(masterGain);

  const bufLen = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.connect(noiseFilter);
  src.start();

  // ── 5. Melody layer — noir piano-like notes through filter + reverb ──
  melodyFilter = ctx.createBiquadFilter();
  melodyFilter.type = 'lowpass';
  melodyFilter.frequency.value = 1500;
  melodyFilter.Q.value = 2;

  melodyGain = ctx.createGain();
  melodyGain.gain.value = 0;
  melodyFilter.connect(melodyGain);
  melodyGain.connect(masterGain);

  // Simple convolver for reverb-like tail
  try {
    const reverbLen = ctx.sampleRate * 1.5;
    const reverbBuf = ctx.createBuffer(2, reverbLen, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = reverbBuf.getChannelData(ch);
      for (let i = 0; i < reverbLen; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.4));
      }
    }
    melodyReverb = ctx.createConvolver();
    melodyReverb.buffer = reverbBuf;
    const reverbGain = ctx.createGain();
    reverbGain.gain.value = 0.3;
    melodyFilter.connect(melodyReverb);
    melodyReverb.connect(reverbGain);
    reverbGain.connect(melodyGain);
  } catch { /* reverb optional */ }

  initialized = true;
}

// ── Rhythm scheduling ────────────────────────────────────────────
function scheduleRhythm(tickRate) {
  if (rhythmInterval) {
    clearInterval(rhythmInterval);
    rhythmInterval = null;
  }
  if (!tickRate) {
    rhythmMasterGain.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
    return;
  }

  rhythmMasterGain.gain.setTargetAtTime(1, ctx.currentTime, 0.3);

  const tick = () => {
    if (!ctx || !enabled) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 55;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.12, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(g);
    g.connect(rhythmMasterGain);
    osc.start(now);
    osc.stop(now + 0.2);
  };

  tick();
  rhythmInterval = setInterval(tick, tickRate * 1000);
}

// ── Melody scheduling ─────────────────────────────────────────────
function scheduleMelody(level) {
  if (melodyInterval) {
    clearInterval(melodyInterval);
    melodyInterval = null;
  }
  if (!level || !MELODY_PHRASES[level]) {
    melodyGain.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
    return;
  }

  const phrases = MELODY_PHRASES[level];
  const vol = level === 1 ? 0.04 : level === 2 ? 0.06 : 0.07;
  melodyGain.gain.setTargetAtTime(vol, ctx.currentTime, 0.5);

  // Interval between phrases: slower for tense, faster for chase
  const gap = level === 1 ? 6000 : level === 2 ? 4000 : 2000;

  const playPhrase = () => {
    if (!ctx || !enabled) return;
    const phrase = phrases[Math.floor(Math.random() * phrases.length)];
    let offset = ctx.currentTime + 0.1;

    for (const [freq, dur] of phrase) {
      // Create a short "piano-like" note using a triangle wave with fast decay
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      // Slight random detune for warmth
      osc.detune.value = (Math.random() - 0.5) * 8;

      const noteGain = ctx.createGain();
      noteGain.gain.setValueAtTime(0, offset);
      noteGain.gain.linearRampToValueAtTime(0.3, offset + 0.015); // fast attack
      noteGain.gain.exponentialRampToValueAtTime(0.08, offset + dur * 0.4); // sustain
      noteGain.gain.exponentialRampToValueAtTime(0.001, offset + dur); // release

      osc.connect(noteGain);
      noteGain.connect(melodyFilter);
      osc.start(offset);
      osc.stop(offset + dur + 0.05);

      offset += dur;
    }
  };

  // Play first phrase after a short delay
  setTimeout(playPhrase, 1000);
  melodyInterval = setInterval(playPhrase, gap);
}

// ── Apply mood settings ──────────────────────────────────────────
function applyMood(mood, ramp = RAMP) {
  const m = MOODS[mood];
  if (!m || !ctx) return;
  const t = ctx.currentTime + ramp;

  droneGain.gain.linearRampToValueAtTime(m.droneVol, t);

  for (let i = 0; i < harmonyOscs.length; i++) {
    harmonyOscs[i].frequency.linearRampToValueAtTime(m.chords[i], t);
  }
  harmonyFilter.frequency.linearRampToValueAtTime(m.cutoff, t);
  harmonyMasterGain.gain.linearRampToValueAtTime(m.harmVol, t);

  noiseGain.gain.linearRampToValueAtTime(m.noiseVol, t);
  noiseFilter.frequency.linearRampToValueAtTime(m.cutoff * 1.5, t);

  scheduleRhythm(m.tick);
  scheduleMelody(m.melody);
}

// ── Public API ───────────────────────────────────────────────────

/** Call once at startup. Lightweight — no AudioContext created yet. */
export function initAmbientMusic() {
  // Intentionally empty — AudioContext is created lazily in toggleMusic().
}

/** Switch the ambient mood. Stores mood immediately; applies if music is on. */
export function setMood(mood) {
  if (!MOODS[mood]) return;
  currentMood = mood;
  if (enabled && initialized) applyMood(mood);
}

/** Toggle music on/off. Returns new enabled state. Must be called from a user gesture the first time. */
export function toggleMusic() {
  if (!initialized) buildLayers();
  if (ctx.state === 'suspended') ctx.resume();

  enabled = !enabled;
  const now = ctx.currentTime;

  if (enabled) {
    masterGain.gain.linearRampToValueAtTime(0.6, now + 0.5);
    applyMood(currentMood, 1.0);
  } else {
    masterGain.gain.linearRampToValueAtTime(0, now + 0.5);
    if (rhythmInterval) { clearInterval(rhythmInterval); rhythmInterval = null; }
    if (melodyInterval) { clearInterval(melodyInterval); melodyInterval = null; }
  }
  return enabled;
}

/** Check whether music is currently enabled. */
export function isMusicEnabled() {
  return enabled;
}
