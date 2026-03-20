// NPC whisper/eavesdrop system — player overhears NPC-to-NPC conversations
// when two NPCs are in the same room and the player is within proximity.

const WHISPER_CHECK_INTERVAL = 10000;  // check every 10 seconds
const WHISPER_PROXIMITY = 3 * 32;       // player must be within 3 tiles (96px) of either NPC
const WHISPER_CHANCE = 0.15;            // 15% chance per check when conditions are met
const WHISPER_DISPLAY_DURATION = 6000;  // how long each exchange shows (ms)

/** Determine which room a sprite is in based on pixel position. */
function _findRoom(sprite, rooms, T) {
  const tx = sprite.x / T;
  const ty = sprite.y / T;
  for (const [id, r] of Object.entries(rooms)) {
    if (tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h) {
      return id;
    }
  }
  return null;
}

/**
 * Initialise whisper detection state. Call once after _placeNPCs().
 */
export function initNPCWhisper(scene) {
  scene._whisperState = {
    timer: WHISPER_CHECK_INTERVAL,
    active: false,       // true while a whisper is being fetched or displayed
    pairsToday: new Set(), // "npcA:npcB" pairs that already whispered (client-side cache)
    displayQueue: [],    // exchanges waiting to be shown
    currentDisplay: null,
    displayTimer: 0,
  };
}

/**
 * Tick whisper system each frame. Call from update().
 */
export function updateNPCWhisper(scene, delta) {
  if (!scene._whisperState) return;
  const ws = scene._whisperState;

  // Don't check during night, overlays, transitions, or while a whisper is active
  if (scene.transitioning || scene.isNight || scene._isOverlayOpen()) return;

  // Handle display of queued whisper exchanges
  if (ws.currentDisplay) {
    ws.displayTimer -= delta;
    if (ws.displayTimer <= 0) {
      _hideWhisperToast();
      // Show next exchange if available
      if (ws.displayQueue.length > 0) {
        ws.currentDisplay = ws.displayQueue.shift();
        ws.displayTimer = WHISPER_DISPLAY_DURATION;
        _showWhisperToast(ws.currentDisplay);
      } else {
        ws.currentDisplay = null;
        ws.active = false;
      }
    }
    return;
  }

  if (ws.active) return;

  // Cooldown timer
  ws.timer -= delta;
  if (ws.timer > 0) return;
  ws.timer = WHISPER_CHECK_INTERVAL;

  // Find NPC pairs in the same room where player is nearby
  const T = scene.T || 32;
  const npcIds = Object.keys(scene.npcs);
  if (npcIds.length < 2) return;

  // Build room -> NPC mapping
  const roomNPCs = {};
  for (const id of npcIds) {
    const sprite = scene.npcs[id];
    if (!sprite || !sprite.body) continue;
    const room = _findRoom(sprite, scene.rooms, T);
    if (room) {
      if (!roomNPCs[room]) roomNPCs[room] = [];
      roomNPCs[room].push(id);
    }
  }

  // Find candidate pairs: 2+ NPCs in same room + player nearby
  const candidates = [];
  for (const [room, npcs] of Object.entries(roomNPCs)) {
    if (npcs.length < 2) continue;

    // Check if player is close enough to either NPC in this room
    let playerNearby = false;
    for (const npcId of npcs) {
      const sprite = scene.npcs[npcId];
      const dist = Phaser.Math.Distance.Between(
        scene.player.x, scene.player.y,
        sprite.x, sprite.y
      );
      if (dist <= WHISPER_PROXIMITY) {
        playerNearby = true;
        break;
      }
    }
    if (!playerNearby) continue;

    // Generate all pairs from this room
    for (let i = 0; i < npcs.length; i++) {
      for (let j = i + 1; j < npcs.length; j++) {
        const key = [npcs[i], npcs[j]].sort().join(':');
        if (!ws.pairsToday.has(key)) {
          candidates.push({ a: npcs[i], b: npcs[j], key, room });
        }
      }
    }
  }

  if (candidates.length === 0) return;

  // Roll for whisper chance
  if (Math.random() > WHISPER_CHANCE) return;

  // Pick a random candidate pair
  const pair = candidates[Math.floor(Math.random() * candidates.length)];
  ws.pairsToday.add(pair.key);
  ws.active = true;

  // Show visual cue that NPCs are whispering
  _showWhisperIndicator(scene, pair.a, pair.b);

  // Trigger the whisper API call
  window.gameAPI?.triggerWhisper(pair.a, pair.b).then(result => {
    _hideWhisperIndicator(scene);

    if (!result?.exchanges?.length) {
      ws.active = false;
      return;
    }

    // Queue up exchanges for display
    ws.displayQueue = result.exchanges.slice(1); // all except the first
    ws.currentDisplay = result.exchanges[0];
    ws.displayTimer = WHISPER_DISPLAY_DURATION;
    _showWhisperToast(ws.currentDisplay);

    // Refresh notebook
    window.inventoryManager?.refresh();
  }).catch(err => {
    console.warn('Whisper failed:', err);
    _hideWhisperIndicator(scene);
    ws.active = false;
  });
}

/**
 * Reset whisper pairs tracking (call on day advance).
 */
export function resetWhisperCooldowns(scene) {
  if (scene._whisperState) {
    scene._whisperState.pairsToday.clear();
  }
}

// ── Visual indicators ──────────────────────────────────────────

let _indicatorTweens = [];

function _showWhisperIndicator(scene, npcA, npcB) {
  // Show "..." speech bubbles above the whispering NPCs
  for (const id of [npcA, npcB]) {
    const sprite = scene.npcs[id];
    if (!sprite) continue;
    const bubble = scene.add.text(sprite.x, sprite.y - 32, '💬', {
      fontSize: '14px',
    }).setOrigin(0.5).setDepth(50).setAlpha(0);

    // Fade in + bob animation
    const tween = scene.tweens.add({
      targets: bubble,
      alpha: { from: 0, to: 0.8 },
      y: sprite.y - 38,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    _indicatorTweens.push({ bubble, tween });
  }
}

function _hideWhisperIndicator(scene) {
  for (const { bubble, tween } of _indicatorTweens) {
    tween.stop();
    bubble.destroy();
  }
  _indicatorTweens = [];
}

// ── Toast notification UI ──────────────────────────────────────

function _showWhisperToast(exchange) {
  const container = document.getElementById('whisper-toast');
  if (!container) return;

  const nameEl = container.querySelector('.whisper-speaker');
  const textEl = container.querySelector('.whisper-text');
  if (nameEl) nameEl.textContent = exchange.speakerName + ':';
  if (textEl) textEl.textContent = `"${exchange.text}"`;

  container.classList.remove('hidden');
  container.classList.add('whisper-visible');
}

function _hideWhisperToast() {
  const container = document.getElementById('whisper-toast');
  if (!container) return;
  container.classList.remove('whisper-visible');
  container.classList.add('hidden');
}
