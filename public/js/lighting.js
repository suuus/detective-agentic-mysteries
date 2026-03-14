/**
 * lighting.js — Flashlight / fog-of-war lighting system.
 *
 * Uses a Graphics object filled with a dark rectangle, then cuts a circular
 * "hole" at the player position via Phaser's GeometryMask (works in both
 * WebGL and Canvas renderers). Evidence glow is modulated by distance.
 *
 * OFF by default on Day 1; auto-enables on Day 2+ or when isNight is true.
 */

const DEFAULTS = {
  lightRadius: 120,
  dayAlpha: 0.45,
  nightAlpha: 0.75,
  duskAlpha: 0.55,
  evidenceGlowRange: 150,
  depth: 45,          // above evidence/NPCs, below nightOverlay (50) and UI (100)
};

/**
 * Initialise the lighting layer. Call once in create().
 * Stores all state on `scene._lighting`.
 */
export function createLighting(scene, mapW, mapH, tileSize) {
  const w = mapW * tileSize;
  const h = mapH * tileSize;

  // Dark overlay rectangle
  const darkness = scene.add.rectangle(w / 2, h / 2, w, h, 0x0a0a1a, 1);
  darkness.setDepth(DEFAULTS.depth);
  darkness.setAlpha(0);  // invisible until enabled

  // Mask shape: a circle that defines where light shines through.
  // GeometryMask inverted = everything EXCEPT the circle is visible on the
  // darkness layer, so the circle area becomes transparent.
  const maskGfx = scene.make.graphics({ add: false });
  const mask = maskGfx.createGeometryMask();
  mask.invertAlpha = true;
  darkness.setMask(mask);

  scene._lighting = {
    darkness,
    maskGfx,
    mapPxW: w,
    mapPxH: h,
    radius: DEFAULTS.lightRadius,
    enabled: false,
    alpha: DEFAULTS.dayAlpha,
  };
}

/**
 * Call every frame in update(). Repositions the light mask at the player
 * and modulates evidence glow visibility.
 */
export function updateLighting(scene) {
  const lt = scene._lighting;
  if (!lt) return;

  // Auto-enable on Day 2+ or during night
  if (!lt.enabled) {
    const shouldEnable = (scene.currentDay >= 2) || scene.isNight;
    if (shouldEnable) {
      lt.enabled = true;
      _syncButtonState(true);
    } else {
      return;
    }
  }

  // Choose alpha based on time of day
  if (scene.isNight) {
    lt.alpha = DEFAULTS.nightAlpha;
  } else {
    const progress = scene.dayTimer != null
      ? Math.min(scene.dayTimer / scene.DAY_DURATION, 1)
      : 0;
    lt.alpha = progress > 0.8
      ? Phaser.Math.Linear(DEFAULTS.dayAlpha, DEFAULTS.duskAlpha, (progress - 0.8) / 0.2)
      : DEFAULTS.dayAlpha;
  }

  lt.darkness.setAlpha(lt.alpha);

  // Redraw the mask circle at the player position
  const px = scene.player.x;
  const py = scene.player.y;
  const r = lt.radius;

  lt.maskGfx.clear();
  // Soft edge via concentric circles with decreasing alpha
  const rings = 6;
  for (let i = rings; i >= 0; i--) {
    const t = i / rings;
    const ringR = r + t * (r * 0.45);
    const a = 1 - t;                    // inner = opaque, outer = transparent
    lt.maskGfx.fillStyle(0xffffff, a);
    lt.maskGfx.fillCircle(px, py, ringR);
  }

  // Modulate evidence glow visibility based on distance
  _updateEvidenceGlow(scene, px, py);
}

/**
 * Toggle the lighting system on/off programmatically.
 */
export function setLightingEnabled(scene, enabled) {
  const lt = scene._lighting;
  if (!lt) return;
  lt.enabled = enabled;
  if (!enabled) {
    lt.darkness.setAlpha(0);
    // Restore all evidence glow
    _restoreEvidenceGlow(scene);
  }
  _syncButtonState(enabled);
}

/**
 * Toggle flashlight (player-triggered via HUD button or key).
 * Returns the new enabled state.
 */
export function toggleFlashlight(scene) {
  const lt = scene._lighting;
  if (!lt) return false;
  const newState = !lt.enabled;
  setLightingEnabled(scene, newState);
  return newState;
}

// ── Internal helpers ──────────────────────────────────────────

function _updateEvidenceGlow(scene, px, py) {
  const range = DEFAULTS.evidenceGlowRange;
  for (const [, ev] of Object.entries(scene.evidenceItems || {})) {
    if (ev.collected || !ev.glow) continue;
    const d = Phaser.Math.Distance.Between(px, py, ev.sprite.x, ev.sprite.y);
    if (d > range) {
      ev.glow.setVisible(false);
    } else {
      ev.glow.setVisible(true);
      const t = 1 - (d / range);
      ev.glow.setAlpha(Phaser.Math.Clamp(t, 0.15, 1));
    }
  }
}

function _restoreEvidenceGlow(scene) {
  for (const [, ev] of Object.entries(scene.evidenceItems || {})) {
    if (ev.collected || !ev.glow) continue;
    ev.glow.setVisible(true);
    ev.glow.setAlpha(0.7);
  }
}

function _syncButtonState(enabled) {
  const btn = document.getElementById('btn-flashlight');
  if (!btn) return;
  btn.classList.toggle('active', enabled);
  btn.title = enabled ? 'Flashlight ON' : 'Flashlight OFF';
}
