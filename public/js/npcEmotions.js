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

    // Create emotion icon text above the name label
    const icon = scene.add.text(label.x, label.y - 12, '', {
      fontSize: '10px',
    }).setOrigin(0.5).setDepth(11).setAlpha(0);

    npcVisuals.set(id, { icon, lastState: '', breathTween: null });
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
  for (const [id, vis] of npcVisuals) {
    const sprite = npcs[id];
    const label = npcLabels[id];
    if (!sprite || !label || !vis.icon) continue;
    vis.icon.x = sprite.x;
    vis.icon.y = label.y - 10;
    // Match NPC sprite visibility (handles floor toggling)
    if (vis.icon.visible !== sprite.visible) {
      vis.icon.setVisible(sprite.visible);
    }
  }
}

/**
 * Clean up all visuals and stop polling.
 */
export function cleanupEmotionVisuals() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  for (const vis of npcVisuals.values()) {
    if (vis.icon) vis.icon.destroy();
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

    // 1. Update floating icon
    const emoji = EMOTION_ICONS[state] || '😐';
    vis.icon.setText(emoji);
    // Fade in if not already visible, pulse briefly on state change
    if (vis.icon.alpha < 0.5) {
      activeScene.tweens.add({ targets: vis.icon, alpha: 0.85, duration: 400 });
    } else {
      // Pulse on change
      activeScene.tweens.add({
        targets: vis.icon,
        scale: { from: 1.4, to: 1.0 },
        duration: 400,
        ease: 'Back.easeOut',
      });
    }

    // 2. Tint the sprite
    const tint = EMOTION_TINTS[state] || 0xffffff;
    sprite.setTint(tint);

    // 3. Adjust breathing animation speed
    const speedMul = EMOTION_BREATH_SPEED[state] || 1.0;
    const baseDuration = 2000;
    const newDuration = baseDuration / speedMul;

    // Remove old tween, create new one with updated speed
    if (vis.breathTween) {
      vis.breathTween.remove();
    }
    vis.breathTween = activeScene.tweens.add({
      targets: sprite,
      scaleY: { from: 1, to: 1.03 },
      duration: newDuration,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
}
