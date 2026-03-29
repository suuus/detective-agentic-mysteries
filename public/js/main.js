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
window._phaserGame = game;  // Expose for dialog portraits

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
      // Show the full-screen generation overlay
      const overlay = document.getElementById('generation-overlay');
      const genLog = document.getElementById('gen-log');
      const genSubtitle = document.getElementById('gen-panel-subtitle');

      // Reset all pipeline steps
      ['architect','characters','director','creative','world'].forEach(id => {
        const el = document.getElementById('gen-step-' + id);
        if (el) {
          el.classList.remove('active','done');
          el.querySelector('.gen-step-state').textContent = 'waiting';
        }
      });
      // Reset creative sub-agent steps
      ['creative-env','creative-props','creative-chars'].forEach(id => {
        const el = document.getElementById('gen-step-' + id);
        if (el) {
          el.classList.remove('active','done','failed');
          el.querySelector('.gen-step-state').textContent = 'waiting';
        }
      });
      if (genLog) genLog.innerHTML = '';
      if (genSubtitle) genSubtitle.textContent = 'Your AI agents are designing a unique mystery...';

      // ── View toggle (list vs network vs architecture) ──
      const pipelineEl = document.getElementById('gen-pipeline');
      const networkEl = document.getElementById('gen-network');
      const archEl = document.getElementById('gen-arch');
      const listBtn = document.getElementById('gen-view-list-btn');
      const graphBtn = document.getElementById('gen-view-graph-btn');
      const archBtn = document.getElementById('gen-view-arch-btn');
      const savedView = localStorage.getItem('gen-view') || 'list';

      function setGenView(view) {
        pipelineEl.style.display = 'none';
        networkEl.classList.add('hidden');
        archEl.classList.add('hidden');
        listBtn.classList.remove('active');
        graphBtn.classList.remove('active');
        archBtn.classList.remove('active');
        if (view === 'graph') {
          networkEl.classList.remove('hidden');
          graphBtn.classList.add('active');
        } else if (view === 'arch') {
          archEl.classList.remove('hidden');
          archBtn.classList.add('active');
        } else {
          pipelineEl.style.display = '';
          listBtn.classList.add('active');
        }
        localStorage.setItem('gen-view', view);
      }
      setGenView(savedView);
      listBtn.addEventListener('click', () => setGenView('list'));
      graphBtn.addEventListener('click', () => setGenView('graph'));
      archBtn.addEventListener('click', () => setGenView('arch'));

      // ── Network graph helpers ──
      // Connection line mapping: when a step activates, which lines light up?
      const NET_LINES = {
        architect:  { incoming: [], outgoing: ['net-line-arch-char'] },
        characters: { incoming: ['net-line-arch-char'], outgoing: ['net-line-char-dir'] },
        director:   { incoming: ['net-line-char-dir'], outgoing: ['net-line-dir-creative'] },
        creative:   { incoming: ['net-line-dir-creative'], outgoing: ['net-line-cr-env','net-line-cr-props','net-line-cr-chars','net-line-creative-world'] },
        world:      { incoming: ['net-line-creative-world'], outgoing: [] },
      };
      const NET_SUB_MAP = {
        env: 'creative-env',
        props: 'creative-props',
        chars: 'creative-chars',
      };

      function setNetNodeState(stepId, state) {
        const node = document.getElementById('net-node-' + stepId);
        if (!node) return;
        node.classList.remove('active','done');
        if (state === 'active' || state === 'done') node.classList.add(state);

        const lineConfig = NET_LINES[stepId];
        if (!lineConfig) return;
        if (state === 'active') {
          for (const lid of lineConfig.incoming) {
            const line = document.getElementById(lid);
            if (line) { line.classList.remove('done'); line.classList.add('active'); }
          }
        } else if (state === 'done') {
          for (const lid of lineConfig.incoming) {
            const line = document.getElementById(lid);
            if (line) { line.classList.remove('active'); line.classList.add('done'); }
          }
        }
      }

      function setNetSubState(sub, state) {
        const nodeId = NET_SUB_MAP[sub];
        if (!nodeId) return;
        const node = document.getElementById('net-node-' + nodeId);
        if (!node) return;
        node.classList.remove('active','done');
        if (state === 'active' || state === 'done') node.classList.add(state);
        // Sub-lines
        const lineId = 'net-line-cr-' + sub;
        const line = document.getElementById(lineId);
        if (line) {
          line.classList.remove('active','done');
          if (state === 'active') line.classList.add('active');
          else if (state === 'done') line.classList.add('done');
        }
      }

      function addNetDataPill(text, x, y) {
        const container = document.getElementById('gen-net-data-items');
        if (!container) return;
        const pill = document.createElement('div');
        pill.className = 'gen-net-pill';
        pill.textContent = text;
        pill.style.left = x + 'px';
        pill.style.top = y + 'px';
        container.appendChild(pill);
        setTimeout(() => pill.remove(), 3200);
      }

      // Reset network nodes
      document.querySelectorAll('.gen-net-node').forEach(n => n.classList.remove('active','done'));
      document.querySelectorAll('.gen-net-line').forEach(l => l.classList.remove('active','done'));
      const netDataItems = document.getElementById('gen-net-data-items');
      if (netDataItems) netDataItems.innerHTML = '';

      // ── Architecture view helpers ──
      // Track NPC card positions for dynamic SVG line drawing
      const archNpcCards = []; // { id, name, el }

      function archDrawLines() {
        const svg = document.getElementById('gen-arch-svg');
        if (!svg) return;
        svg.innerHTML = '';
        const archRect = document.getElementById('gen-arch')?.getBoundingClientRect();
        if (!archRect) return;

        function nodeCenter(id) {
          const el = document.getElementById(id);
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { x: r.left + r.width / 2 - archRect.left, y: r.top + r.height / 2 - archRect.top };
        }
        function npcCenter(cardEl) {
          const r = cardEl.getBoundingClientRect();
          return { x: r.left + r.width / 2 - archRect.left, y: r.top + r.height / 2 - archRect.top };
        }
        function addLine(from, to, cls) {
          if (!from || !to) return;
          const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line.setAttribute('x1', from.x); line.setAttribute('y1', from.y);
          line.setAttribute('x2', to.x); line.setAttribute('y2', to.y);
          line.setAttribute('class', 'arch-line ' + cls);
          svg.appendChild(line);
        }

        const player = nodeCenter('arch-node-player');
        const director = nodeCenter('arch-node-director');
        const state = nodeCenter('arch-node-state');
        const profiler = nodeCenter('arch-node-profiler');
        const narrator = nodeCenter('arch-node-narrator');
        const forensics = nodeCenter('arch-node-forensics');
        const skeleton = nodeCenter('arch-node-skeleton');
        const creative = nodeCenter('arch-node-creative');

        // Player → Profiler
        addLine(player, profiler, 'arch-async done');
        // Player → GameState
        addLine(player, state, 'done');
        // Director → GameState
        addLine(director, state, 'arch-gen done');
        // GameState → Narrator
        addLine(state, narrator, 'arch-async done');
        // GameState → Forensics
        addLine(state, forensics, 'arch-async done');
        // Skeleton Key → Director
        addLine(skeleton, director, 'arch-gen done');
        // Creative → Skeleton Key
        addLine(creative, skeleton, 'arch-gen done');

        // NPC connections — each NPC connects to Player, Director, GameState, and each other
        for (const npc of archNpcCards) {
          const c = npcCenter(npc.el);
          // Player ↔ NPC (interrogation)
          addLine(player, c, 'done');
          // NPC → GameState (tool calls)
          addLine(c, state, 'arch-tool done');
          // Director ↔ NPC (night conversations)
          addLine(director, c, 'arch-gen done');
        }
        // NPC ↔ NPC gossip lines (hooks) — connect adjacent pairs
        for (let i = 0; i < archNpcCards.length - 1; i++) {
          const a = npcCenter(archNpcCards[i].el);
          const b = npcCenter(archNpcCards[i + 1].el);
          addLine(a, b, 'arch-hook done');
        }

        // Update SVG viewBox to match container
        svg.setAttribute('viewBox', `0 0 ${archRect.width} ${archRect.height}`);
      }

      function setArchState(stepId, state) {
        // Light up system nodes based on generation step
        const nodeMap = {
          architect: ['skeleton', 'state'],
          characters: [],
          director: ['director'],
          creative: ['creative'],
          world: ['state'],
        };
        const nodeIds = nodeMap[stepId] || [];
        for (const nid of nodeIds) {
          const node = document.getElementById('arch-node-' + nid);
          if (node) { node.classList.remove('active','done'); if (state) node.classList.add(state); }
        }
      }

      function addArchNpc(name, role) {
        const row = document.getElementById('arch-npc-row');
        if (!row) return;
        const card = document.createElement('div');
        card.className = 'arch-npc-card active';
        // Pick an emoji based on role keywords
        const roleLC = (role || '').toLowerCase();
        let emoji = '🧑';
        if (roleLC.includes('doctor') || roleLC.includes('physician') || roleLC.includes('medic')) emoji = '👨‍⚕️';
        else if (roleLC.includes('chef') || roleLC.includes('cook')) emoji = '👨‍🍳';
        else if (roleLC.includes('captain') || roleLC.includes('officer')) emoji = '👮';
        else if (roleLC.includes('maid') || roleLC.includes('housekeeper') || roleLC.includes('servant')) emoji = '🧹';
        else if (roleLC.includes('wife') || roleLC.includes('lady') || roleLC.includes('woman') || roleLC.includes('daughter') || roleLC.includes('sister') || roleLC.includes('hostess') || roleLC.includes('actress')) emoji = '👩';
        else if (roleLC.includes('artist') || roleLC.includes('painter') || roleLC.includes('musician')) emoji = '🎨';
        else if (roleLC.includes('lawyer') || roleLC.includes('attorney') || roleLC.includes('judge')) emoji = '⚖️';
        else if (roleLC.includes('business') || roleLC.includes('partner') || roleLC.includes('investor') || roleLC.includes('dealer')) emoji = '💼';
        else if (roleLC.includes('guard') || roleLC.includes('security') || roleLC.includes('bodyguard')) emoji = '🛡️';
        else if (roleLC.includes('scientist') || roleLC.includes('professor') || roleLC.includes('researcher')) emoji = '🔬';
        else if (roleLC.includes('journalist') || roleLC.includes('reporter') || roleLC.includes('writer')) emoji = '📰';
        else if (roleLC.includes('bartender') || roleLC.includes('waiter')) emoji = '🍸';
        card.innerHTML = `<div class="arch-npc-emoji">${emoji}</div><div class="arch-npc-name" title="${name}">${name.split(' ')[0]}</div><div class="arch-npc-role">${role || 'suspect'}</div>`;
        row.appendChild(card);
        archNpcCards.push({ name, el: card });
        // Re-draw lines after layout settles
        requestAnimationFrame(() => requestAnimationFrame(archDrawLines));
      }

      // Reset architecture view
      document.querySelectorAll('.arch-node').forEach(n => n.classList.remove('active','done'));
      const archNpcRow = document.getElementById('arch-npc-row');
      if (archNpcRow) archNpcRow.innerHTML = '';
      archNpcCards.length = 0;
      const archSvg = document.getElementById('gen-arch-svg');
      if (archSvg) archSvg.innerHTML = '';

      overlay.classList.remove('hidden');
      levelSelect.classList.add('hidden');

      /** Append a styled entry to the reasoning log */
      function logEntry(text, cls = '') {
        const div = document.createElement('div');
        div.className = 'gen-log-entry' + (cls ? ' ' + cls : '');
        div.textContent = text;
        genLog.appendChild(div);
        genLog.scrollTop = genLog.scrollHeight;
      }

      /** Mark a pipeline step active/done (both list + network + arch views) */
      function setStepState(stepId, state) {
        const el = document.getElementById('gen-step-' + stepId);
        if (!el) return;
        el.classList.remove('active','done');
        if (state === 'active') {
          el.classList.add('active');
          el.querySelector('.gen-step-state').textContent = 'working...';
        } else if (state === 'done') {
          el.classList.add('done');
          el.querySelector('.gen-step-state').textContent = '✓ done';
        }
        // Also update network graph + architecture view
        setNetNodeState(stepId, state);
        setArchState(stepId, state);
      }

      // Map agent names → pipeline step IDs
      const agentToStep = {
        architect: 'architect',
        character_writer: 'characters',
        director: 'director',
        creative: 'creative',
        world_builder: 'world',
      };

      try {
        // Fire-and-forget: start generation on server
        await api.startGeneration();

        // Poll for events until complete
        let nextIdx = 0;
        const delay = (ms) => new Promise(r => setTimeout(r, ms));
        let done = false;

        while (!done) {
          await delay(1000);
          let data;
          try {
            data = await api.pollGeneration(nextIdx);
          } catch { continue; } // retry on network blip

          for (const update of data.events) {
            nextIdx++;
            const phase = update.phase;

          // Ignore server keepalive heartbeats
          if (phase === 'heartbeat') continue;

          if (phase === 'thinking') {
            // Mark the active step; also auto-complete the previous step
            const stepId = agentToStep[update.agent];
            if (stepId) {
              // Complete any previously active step
              ['architect','characters','director','creative','world'].forEach(id => {
                const el = document.getElementById('gen-step-' + id);
                if (el && el.classList.contains('active') && id !== stepId) {
                  el.classList.remove('active');
                  el.classList.add('done');
                  el.querySelector('.gen-step-state').textContent = '✓ done';
                }
              });
              setStepState(stepId, 'active');
            }
            logEntry(update.status, 'entry-status');

          } else if (phase === 'skeleton_done') {
            setStepState('architect', 'done');
            logEntry(`📖 Title: "${update.title}"`, 'entry-data');
            logEntry(`📍 Setting: ${update.setting}`, 'entry-data');
            if (update.crime) logEntry(`🔪 Crime: ${update.crime}`, 'entry-data');
            if (Array.isArray(update.characters)) {
              logEntry(`👥 Suspects: ${update.characters.map(c => `${c.name} (${c.role})`).join(', ')}`, 'entry-data');
              addNetDataPill(`${update.characters.length} suspects`, 210, 65);
            }
            if (Array.isArray(update.rooms)) {
              logEntry(`🏠 Rooms: ${update.rooms.join(', ')}`, 'entry-data');
              addNetDataPill(`${update.rooms.length} rooms`, 210, 90);
            }

          } else if (phase === 'character_done') {
            logEntry(`✅ ${update.characterName} - ${update.characterRole}`, 'entry-data');
            addNetDataPill(update.characterName, 390, 65);
            addArchNpc(update.characterName, update.characterRole);

          } else if (phase === 'director_done') {
            setStepState('director', 'done');

          } else if (phase === 'creative_done') {
            setStepState('creative', 'done');

          } else if (phase === 'creative_sub') {
            const subEl = document.getElementById('gen-step-creative-' + update.sub);
            if (subEl) {
              subEl.classList.remove('active','done','failed');
              if (update.state === 'active') {
                subEl.classList.add('active');
                subEl.querySelector('.gen-step-state').textContent = 'working...';
              } else if (update.state === 'done') {
                subEl.classList.add('done');
                subEl.querySelector('.gen-step-state').textContent = '✓ done';
              } else if (update.state === 'failed') {
                subEl.classList.add('done');
                subEl.querySelector('.gen-step-state').textContent = '⚠ retry';
                subEl.style.borderColor = 'rgba(244,67,54,0.3)';
              }
            }
            // Update network sub-nodes
            setNetSubState(update.sub, update.state === 'failed' ? 'done' : update.state);
            if (update.palette) {
              const p = update.palette;
              logEntry(`🎨 Style: ${p.furnitureStyle || '-'} | Weather: ${p.weather || '-'} | Layout: ${p.roomLayout || '-'}`, 'entry-data');
            }
            if (update.designedItems?.length) {
              logEntry(`🖼️ Designed: ${update.designedItems.join(', ')}`, 'entry-data');
            }
            if (update.ambientPropNames?.length) {
              logEntry(`✨ Ambient props: ${update.ambientPropNames.join(', ')}`, 'entry-data');
            }
            if (update.hasCustomWallTile) {
              logEntry(`🧱 Custom wall material designed`, 'entry-data');
            }

          } else if (phase === 'complete') {
            setStepState('world', 'done');
            // Show what creative assets were assembled into the world
            if (update.decorationCount > 0 || update.ambientPropCount > 0) {
              logEntry(`🎨 Creative assets applied: ${update.decorationCount} room decoration groups, ${update.ambientPropCount} ambient props${update.wallTileCount > 0 ? ', custom wall material' : ''}`, 'entry-data');
            }
            if (update.roomCount) {
              const floorNote = update.multiFloor ? ` across 2 floors` : '';
              logEntry(`🏠 ${update.roomCount} rooms placed${floorNote}`, 'entry-data');
            }
            logEntry(`🎉 "${update.title}" is ready -- ${update.suspects} suspects, ${update.evidenceCount} clues`, 'entry-complete');
            if (genSubtitle) genSubtitle.textContent = `"${update.title}" -- entering the scene...`;
            // Light up all runtime architecture nodes to show the full system is ready
            ['player','director','profiler','state','narrator','forensics'].forEach(nid => {
              const n = document.getElementById('arch-node-' + nid);
              if (n) { n.classList.remove('active'); n.classList.add('done'); }
            });
            // Mark all NPC cards as done
            for (const npc of archNpcCards) {
              npc.el.classList.remove('active');
              npc.el.classList.add('done');
            }
            archDrawLines();

          } else if (phase === 'error' || update.error) {
            logEntry(update.status || 'Generation failed', 'entry-error');
            throw new Error(update.status);
          }
          }  // end for (events)

          // Check if generation is complete
          if (data.complete) {
            // Check if we got the 'complete' phase event
            const gotComplete = data.events.some(e => e.phase === 'complete');
            if (gotComplete) { done = true; break; }
            // complete but no complete event = error happened, check for error
            const gotError = data.events.some(e => e.phase === 'error' || e.error);
            if (gotError) break; // error was already thrown above
            done = true; break;
          }
          if (!data.inProgress && !data.complete && nextIdx > 0) {
            done = true; break; // generation ended
          }
        }  // end while (!done)

        await api.selectLevel('random');

        // Build suspects list from generated characters
        const chars = await api.getCharacters();
        LEVEL_SUSPECTS.random = chars.map(c => ({ id: c.id, name: c.name }));
      } catch(err) {
        console.error('Mystery generation failed:', err);
        // Show error + retry in the overlay instead of hiding it
        const errorBar = document.getElementById('gen-error-bar');
        const errorMsg = document.getElementById('gen-error-msg');
        if (errorBar && errorMsg) {
          errorMsg.textContent = `Generation failed: ${err.message || 'Connection lost'}. You can retry.`;
          errorBar.classList.remove('hidden');

          // Retry button — re-click the same level button
          document.getElementById('gen-retry-btn')?.addEventListener('click', () => {
            errorBar.classList.add('hidden');
            // Reset steps
            ['architect','characters','director','creative','world'].forEach(id => {
              const el = document.getElementById('gen-step-' + id);
              if (el) { el.classList.remove('active','done'); el.querySelector('.gen-step-state').textContent = 'waiting'; }
            });
            ['creative-env','creative-props','creative-chars'].forEach(id => {
              const el = document.getElementById('gen-step-' + id);
              if (el) { el.classList.remove('active','done','failed'); el.querySelector('.gen-step-state').textContent = 'waiting'; el.style.borderColor = ''; }
            });
            const genLog = document.getElementById('gen-log');
            if (genLog) genLog.innerHTML = '';
            btn.click();
          }, { once: true });

          // Back button — return to level select
          document.getElementById('gen-back-btn')?.addEventListener('click', () => {
            overlay.classList.add('hidden');
            levelSelect.classList.remove('hidden');
          }, { once: true });
        } else {
          overlay.classList.add('hidden');
          levelSelect.classList.remove('hidden');
        }
        return;
      }

      overlay.classList.add('hidden');

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

// ── End Day popup (click clock to toggle) ───────────────────────
{
  const clockEl = document.getElementById('hud-clock');
  const popup = document.getElementById('end-day-popup');
  const endBtn = document.getElementById('end-day-btn');

  clockEl.addEventListener('click', (e) => {
    e.stopPropagation();
    popup.classList.toggle('hidden');
  });

  // Close popup when clicking elsewhere
  document.addEventListener('click', () => {
    popup.classList.add('hidden');
  });
  popup.addEventListener('click', (e) => e.stopPropagation());

  endBtn.addEventListener('click', () => {
    popup.classList.add('hidden');
    // Find the active manor scene and trigger night
    const sceneKeys = ['ManorScene', 'CruiseManorScene', 'RandomManorScene'];
    for (const key of sceneKeys) {
      const s = game?.scene?.getScene(key);
      if (s && s.scene.isActive() && !s.transitioning && !s.isNight) {
        s._triggerNight();
        break;
      }
    }
  });
}

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

  // Game mode setting
  let modeData = { mode: 'normal' };
  try { modeData = await (await fetch('/api/settings/mode')).json(); } catch {}
  const modeRow = document.createElement('div');
  modeRow.className = 'settings-row';
  modeRow.innerHTML = `<label>🧠 Game Mode</label><select id="mode-select">
    <option value="normal" ${modeData.mode === 'normal' ? 'selected' : ''}>Normal</option>
    <option value="psychological" ${modeData.mode === 'psychological' ? 'selected' : ''}>🌀 Psychological</option>
  </select>
  <div style="font-size:0.7rem;opacity:0.4;margin-top:4px;grid-column:1/-1">Psychological mode: NPCs gaslight, shift details, and create doubt. The narrator becomes unreliable. Not for the faint of heart.</div>`;
  modeRow.querySelector('select').addEventListener('change', async (e) => {
    await fetch('/api/settings/mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: e.target.value }),
    });
  });
  settingsModels.appendChild(modeRow);

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
      // Hide the accusation form elements, keep the modal open
      submitBtn.style.display = 'none';
      cancelBtn.style.display = 'none';
      suspectSelect.closest('label')?.nextElementSibling === suspectSelect
        ? suspectSelect.style.display = 'none'
        : null;
      // Hide form inputs but keep the result message visible
      for (const el of accusationModal.querySelectorAll('label, select, textarea, fieldset, .modal-actions, .attempts-info, h2')) {
        el.style.display = 'none';
      }
      window.setMusicMood?.('calm');

      // Start reconstruction inside the modal
      const winMessage = result.message ?? 'You solved the mystery of Blackwood Manor!';
      playReconstruction(api)
        .catch(err => console.warn('Reconstruction skipped:', err.message))
        .finally(() => {
          accusationModal.classList.add('hidden');
          // Reset hidden form elements for potential reuse
          for (const el of accusationModal.querySelectorAll('[style*="display: none"]')) {
            el.style.display = '';
          }
          showEndScreen(true, winMessage);
        });
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
    endTitle.textContent = '🏆 Case Solved';
    endMessage.textContent = message;
    endScreen.classList.remove('hidden');
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
