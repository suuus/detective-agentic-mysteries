/**
 * Timed pressure events — dramatic countdown challenges.
 * State stored on scene._timedEvent.
 */

/**
 * Trigger a timed event with countdown banner.
 */
export function triggerTimedEvent(scene, { title, description, timeLimit, onExpire, onSuccess }) {
  cancelTimedEvent(scene);

  scene._timedEvent = {
    active: true,
    title,
    description,
    timeLimit,
    remaining: timeLimit,
    onExpire,
    onSuccess,
  };

  const banner = document.getElementById('timed-event-banner');
  const textEl = document.getElementById('timed-event-text');
  const timerEl = document.getElementById('timed-event-timer');

  textEl.textContent = `⚠️ ${title}`;
  timerEl.textContent = _formatTime(timeLimit);
  banner.classList.remove('hidden', 'urgent');
}

/**
 * Tick the active timed event. Call from update() each frame.
 */
export function updateTimedEvent(scene, delta) {
  if (!scene._timedEvent?.active) return;

  const evt = scene._timedEvent;
  evt.remaining -= delta / 1000;

  const timerEl = document.getElementById('timed-event-timer');
  timerEl.textContent = _formatTime(Math.max(0, evt.remaining));

  if (evt.remaining < 30) {
    document.getElementById('timed-event-banner').classList.add('urgent');
  }

  if (evt.remaining <= 0) {
    const cb = evt.onExpire;
    evt.active = false;
    const banner = document.getElementById('timed-event-banner');
    banner.classList.add('hidden');
    banner.classList.remove('urgent');
    if (cb) cb();
  }
}

/**
 * Cancel an active timed event without firing callbacks.
 */
export function cancelTimedEvent(scene) {
  if (!scene._timedEvent?.active) return;
  scene._timedEvent.active = false;
  const banner = document.getElementById('timed-event-banner');
  banner.classList.add('hidden');
  banner.classList.remove('urgent');
}

/**
 * Complete a timed event (player succeeded). Fires onSuccess callback.
 */
export function completeTimedEvent(scene) {
  if (!scene._timedEvent?.active) return;
  const cb = scene._timedEvent.onSuccess;
  cancelTimedEvent(scene);
  if (cb) cb();
}

/**
 * Check if a timed event should trigger for the current day.
 * Call from update() — fires once per day, only on day >= 2, with 40% chance.
 */
export function checkTimedEventTrigger(scene) {
  if (scene._timedEvent?.active) return;
  if (scene.isNight || scene.transitioning) return;
  if (scene.currentDay < 2) return;
  if (scene._lastTimedEventDay === scene.currentDay) return;

  scene._lastTimedEventDay = scene.currentDay;

  if (Math.random() > 0.4) return;

  const npcIds = Object.keys(scene.npcs);
  if (npcIds.length === 0) return;
  const targetId = npcIds[Math.floor(Math.random() * npcIds.length)];
  const targetSprite = scene.npcs[targetId];
  if (!targetSprite?.visible) return;
  const targetName = targetSprite.getData('name') || targetId;

  triggerTimedEvent(scene, {
    title: `THE KILLER WILL STRIKE AGAIN IN 2:00`,
    description: `${targetName} is in danger!`,
    timeLimit: 120,
    onExpire: () => {
      const sprite = scene.npcs[targetId];
      if (sprite) {
        sprite.setVisible(false);
        sprite.body.enable = false;
        if (scene.npcLabels?.[targetId]) {
          scene.npcLabels[targetId].setVisible(false);
        }
        scene._fledNPCs = scene._fledNPCs || [];
        scene._fledNPCs.push(targetId);
      }
      console.log(`[TimedEvent] ${targetName} fled the scene!`);
    },
    onSuccess: () => {
      console.log(`[TimedEvent] Crisis averted — ${targetName} is safe.`);
    },
  });
}

/**
 * Restore NPCs that fled during timed events or chases.
 * Call when a new day begins.
 */
export function restoreFledNPCs(scene) {
  if (!scene._fledNPCs?.length) return;
  for (const id of scene._fledNPCs) {
    const sprite = scene.npcs[id];
    if (sprite) {
      sprite.setVisible(true);
      sprite.body.enable = true;
      if (scene.npcLabels?.[id]) {
        scene.npcLabels[id].setVisible(true);
      }
    }
  }
  scene._fledNPCs = [];
}

function _formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
