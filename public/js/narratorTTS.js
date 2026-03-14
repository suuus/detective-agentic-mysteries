/**
 * narratorTTS.js — Text-to-speech for the narrator.
 * 
 * TO REMOVE: Delete this file and remove the single import line
 * from main.js: `import { initNarratorTTS } from './narratorTTS.js';`
 * and the call: `initNarratorTTS();`
 */

let ttsEnabled = true;
let selectedVoice = null;

function pickVoice() {
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return null;
  // Strongly prefer deep male English voices
  const males = voices.filter(v => v.lang.startsWith('en') && /male|daniel|james|thomas|david|george|richard|aaron/i.test(v.name));
  if (males.length) return males[0];
  // Fallback: any English voice with "male" hint, or just the first English one
  return voices.find(v => v.lang.startsWith('en-GB')) || voices.find(v => v.lang.startsWith('en')) || voices[0];
}

export function speakNarration(text) {
  if (!ttsEnabled || !text || !window.speechSynthesis) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.72;   // slow, deliberate
  utterance.pitch = window._lastNarrationUnreliable ? 0.52 : 0.55;  // slightly off when unreliable
  utterance.volume = 0.75;
  if (selectedVoice) utterance.voice = selectedVoice;
  speechSynthesis.speak(utterance);
}

export function toggleTTS(on) {
  ttsEnabled = on;
  if (!on) speechSynthesis.cancel();
}

export function isTTSEnabled() {
  return ttsEnabled;
}

export function initNarratorTTS() {
  // Load voices (some browsers load async)
  selectedVoice = pickVoice();
  speechSynthesis.addEventListener('voiceschanged', () => {
    selectedVoice = pickVoice();
  });

  // Add mute button to HUD
  const hud = document.getElementById('hud-bar');
  if (!hud) return;

  const btn = document.createElement('button');
  btn.id = 'hud-tts';
  btn.className = 'hud-btn';
  btn.title = 'Toggle narrator voice';
  btn.innerHTML = '<span class="hud-icon">🔊</span><span class="hud-label">Voice</span>';
  btn.addEventListener('click', () => {
    ttsEnabled = !ttsEnabled;
    if (!ttsEnabled) speechSynthesis.cancel();
    btn.querySelector('.hud-icon').textContent = ttsEnabled ? '🔊' : '🔇';
    btn.querySelector('.hud-label').textContent = ttsEnabled ? 'Voice' : 'Muted';
    // Also toggle NPC TTS
    if (window.setNPCTTSEnabled) window.setNPCTTSEnabled(ttsEnabled);
  });
  hud.insertBefore(btn, hud.firstChild.nextSibling); // after clock
}
