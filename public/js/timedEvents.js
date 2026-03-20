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

      // Notify server — NPCs learn about the murder, clues are generated
      fetch('/api/murder-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ victimId: targetId, victimName: targetName }),
      }).catch(() => {});

      // Show dramatic notification
      const overlay = document.createElement('div');
      overlay.id = 'timed-event-result';
      overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(80,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:9999;animation:fadeIn 0.5s';
      overlay.innerHTML = `<div style="text-align:center;color:#ff4444;font-family:var(--font-heading,Georgia,serif);max-width:500px;padding:32px">
        <div style="font-size:3rem;margin-bottom:16px">💀</div>
        <h2 style="font-size:1.8rem;margin-bottom:12px;color:#ff6666">THE KILLER STRUCK AGAIN</h2>
        <p style="color:#ffaaaa;font-size:1.1rem;margin-bottom:8px">${targetName} has been found dead.</p>
        <p style="color:#ff8888;font-size:0.9rem;margin-bottom:8px">You failed to prevent the murder. The investigation continues, but you've lost a potential witness.</p>
        <p style="color:#ffcccc;font-size:0.85rem;margin-bottom:24px">📓 New clues have been added to your notebook. The remaining suspects have been informed.</p>
        <button onclick="this.closest('#timed-event-result').remove()" style="background:#aa2222;color:white;border:none;padding:10px 24px;border-radius:4px;cursor:pointer;font-size:1rem">Continue Investigation</button>
      </div>`;
      document.body.appendChild(overlay);
      console.log(`[TimedEvent] ${targetName} was murdered!`);
    },
    onSuccess: () => {
      const overlay = document.createElement('div');
      overlay.id = 'timed-event-result';
      overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,40,0,0.85);display:flex;align-items:center;justify-content:center;z-index:9999;animation:fadeIn 0.5s';
      overlay.innerHTML = `<div style="text-align:center;color:#44ff44;font-family:var(--font-heading,Georgia,serif);max-width:500px;padding:32px">
        <div style="font-size:3rem;margin-bottom:16px">🛡️</div>
        <h2 style="font-size:1.8rem;margin-bottom:12px;color:#66ff66">CRISIS AVERTED</h2>
        <p style="color:#aaffaa;font-size:1.1rem;margin-bottom:24px">${targetName} is safe — your accusation scared the killer off.</p>
        <button onclick="this.closest('#timed-event-result').remove()" style="background:#226622;color:white;border:none;padding:10px 24px;border-radius:4px;cursor:pointer;font-size:1rem">Continue</button>
      </div>`;
      document.body.appendChild(overlay);
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
