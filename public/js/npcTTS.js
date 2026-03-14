/**
 * npcTTS.js — Text-to-speech for NPC dialog.
 * Each NPC gets a voice matched to their gender and personality.
 * 
 * TO REMOVE: Delete this file and remove from main.js:
 *   import { initNpcTTS } from './npcTTS.js';
 *   initNpcTTS();
 */

let ttsEnabled = true;
let voices = [];
const profileCache = {};

// Personality-matched voice profiles
// pitch: <0.8 = deep/authoritative, 0.8-1.1 = neutral, >1.1 = light/young
// rate: <0.8 = slow/deliberate, 0.8-1.0 = normal, >1.0 = fast/animated
const npcProfiles = {
  // Manor — personality-matched
  victoria:   { pitch: 1.15, rate: 0.78, gender: 'female' },  // composed, aristocratic, measured
  hartwell:   { pitch: 0.75, rate: 0.92, gender: 'male' },    // nervous energy, professional, speeds up under stress
  clara:      { pitch: 1.3,  rate: 1.0,  gender: 'female' },  // young, sharp, emotional, speaks quickly
  price:      { pitch: 0.9,  rate: 0.95, gender: 'male' },    // smooth, charming businessman
  agnes:      { pitch: 0.95, rate: 0.75, gender: 'female' },  // older, deliberate, observant, measured

  // Cruise — personality-matched
  vasquez:    { pitch: 1.1,  rate: 0.85, gender: 'female' },  // warm bedside manner, controlled
  harrington: { pitch: 0.55, rate: 0.72, gender: 'male' },    // old captain, deep authority, naval formality
  isabelle:   { pitch: 1.25, rate: 0.9,  gender: 'female' },  // southern charm, practiced grace
  volkov:     { pitch: 0.5,  rate: 0.68, gender: 'male' },    // Russian oligarch, soft-spoken menace, very slow
  diego:      { pitch: 0.7,  rate: 0.82, gender: 'male' },    // ex-military, quiet, precise, clipped
  lydia:      { pitch: 1.05, rate: 0.95, gender: 'female' },  // sharp, efficient, poker-faced
  wells:      { pitch: 0.85, rate: 1.02, gender: 'male' },    // slick politician, rehearsed, fast-talking
  sofia:      { pitch: 1.0,  rate: 0.8,  gender: 'female' },  // direct Swedish pragmatism, no-nonsense
  romano:     { pitch: 0.8,  rate: 1.1,  gender: 'male' },    // passionate Italian chef, animated, loud
  okafor:     { pitch: 0.9,  rate: 0.78, gender: 'female' },  // methodical, calm authority, measured
  yuki:       { pitch: 1.35, rate: 1.08, gender: 'female' },  // young journalist, rapid-fire, energetic
};

// For generated characters, infer voice from their data
function inferProfile(characterId) {
  if (profileCache[characterId]) return profileCache[characterId];

  // Try to get character data from the API cache
  const world = window._generatedWorld;
  if (!world) return { pitch: 1.0, rate: 0.88, gender: 'any' };

  const char = world.characters.find(c => c.id === characterId);
  if (!char) return { pitch: 1.0, rate: 0.88, gender: 'any' };

  // Infer gender from name/role
  const text = `${char.name} ${char.role}`.toLowerCase();
  const femaleHints = /\b(mrs|ms|miss|lady|queen|duchess|woman|girl|she|her|wife|mother|sister|actress|waitress|hostess|maid|nurse|aunt)\b/;
  const maleHints = /\b(mr|sir|lord|king|duke|man|boy|he|him|husband|father|brother|uncle|chef|captain|officer|dr|congressman|bodyguard)\b/;
  let gender = 'any';
  if (femaleHints.test(text)) gender = 'female';
  else if (maleHints.test(text)) gender = 'male';

  // Infer personality from role/personality description
  const persona = `${char.personality || ''} ${char.role}`.toLowerCase();
  let pitch = gender === 'female' ? 1.15 : 0.8;
  let rate = 0.88;

  // Adjust for personality traits
  if (/authority|captain|chief|commander|formal|measured|stern|stoic/i.test(persona)) { pitch -= 0.15; rate -= 0.1; }
  if (/young|energetic|eager|nervous|quick|sharp|curious/i.test(persona)) { pitch += 0.15; rate += 0.1; }
  if (/old|elderly|wise|deliberate|slow|careful|patient/i.test(persona)) { pitch -= 0.1; rate -= 0.12; }
  if (/loud|passionate|animated|theatrical|expressive/i.test(persona)) { rate += 0.15; }
  if (/quiet|soft|gentle|calm|reserved|whisper/i.test(persona)) { pitch -= 0.05; rate -= 0.08; }
  if (/menacing|threatening|dangerous|cold|icy/i.test(persona)) { pitch -= 0.2; rate -= 0.15; }
  if (/charming|smooth|suave|slick|charismatic/i.test(persona)) { rate += 0.05; }

  // Clamp
  pitch = Math.max(0.4, Math.min(1.6, pitch));
  rate = Math.max(0.6, Math.min(1.2, rate));

  const profile = { pitch, rate, gender };
  profileCache[characterId] = profile;
  return profile;
}

function getProfile(characterId) {
  return npcProfiles[characterId] || inferProfile(characterId);
}

const voiceCache = {};

function pickVoice(gender) {
  if (voiceCache[gender]) return voiceCache[gender];

  if (!voices.length) voices = speechSynthesis.getVoices();
  const english = voices.filter(v => v.lang.startsWith('en'));
  if (!english.length) return voices[0] || null;

  if (!voiceCache._logged) {
    console.log('[NPC TTS] Available English voices:', english.map(v => v.name));
    voiceCache._logged = true;
  }

  // Broad name lists covering Chrome, Edge, Safari, Firefox across Windows/Mac/Linux
  const femaleNames = /female|woman|samantha|karen|kate|fiona|moira|zira|tessa|allison|victoria|susan|hazel|martha|veena|ava|nicky|shelley|sandy|serena|princess|agnes|amelie|catherine|ellen|monica|joana/i;
  const maleNames = /\bmale\b|daniel|james|david|thomas|george|aaron|alex|fred|ralph|lee|rishi|oliver|tom|gordon|albert|bruce|reed|rocko|grandpa|junior/i;

  let selected;
  if (gender === 'female') {
    selected = english.find(v => femaleNames.test(v.name) && !maleNames.test(v.name))
      || english.find(v => femaleNames.test(v.name))
      || english.find(v => !maleNames.test(v.name) && v !== voiceCache['male'])
      || english[english.length > 1 ? 1 : 0];
  } else if (gender === 'male') {
    selected = english.find(v => maleNames.test(v.name) && !femaleNames.test(v.name))
      || english.find(v => maleNames.test(v.name))
      || english.find(v => !femaleNames.test(v.name) && v !== voiceCache['female'])
      || english[0];
  } else {
    selected = english[0];
  }

  voiceCache[gender] = selected;
  console.log(`[NPC TTS] ${gender} voice → ${selected?.name || 'none'}`);
  return selected;
}

export function speakNPC(characterId, text) {
  if (!ttsEnabled || !text || !window.speechSynthesis) return;
  const clean = text.replace(/\*\[[^\]]*\]\*/g, '').replace(/\s+/g, ' ').trim();
  if (!clean) return;

  speechSynthesis.cancel();
  const profile = getProfile(characterId);
  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.rate = profile.rate;
  utterance.pitch = profile.pitch;
  utterance.volume = 0.75;
  const voice = pickVoice(profile.gender);
  if (voice) utterance.voice = voice;
  speechSynthesis.speak(utterance);
}

export function stopNPCSpeech() {
  speechSynthesis.cancel();
}

export function setNPCTTSEnabled(on) {
  ttsEnabled = on;
  if (!on) speechSynthesis.cancel();
}

export function isNPCTTSEnabled() {
  return ttsEnabled;
}

export function initNpcTTS() {
  voices = speechSynthesis.getVoices();
  speechSynthesis.addEventListener('voiceschanged', () => {
    voices = speechSynthesis.getVoices();
    // Clear cache so voices are re-selected from updated list
    Object.keys(voiceCache).forEach(k => delete voiceCache[k]);
  });
}
