/**
 * Chase sequences — NPC flees, player must catch them.
 * State stored on scene._chaseState.
 */

const CHASE_NPC_SPEED = 80;
const CATCH_DISTANCE = 40;

/**
 * Start a chase: NPC flees toward an exit tile.
 */
export function startChase(scene, npcId, exitTile) {
  const sprite = scene.npcs[npcId];
  if (!sprite || !sprite.visible) return;

  const T = scene.T || 32;
  const exitX = exitTile.x * T + T / 2;
  const exitY = exitTile.y * T + T / 2;

  scene._chaseState = {
    active: true,
    npcId,
    exitTarget: { x: exitX, y: exitY },
    caught: false,
    escaped: false,
    npcSprite: sprite,
    totalDist: Phaser.Math.Distance.Between(sprite.x, sprite.y, exitX, exitY),
  };

  // Freeze all other NPCs
  Object.entries(scene.npcs).forEach(([id, s]) => {
    if (id !== npcId) s.body.setVelocity(0, 0);
  });

  // Show chase banner
  const banner = document.getElementById('chase-banner');
  banner.classList.remove('hidden');

  // Catch detection via physics overlap
  sprite.body.setImmovable(false);
  scene._chaseOverlap = scene.physics.add.overlap(scene.player, sprite, () => {
    _chaseCaught(scene);
  });

  window.setMusicMood?.('chase');
  console.log(`[Chase] ${npcId} is fleeing toward (${exitTile.x}, ${exitTile.y})!`);
}

/**
 * Tick the active chase. Call from update() each frame.
 */
export function updateChase(scene, delta) {
  if (!scene._chaseState?.active) return;

  const chase = scene._chaseState;
  const sprite = chase.npcSprite;
  const exit = chase.exitTarget;

  // Move NPC toward exit with slight wobble
  const angle = Phaser.Math.Angle.Between(sprite.x, sprite.y, exit.x, exit.y);
  const wobble = (Math.random() - 0.5) * 0.3;
  sprite.body.setVelocity(
    Math.cos(angle + wobble) * CHASE_NPC_SPEED,
    Math.sin(angle + wobble) * CHASE_NPC_SPEED
  );

  // Update banner distance
  const distToExit = Phaser.Math.Distance.Between(sprite.x, sprite.y, exit.x, exit.y);
  const meters = Math.ceil(distToExit / 32);
  const bannerText = document.getElementById('chase-text');
  if (bannerText) {
    bannerText.textContent = `🏃 CATCH THEM! (${meters}m to escape)`;
  }

  // NPC reached exit
  if (distToExit < 20) {
    _chaseEscaped(scene);
  }
}

function _chaseCaught(scene) {
  const chase = scene._chaseState;
  if (!chase.active || chase.caught) return;

  chase.caught = true;
  chase.active = false;

  const sprite = chase.npcSprite;
  sprite.body.setVelocity(0, 0);
  sprite.body.setImmovable(true);

  // Cornered effect — exclamation mark
  const excl = scene.add.text(sprite.x, sprite.y - 32, '❗', { fontSize: '24px' })
    .setOrigin(0.5).setDepth(20);
  scene.tweens.add({
    targets: excl, y: sprite.y - 48, alpha: 0,
    duration: 1500, ease: 'Power2',
    onComplete: () => excl.destroy(),
  });

  _adjustSentiment(chase.npcId, 3);
  window.setMusicMood?.('calm');
  _cleanupChase(scene);

  const banner = document.getElementById('chase-banner');
  const bannerText = document.getElementById('chase-text');
  if (bannerText) bannerText.textContent = '✅ CORNERED! They won\'t get away now.';
  setTimeout(() => banner.classList.add('hidden'), 2000);

  console.log(`[Chase] ${chase.npcId} was caught and cornered!`);
}

function _chaseEscaped(scene) {
  const chase = scene._chaseState;
  if (!chase.active || chase.escaped) return;

  chase.escaped = true;
  chase.active = false;

  const sprite = chase.npcSprite;
  sprite.body.setVelocity(0, 0);
  sprite.body.setImmovable(true);

  // Hide NPC for rest of day
  sprite.setVisible(false);
  sprite.body.enable = false;
  if (scene.npcLabels?.[chase.npcId]) {
    scene.npcLabels[chase.npcId].setVisible(false);
  }

  _adjustSentiment(chase.npcId, -3);
  window.setMusicMood?.('calm');

  scene._fledNPCs = scene._fledNPCs || [];
  scene._fledNPCs.push(chase.npcId);

  _cleanupChase(scene);

  const banner = document.getElementById('chase-banner');
  const bannerText = document.getElementById('chase-text');
  if (bannerText) bannerText.textContent = '💨 ESCAPED! They\'ll be more guarded tomorrow.';
  setTimeout(() => banner.classList.add('hidden'), 2000);

  console.log(`[Chase] ${chase.npcId} escaped!`);
}

function _cleanupChase(scene) {
  if (scene._chaseOverlap) {
    scene.physics.world.removeCollider(scene._chaseOverlap);
    scene._chaseOverlap = null;
  }
}

async function _adjustSentiment(characterId, amount) {
  try {
    await window.gameAPI.adjustSentiment(characterId, amount);
  } catch (err) {
    console.warn(`[Chase] Failed to adjust sentiment for ${characterId}:`, err);
  }
}

/**
 * Pick a random exit tile at the edge of the map.
 */
export function getRandomExitTile(scene) {
  const W = scene.MAP_W || 36;
  const H = scene.MAP_H || 32;
  const edge = Math.floor(Math.random() * 4);
  switch (edge) {
    case 0: return { x: Math.floor(Math.random() * W), y: 0 };
    case 1: return { x: W - 1, y: Math.floor(Math.random() * H) };
    case 2: return { x: Math.floor(Math.random() * W), y: H - 1 };
    case 3: return { x: 0, y: Math.floor(Math.random() * H) };
  }
}

/**
 * 30% chance the accused NPC flees after a wrong accusation.
 */
export function maybeChaseOnWrongAccusation(scene, suspectId) {
  if (scene._chaseState?.active) return false;
  if (Math.random() > 0.3) return false;

  const sprite = scene.npcs?.[suspectId];
  if (!sprite || !sprite.visible) return false;

  startChase(scene, suspectId, getRandomExitTile(scene));
  return true;
}
