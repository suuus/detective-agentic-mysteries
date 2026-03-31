/**
 * NPC Emotion Visuals — floating indicators, sprite tints, and animation
 * speed changes that reflect each NPC's current emotional state.
 * Polls sentiments from the server and updates the scene visuals.
 */

const POLL_INTERVAL = 8000; // ms between sentiment fetches

const EMOTION_ICONS = {
  calm:        '😐',
  nervous:     '😰',
  angry:       '😠',
  scared:      '😨',
  defensive:   '🛡️',
  cooperative: '🤝',
  hostile:     '😤',
  desperate:   '😱',
};

// Tint colors applied to the NPC sprite (subtle, blended with white)
const EMOTION_TINTS = {
  calm:        0xffffff, // no tint
  nervous:     0xddddff, // slight blue
  angry:       0xffaaaa, // red
  scared:      0xaaaaff, // blue
  defensive:   0xffffaa, // yellow
  cooperative: 0xaaffaa, // green
  hostile:     0xff8888, // strong red
  desperate:   0xddaaff, // purple
};

// Breathing animation speed multiplier (higher = faster breathing)
const EMOTION_BREATH_SPEED = {
  calm:        1.0,
  nervous:     1.6,
  angry:       1.4,
  scared:      2.0,
  defensive:   1.2,
  cooperative: 0.9,
  hostile:     1.5,
  desperate:   2.2,
};

// Map sentiment states to sprite/portrait mood variants
const SENTIMENT_TO_VARIANT = {
  calm:        'neutral',
  cooperative: 'friendly',
  nervous:     'nervous',
  scared:      'nervous',
  angry:       'angry',
  hostile:     'angry',
  defensive:   'angry',
  desperate:   'nervous',
};

/** @type {Map<string, { icon: any, lastState: string, breathTween: any }>} */
const npcVisuals = new Map();
let pollTimer = null;
let activeScene = null;

/**
 * Initialize emotion visuals for all NPCs in the scene.
 * Call once after NPCs are placed.
 * @param {Phaser.Scene} scene — the active manor scene
 * @param {Record<string, Phaser.GameObjects.Sprite>} npcs — id → sprite map
 * @param {Record<string, Phaser.GameObjects.Text>} npcLabels — id → label map
 */
export function initEmotionVisuals(scene, npcs, npcLabels) {
  cleanupEmotionVisuals();
  activeScene = scene;

  for (const [id, sprite] of Object.entries(npcs)) {
    const label = npcLabels[id];
    if (!label) continue;

    // Emotion icon is now embedded in the label text (emoji + name)
    npcVisuals.set(id, { lastState: '', breathTween: null });
  }

  // Start polling
  _pollAndUpdate(npcs, npcLabels);
  pollTimer = setInterval(() => _pollAndUpdate(npcs, npcLabels), POLL_INTERVAL);
}

/**
 * Sync emotion icon positions and visibility with NPC sprites (call from update loop).
 * Icons follow the NPC position and match their floor visibility.
 */
export function syncEmotionPositions(npcs, npcLabels) {
  // Emotion icons are now embedded in label text — no separate icon to sync
}

/**
 * Clean up all visuals and stop polling.
 */
export function cleanupEmotionVisuals() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  for (const vis of npcVisuals.values()) {
    if (vis.breathTween) vis.breathTween.remove();
  }
  npcVisuals.clear();
  activeScene = null;
}

// ── Internal ──────────────────────────────────────────────────

async function _pollAndUpdate(npcs, npcLabels) {
  if (!activeScene || !activeScene.scene.isActive()) return;

  let sentiments;
  try {
    const res = await fetch('/api/sentiments');
    if (!res.ok) return;
    sentiments = await res.json();
  } catch { return; }

  for (const [id, sentiment] of Object.entries(sentiments)) {
    const vis = npcVisuals.get(id);
    const sprite = npcs[id];
    if (!vis || !sprite) continue;

    const state = sentiment.emotionalState || 'calm';
    if (state === vis.lastState) continue; // no change
    vis.lastState = state;

    // 1. Swap sprite texture to mood variant (if available) — target iso sprite if present
    const variant = SENTIMENT_TO_VARIANT[state] || 'neutral';
    const baseKey = `npc_${id}`;
    const variantKey = variant === 'neutral' ? baseKey : `${baseKey}_${variant}`;
    const isoSprite = activeScene?._npcIsoSprites?.[id];
    const targetSprite = isoSprite || sprite;
    if (activeScene.textures.exists(variantKey) && targetSprite.texture.key !== variantKey) {
      targetSprite.setTexture(variantKey);
    }

    // 2. Update label text: emoji + name in rounded box
    const emoji = EMOTION_ICONS[state] || '\u{1F610}';
    const label = npcLabels[id];
    const npcName = npcs[id]?.getData?.('name') || '';
    if (label && npcName) {
      label.setText(emoji + ' ' + npcName);
      // Redraw rounded background to fit new text width
      const bg = activeScene?._npcLabelBgs?.[id];
      if (bg) {
        bg.clear();
        bg.fillStyle(0x111111, 0.85);
        const pad = { x: 7, y: 3 };
        bg.fillRoundedRect(-label.width / 2 - pad.x, -label.height / 2 - pad.y,
          label.width + pad.x * 2, label.height + pad.y * 2, 6);
      }
    }

    // 3. Tint the sprite (subtler now that variants handle expression)
    const tint = EMOTION_TINTS[state] || 0xffffff;
    targetSprite.setTint(tint);

    // 4. Adjust breathing animation speed
    const speedMul = EMOTION_BREATH_SPEED[state] || 1.0;
    const baseDuration = 2000;
    const newDuration = baseDuration / speedMul;

    // Remove old tween, create new one with updated speed
    if (vis.breathTween) {
      vis.breathTween.remove();
    }
    vis.breathTween = activeScene.tweens.add({
      targets: targetSprite,
      scaleY: { from: 1, to: 1.03 },
      duration: newDuration,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // 5. Broadcast mood variant for dialog portrait use
    if (typeof window !== 'undefined') {
      if (!window._npcMoodVariants) window._npcMoodVariants = {};
      window._npcMoodVariants[id] = variant;
    }
  }
}
