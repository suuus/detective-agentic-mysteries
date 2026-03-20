/**
 * main.js — entry point for Detective Mysteries.
 * Initializes Phaser, managers, and wires up the HUD.
 */
import { GameAPI } from './api.js';
import { DialogManager } from './dialog.js';
import { InventoryManager } from './inventory.js';
import BootScene from './scenes/BootScene.js';
import ManorScene from './scenes/ManorScene.js';
import UIScene from './scenes/UIScene.js';
import CruiseBootScene from './scenes/CruiseBootScene.js';
import CruiseManorScene from './scenes/CruiseManorScene.js';
import { initNarratorTTS, speakNarration } from './narratorTTS.js';
import { initNpcTTS, speakNPC, setNPCTTSEnabled } from './npcTTS.js';
import { toggleFlashlight } from './lighting.js';
import RandomBootScene from './scenes/RandomBootScene.js';
import RandomManorScene from './scenes/RandomManorScene.js';
import { playReconstruction } from './reconstruction.js';
import { initAmbientMusic, toggleMusic, setMood, isMusicEnabled } from './ambientMusic.js';
import { initVoiceInput } from './voiceInput.js';
import { ReplayViewer } from './replay.js';

// ── Managers ─────────────────────────────────────────────────────
const api = new GameAPI();
const inventory = new InventoryManager(api);
const dialog = new DialogManager(api);

// Expose globally so Phaser scenes can reach them
window.gameAPI = api;
window.dialogManager = dialog;
window.inventoryManager = inventory;

// ── Narrator TTS ─────────────────────────────────────────────────
initNarratorTTS();
initNpcTTS();
window.speakNarration = speakNarration;
window.speakNPC = speakNPC;
window.setNPCTTSEnabled = setNPCTTSEnabled;

// ── Voice Input (STT) ────────────────────────────────────────────
const voiceInput = initVoiceInput();
dialog.setVoiceInput(voiceInput);

// ── Ambient Music ────────────────────────────────────────────────
initAmbientMusic();
window.setMusicMood = setMood;

// ── Replay Viewer ────────────────────────────────────────────────
const replay = new ReplayViewer(api);

// ── Phaser config ────────────────────────────────────────────────
const config = {
  type: Phaser.AUTO,
  width: 1024,
  height: 768,
  parent: 'game-container',
  pixelArt: true,
  backgroundColor: '#0a0a0a',
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 0 }, debug: false },
  },
  input: {
    keyboard: {
      capture: [],  // Don't globally capture any keys — let HTML inputs work
    },
  },
  scene: [],
};

const game = new Phaser.Game(config);

// Register all scenes manually (none auto-start)
game.scene.add('BootScene', BootScene);
game.scene.add('ManorScene', ManorScene);
game.scene.add('CruiseBootScene', CruiseBootScene);
game.scene.add('CruiseManorScene', CruiseManorScene);
game.scene.add('RandomBootScene', RandomBootScene);
game.scene.add('RandomManorScene', RandomManorScene);
game.scene.add('UIScene', UIScene);

// ── Level selection ─────────────────────────────────────────────
let currentLevel = 'manor';

const LEVEL_SUSPECTS = {
  manor: [
    { id: 'victoria', name: 'Lady Victoria Blackwood' },
    { id: 'hartwell', name: 'Dr. James Hartwell' },
    { id: 'clara',    name: 'Clara Blackwood' },
    { id: 'price',    name: 'Mr. Reginald Price' },
    { id: 'agnes',    name: 'Mrs. Agnes Whitfield' },
  ],
  cruise: [
    { id: 'vasquez',    name: 'Dr. Elena Vasquez' },
    { id: 'harrington', name: 'Captain James Harrington' },
    { id: 'isabelle',   name: 'Isabelle Thorne' },
    { id: 'volkov',     name: 'Nikolai Volkov' },
    { id: 'diego',      name: 'Diego Reyes' },
    { id: 'lydia',      name: 'Lydia Chen' },
    { id: 'wells',      name: 'Rep. Richard Wells' },
    { id: 'sofia',      name: 'Sofia Andersson' },
    { id: 'romano',     name: 'Chef Marco Romano' },
    { id: 'okafor',     name: 'Security Chief Ada Okafor' },
    { id: 'yuki',       name: 'Yuki Tanaka' },
  ],
};

const levelSelect = document.getElementById('level-select');

document.querySelectorAll('.level-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const levelId = btn.dataset.level;
    currentLevel = levelId;

    if (levelId === 'random') {
      // Show generation progress
      const btnText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<strong>🎲 Generating mystery...</strong><br><span id="gen-status" style="font-size:0.85rem;opacity:0.7">Designing the crime scene...</span>';

      try {
        for await (const update of api.generateMystery()) {
          const statusEl = document.getElementById('gen-status');
          if (statusEl) statusEl.textContent = update.status || 'Working...';
          if (update.error) throw new Error(update.status);
        }

        await api.selectLevel('random');

        // Build suspects list from generated characters
        const chars = await api.getCharacters();
        LEVEL_SUSPECTS.random = chars.map(c => ({ id: c.id, name: c.name }));
      } catch(err) {
        console.error('Mystery generation failed:', err);
        btn.innerHTML = btnText;
        btn.disabled = false;
        return;
      }

      btn.innerHTML = btnText;
      btn.disabled = false;
      levelSelect.classList.add('hidden');

      // Use dedicated RandomBootScene for generated mysteries
      game.scene.start('RandomBootScene');
      game.scene.start('UIScene');
      return;
    }

    try {
      await api.selectLevel(levelId);
    } catch(err) {
      console.error('Failed to select level:', err);
    }

    levelSelect.classList.add('hidden');

    // Start the appropriate boot scene + UI overlay
    if (levelId === 'cruise') {
      game.scene.start('CruiseBootScene');
    } else {
      game.scene.start('BootScene');
    }
    game.scene.start('UIScene');
  });
});

// ── HUD button wiring ───────────────────────────────────────────
document.getElementById('hud-inventory').addEventListener('click', () => {
  inventory.toggle();
});

document.getElementById('hud-notebook').addEventListener('click', () => {
  inventory.toggleNotebook();
});

document.getElementById('hud-accuse').addEventListener('click', () => {
  openAccusationModal();
});

document.getElementById('btn-flashlight').addEventListener('click', () => {
  // Find the active manor-type scene and toggle its flashlight
  const sceneKeys = ['ManorScene', 'CruiseManorScene', 'RandomManorScene'];
  for (const key of sceneKeys) {
    const s = game.scene.getScene(key);
    if (s && s.scene.isActive()) {
      toggleFlashlight(s);
      break;
    }
  }
});

document.getElementById('btn-music').addEventListener('click', () => {
  const on = toggleMusic();
  document.getElementById('btn-music').classList.toggle('active', on);
});

// ── Model Settings ───────────────────────────────────────────────
const settingsOverlay = document.getElementById('settings-overlay');
const settingsModels = document.getElementById('settings-models');
let cachedModels = null;
const AGENT_LABELS = {
  director: '🎬 Director (night orchestration)',
  architect: '🏗️ Architect (mystery generation)',
  forensics: '🔬 Forensics (evidence analysis)',
};

async function openModelSettings() {
  if (!cachedModels) {
    try {
      cachedModels = await (await fetch('/api/models')).json();
    } catch {
      cachedModels = [{ id: 'gpt-4.1', name: 'GPT-4.1' }];
    }
  }
  const res = await fetch('/api/settings/models');
  const current = await res.json();
  const langRes = await fetch('/api/settings/language');
  const langData = await langRes.json();
  settingsModels.innerHTML = '';

  // Language setting
  const LANGUAGES = ['English', 'French', 'Spanish', 'German', 'Italian', 'Portuguese', 'Dutch', 'Japanese', 'Korean', 'Chinese'];
  const langRow = document.createElement('div');
  langRow.className = 'settings-row';
  langRow.innerHTML = `<label>🌍 NPC Language</label><select id="lang-select">
    ${LANGUAGES.map(l => `<option value="${l}" ${langData.language === l ? 'selected' : ''}>${l}</option>`).join('')}
  </select>`;
  langRow.querySelector('select').addEventListener('change', async (e) => {
    await fetch('/api/settings/language', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: e.target.value }),
    });
  });
  settingsModels.appendChild(langRow);

  // Model settings
  for (const [agent, label] of Object.entries(AGENT_LABELS)) {
    const row = document.createElement('div');
    row.className = 'settings-row';
    row.innerHTML = `<label>${label}</label><select data-agent="${agent}">
      ${cachedModels.map(m => `<option value="${m.id}" ${current[agent] === m.id ? 'selected' : ''}>${m.name || m.id}</option>`).join('')}
    </select>`;
    row.querySelector('select').addEventListener('change', async (e) => {
      await fetch('/api/settings/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent, model: e.target.value }),
      });
    });
    settingsModels.appendChild(row);
  }
  settingsOverlay.classList.remove('hidden');
}

document.getElementById('btn-settings').addEventListener('click', openModelSettings);
document.getElementById('btn-settings-menu').addEventListener('click', openModelSettings);

document.getElementById('settings-close').addEventListener('click', () => {
  settingsOverlay.classList.add('hidden');
});

// ── Changelog ────────────────────────────────────────────────────
const changelogOverlay = document.getElementById('changelog-overlay');

async function openChangelog() {
  const res = await fetch('/api/version');
  const data = await res.json();
  document.getElementById('changelog-version').textContent = `Version ${data.version}`;
  const list = document.getElementById('changelog-list');
  list.innerHTML = '';

  // Group commits by date
  const groups = {};
  for (const c of data.commits) {
    if (!groups[c.date]) groups[c.date] = [];
    groups[c.date].push(c);
  }

  for (const [date, commits] of Object.entries(groups)) {
    const header = document.createElement('div');
    header.style.cssText = 'color:var(--gold,#c9a84c);font-weight:bold;margin-top:12px;margin-bottom:4px;font-size:0.85rem';
    header.textContent = date;
    list.appendChild(header);
    for (const c of commits) {
      const row = document.createElement('div');
      row.style.cssText = 'padding:3px 0 3px 12px;font-size:0.8rem;color:var(--cream,#ddd);border-left:2px solid rgba(255,255,255,0.1)';
      const icon = c.message.startsWith('feat') ? '✨' : c.message.startsWith('fix') ? '🐛' : c.message.startsWith('chore') ? '🔧' : c.message.startsWith('docs') ? '📝' : '•';
      row.innerHTML = `<span style="opacity:0.4;margin-right:6px">${c.hash}</span>${icon} ${c.message}`;
      list.appendChild(row);
    }
  }

  changelogOverlay.classList.remove('hidden');
}

document.getElementById('btn-changelog-menu').addEventListener('click', openChangelog);
document.getElementById('changelog-close').addEventListener('click', () => {
  changelogOverlay.classList.add('hidden');
});

// ── Replay buttons ───────────────────────────────────────────────
document.getElementById('btn-replay-menu').addEventListener('click', () => replay.open());
document.getElementById('btn-replay').addEventListener('click', () => replay.open());

// Show version on menu screen
fetch('/api/version').then(r => r.json()).then(d => {
  document.getElementById('menu-version').textContent = `v${d.version}`;
}).catch(() => {});

// ── Accusation modal ────────────────────────────────────────────
const accusationModal   = document.getElementById('accusation-modal');
const suspectSelect     = document.getElementById('suspect-select');
const motiveInput       = document.getElementById('motive-input');
const evidenceContainer = document.getElementById('evidence-checkboxes');
const submitBtn         = document.getElementById('accusation-submit');
const cancelBtn         = document.getElementById('accusation-cancel');
const resultEl          = document.getElementById('accusation-result');
const attemptsEl        = document.getElementById('accusation-attempts');
const endScreen         = document.getElementById('end-screen');
const endTitle          = document.getElementById('end-title');
const endMessage        = document.getElementById('end-message');
const endRestart        = document.getElementById('end-restart');

let attemptsRemaining = 3;

function openAccusationModal() {
  const suspects = LEVEL_SUSPECTS[currentLevel] || LEVEL_SUSPECTS.manor;

  // Populate suspects
  suspectSelect.innerHTML = '<option value="" disabled selected>— choose a suspect —</option>';
  for (const s of suspects) {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.name;
    suspectSelect.appendChild(opt);
  }

  // Populate evidence checkboxes
  inventory.populateAccusationEvidence(evidenceContainer);

  attemptsEl.textContent = `Attempts remaining: ${attemptsRemaining}`;
  motiveInput.value = '';
  resultEl.classList.add('hidden');
  resultEl.className = 'accusation-result hidden';
  accusationModal.classList.remove('hidden');
  window.setMusicMood?.('dramatic');
}

cancelBtn.addEventListener('click', () => {
  accusationModal.classList.add('hidden');
  window.setMusicMood?.('calm');
});

submitBtn.addEventListener('click', async () => {
  const suspectId = suspectSelect.value;
  const motive = motiveInput.value.trim();
  const checked = [...evidenceContainer.querySelectorAll('input[type="checkbox"]:checked')];
  const evidenceIds = checked.map((cb) => cb.value);

  if (!suspectId) return alert('Select a suspect.');
  if (!motive)    return alert('Describe the motive.');

  submitBtn.disabled = true;

  try {
    const result = await api.accuse(suspectId, motive, evidenceIds);

    resultEl.classList.remove('hidden');

    if (result.correct) {
      resultEl.className = 'accusation-result correct';
      resultEl.textContent = result.message ?? 'Correct! Case solved.';
      window.dispatchEvent(new CustomEvent('correct-accusation'));
      // Show win screen after a brief pause
      setTimeout(() => {
        accusationModal.classList.add('hidden');
        window.setMusicMood?.('calm');
        showEndScreen(true, result.message ?? 'You solved the mystery of Blackwood Manor!');
      }, 2000);
    } else {
      attemptsRemaining--;
      attemptsEl.textContent = `Attempts remaining: ${attemptsRemaining}`;
      resultEl.className = 'accusation-result wrong';
      resultEl.textContent = result.message ?? 'Wrong accusation. Try again.';
      window.dispatchEvent(new CustomEvent('wrong-accusation', { detail: { suspectId } }));

      if (attemptsRemaining <= 0) {
        setTimeout(() => {
          accusationModal.classList.add('hidden');
          window.setMusicMood?.('calm');
          showEndScreen(false, result.message ?? 'The killer escaped justice. The case grows cold…');
        }, 2000);
      }
    }
  } catch (err) {
    resultEl.classList.remove('hidden');
    resultEl.className = 'accusation-result wrong';
    resultEl.textContent = `Error: ${err.message}`;
  } finally {
    submitBtn.disabled = false;
  }
});

function showEndScreen(won, message) {
  if (won) {
    // Play cinematic reconstruction first, then show the end screen
    playReconstruction(api)
      .catch(err => console.warn('Reconstruction skipped:', err.message))
      .finally(() => {
        endTitle.textContent = '🏆 Case Solved';
        endMessage.textContent = message;
        endScreen.classList.remove('hidden');
      });
  } else {
    endTitle.textContent = '💀 Case Closed';
    endMessage.textContent = message;
    endScreen.classList.remove('hidden');
  }
}

endRestart.addEventListener('click', async () => {
  try {
    await api.reset();
  } catch { /* ignore */ }
  window.location.reload();
});

// ── Initial data load ───────────────────────────────────────────
inventory.refresh();
