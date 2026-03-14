// NPC-initiated conversations — NPCs approach the player when they have something to say.
// Shared across all manor scenes.

const APPROACH_SPEED = 50;
const APPROACH_RANGE = 50;       // px — NPC stops and shows speech bubble
const GIVEUP_TIME = 15000;      // ms — NPC gives up if player walks away
const COOLDOWN = 90000;          // ms — per-NPC cooldown between approaches
const TRIGGER_CHECK_INTERVAL = 3000;  // ms — how often to evaluate triggers
const SENTIMENT_FETCH_INTERVAL = 10000; // ms — how often to poll sentiments API
const BUBBLE_DURATION = 5000;    // ms — speech bubble visible time
const RANDOM_CHANCE_PER_MIN = 0.10; // 10% per minute

/**
 * Initialise NPC approach state. Call once in create() after _setupInput().
 */
export function initNPCApproach(scene) {
  scene._approachState = {
    active: false,
    npcId: null,
    timer: 0,
    cooldowns: {},           // { npcId: timestamp of last approach }
    exclamation: null,       // Phaser Text "❗"
    bubble: null,            // Phaser Text speech bubble
    bubbleTimer: 0,
    arrived: false,          // NPC reached the player
    triggerTimer: 0,         // accumulator for trigger checks
    sentimentTimer: 0,       // accumulator for sentiment fetches
    lastDay: 0,              // track day transitions for post-night trigger
    interrogated: new Set(), // NPCs the player has already talked to
  };
  scene._sentimentCache = null;
  scene._approachEvidenceCount = 0;

  // Track interrogations — listen for dialog open events
  const origOpen = window.dialogManager?.open?.bind(window.dialogManager);
  if (origOpen && !window._approachPatchedDialogOpen) {
    window._approachPatchedDialogOpen = true;
    window.dialogManager.open = function (charId, charName) {
      // Record that this NPC has been interrogated
      const s = scene.scene?.isActive?.() !== false ? scene : null;
      if (s?._approachState) {
        s._approachState.interrogated.add(charId);
      }
      // If the approaching NPC is the one we opened dialog with, cancel approach
      if (s?._approachState?.active && s._approachState.npcId === charId) {
        _cancelApproach(s);
      }
      return origOpen(charId, charName);
    };
  }
}

/**
 * Tick NPC approach system each frame. Call from update() after _handleInteractions().
 */
export function updateNPCApproach(scene, delta) {
  const st = scene._approachState;
  if (!st) return;

  // Don't run during night, transitions, or when dialog is open
  if (scene.isNight || scene.transitioning || scene._isOverlayOpen()) {
    return;
  }

  // --- Periodic trigger evaluation ---
  st.triggerTimer += delta;
  if (st.triggerTimer >= TRIGGER_CHECK_INTERVAL) {
    st.triggerTimer = 0;
    if (!st.active) {
      _evaluateTriggers(scene);
    }
  }

  // --- Periodic sentiment fetch ---
  st.sentimentTimer += delta;
  if (st.sentimentTimer >= SENTIMENT_FETCH_INTERVAL) {
    st.sentimentTimer = 0;
    _fetchSentiments(scene);
  }

  // --- Active approach logic ---
  if (!st.active) return;

  const sprite = scene.npcs[st.npcId];
  if (!sprite || !sprite.body) {
    _cancelApproach(scene);
    return;
  }

  // Update exclamation mark position (follows NPC)
  if (st.exclamation) {
    st.exclamation.setPosition(sprite.x, sprite.y - 28);
  }

  // Check if dialog opened while approaching
  if (scene._isOverlayOpen()) {
    _cancelApproach(scene);
    return;
  }

  const dx = scene.player.x - sprite.x;
  const dy = scene.player.y - sprite.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (!st.arrived) {
    // Move NPC toward player
    if (dist <= APPROACH_RANGE) {
      // Arrived — stop and show speech bubble
      sprite.setVelocity(0, 0);
      st.arrived = true;
      st.bubbleTimer = BUBBLE_DURATION;
      _showBubble(scene, sprite);
    } else {
      // Walk toward the player
      const vx = (dx / dist) * APPROACH_SPEED;
      const vy = (dy / dist) * APPROACH_SPEED;
      sprite.setVelocity(vx, vy);
    }
  } else {
    // NPC has arrived — idle near player
    sprite.setVelocity(0, 0);

    // Bubble countdown
    if (st.bubble) {
      st.bubbleTimer -= delta;
      st.bubble.setPosition(sprite.x, sprite.y - 36);
      if (st.bubbleTimer <= 0) {
        st.bubble.destroy();
        st.bubble = null;
      }
    }
  }

  // Give-up timer
  st.timer += delta;
  if (st.timer >= GIVEUP_TIME) {
    _cancelApproach(scene);
  }
}

/**
 * Check if a specific NPC is currently approaching (used by _handleInteractions).
 */
export function isNPCApproaching(scene, npcId) {
  const st = scene._approachState;
  return st?.active && st.npcId === npcId && st.arrived;
}

// ─── Internal helpers ───────────────────────────────────────────────

function _evaluateTriggers(scene) {
  const st = scene._approachState;
  const now = Date.now();
  const candidates = [];

  const npcIds = Object.keys(scene.npcs);
  if (npcIds.length === 0) return;

  for (const id of npcIds) {
    // Skip if on cooldown
    if (st.cooldowns[id] && (now - st.cooldowns[id]) < COOLDOWN) continue;

    let reason = null;

    // 1. Sentiment shift
    if (scene._sentimentCache) {
      const s = scene._sentimentCache[id];
      if (s) {
        const trust = s.towardDetective ?? s.trust ?? 0;
        if (trust > 6) reason = 'cooperative';
        else if (trust < -3) reason = 'hostile';
      }
    }

    // 2. Evidence threshold — 5+ collected and NPC not yet interrogated
    if (!reason && scene._approachEvidenceCount >= 5 && !st.interrogated.has(id)) {
      reason = 'evidence';
    }

    // 3. Post-night — after day advances, NPCs who had night conversations
    if (!reason && st._postNightCandidates?.has(id)) {
      reason = 'post-night';
      st._postNightCandidates.delete(id);
    }

    if (reason) {
      candidates.push({ id, reason, priority: reason === 'hostile' ? 3 : reason === 'cooperative' ? 2 : 1 });
    }
  }

  // 4. Random event — 10% per minute, checked every 3s
  // Probability per check = 1 - (1 - 0.10)^(3/60) ≈ 0.00526
  if (candidates.length === 0) {
    const chancePerCheck = 1 - Math.pow(1 - RANDOM_CHANCE_PER_MIN, TRIGGER_CHECK_INTERVAL / 60000);
    if (Math.random() < chancePerCheck) {
      // Pick a random NPC not on cooldown
      const available = npcIds.filter(id => !st.cooldowns[id] || (now - st.cooldowns[id]) >= COOLDOWN);
      if (available.length > 0) {
        const id = available[Math.floor(Math.random() * available.length)];
        candidates.push({ id, reason: 'random', priority: 0 });
      }
    }
  }

  if (candidates.length === 0) return;

  // Pick highest priority candidate
  candidates.sort((a, b) => b.priority - a.priority);
  const chosen = candidates[0];
  _startApproach(scene, chosen.id);
}

function _startApproach(scene, npcId) {
  const st = scene._approachState;
  const sprite = scene.npcs[npcId];
  if (!sprite) return;

  st.active = true;
  st.npcId = npcId;
  st.timer = 0;
  st.arrived = false;
  st.bubbleTimer = 0;
  st.cooldowns[npcId] = Date.now();

  // Create pulsing exclamation mark above NPC
  st.exclamation = scene.add.text(sprite.x, sprite.y - 28, '❗', {
    fontSize: '14px',
  }).setOrigin(0.5).setDepth(15);

  // Pulsing tween
  scene.tweens.add({
    targets: st.exclamation,
    scaleX: 1.3,
    scaleY: 1.3,
    alpha: 0.6,
    duration: 500,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  console.log(`[NPC-Approach] ${npcId} starts approaching the player`);
}

function _showBubble(scene, sprite) {
  const st = scene._approachState;

  // Remove old bubble if any
  if (st.bubble) st.bubble.destroy();

  st.bubble = scene.add.text(sprite.x, sprite.y - 36,
    'I need to speak with you, Detective.', {
      fontSize: '9px',
      fontFamily: 'serif',
      color: '#ffffff',
      backgroundColor: '#333333',
      padding: { x: 4, y: 3 },
      wordWrap: { width: 120 },
    }).setOrigin(0.5, 1).setDepth(15);
}

function _cancelApproach(scene) {
  const st = scene._approachState;
  if (!st.active) return;

  // Clean up visuals
  if (st.exclamation) {
    scene.tweens.killTweensOf(st.exclamation);
    st.exclamation.destroy();
    st.exclamation = null;
  }
  if (st.bubble) {
    st.bubble.destroy();
    st.bubble = null;
  }

  // Stop NPC movement (npcMovement will resume normal pacing next frame)
  const sprite = scene.npcs[st.npcId];
  if (sprite?.body) sprite.setVelocity(0, 0);

  console.log(`[NPC-Approach] ${st.npcId} approach cancelled`);

  st.active = false;
  st.npcId = null;
  st.timer = 0;
  st.arrived = false;
  st.bubbleTimer = 0;
}

async function _fetchSentiments(scene) {
  try {
    const res = await fetch('/api/sentiments');
    if (!res.ok) return;
    const data = await res.json();
    scene._sentimentCache = data;
  } catch { /* network error — keep stale cache */ }

  // Also fetch evidence count
  try {
    const res = await fetch('/api/state');
    if (!res.ok) return;
    const data = await res.json();
    const evidence = data.evidence || {};
    scene._approachEvidenceCount = Object.values(evidence).filter(e => e.collected).length;

    // Detect day transitions for post-night trigger
    const st = scene._approachState;
    const currentDay = data.day ?? data.currentDay ?? 1;
    if (st.lastDay > 0 && currentDay > st.lastDay) {
      // Day advanced — mark all NPCs as post-night candidates
      st._postNightCandidates = new Set(Object.keys(scene.npcs));
    }
    st.lastDay = currentDay;
  } catch { /* ignore */ }
}
