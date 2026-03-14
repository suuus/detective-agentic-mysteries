// NPC pacing/walking behavior — shared across all manor scenes
// NPCs slowly wander within their assigned room boundaries.

const PACE_SPEED_MIN = 30;
const PACE_SPEED_MAX = 40;
const IDLE_TIME_MIN = 2000;
const IDLE_TIME_MAX = 5000;
const PAUSE_TIME_MIN = 1000;
const PAUSE_TIME_MAX = 3000;
const ARRIVAL_DIST = 4; // pixels – close enough to target
const ROOM_MARGIN = 1.5; // tiles inward from room edge for walkable area

function rand(min, max) {
  return min + Math.random() * (max - min);
}

/** Determine which room an NPC is currently inside based on pixel position. */
function findRoomForSprite(sprite, rooms, T) {
  const tx = sprite.x / T;
  const ty = sprite.y / T;
  for (const [id, r] of Object.entries(rooms)) {
    if (tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h) {
      return id;
    }
  }
  return null;
}

/** Pick a random walkable pixel position inside the given room. */
function randomPointInRoom(room, T) {
  const minX = (room.x + ROOM_MARGIN) * T;
  const maxX = (room.x + room.w - ROOM_MARGIN) * T;
  const minY = (room.y + ROOM_MARGIN) * T;
  const maxY = (room.y + room.h - ROOM_MARGIN) * T;
  return {
    x: rand(minX, maxX),
    y: rand(minY, maxY),
  };
}

/**
 * Initialise per-NPC movement state. Call once after _placeNPCs().
 * Attaches scene._npcStates and scene._npcTileSize.
 */
export function initNPCMovement(scene) {
  const T = 32;
  scene._npcTileSize = T;
  scene._npcStates = {};

  for (const [id, sprite] of Object.entries(scene.npcs)) {
    const roomId = findRoomForSprite(sprite, scene.rooms, T);
    scene._npcStates[id] = {
      state: 'idle',
      roomId,
      target: null,
      timer: rand(IDLE_TIME_MIN, IDLE_TIME_MAX),
      speed: rand(PACE_SPEED_MIN, PACE_SPEED_MAX),
    };
  }
}

/**
 * Tick NPC movement each frame. Call from update().
 */
export function updateNPCMovement(scene, delta) {
  if (!scene._npcStates) return;

  const frozen = scene.transitioning || scene.isNight || scene._isOverlayOpen();

  for (const [id, st] of Object.entries(scene._npcStates)) {
    const sprite = scene.npcs[id];
    if (!sprite || !sprite.body) continue;

    // Skip normal pacing when this NPC is in "approaching" state
    if (scene._approachState?.active && scene._approachState.npcId === id) {
      _syncLabel(scene, id, sprite);
      continue;
    }

    // Freeze all movement when overlay/night/transitioning
    if (frozen) {
      sprite.setVelocity(0, 0);
      _syncLabel(scene, id, sprite);
      continue;
    }

    switch (st.state) {
      case 'idle':
        sprite.setVelocity(0, 0);
        st.timer -= delta;
        if (st.timer <= 0) {
          const room = scene.rooms[st.roomId];
          if (room) {
            st.target = randomPointInRoom(room, scene._npcTileSize);
            st.state = 'walking';
          } else {
            // No room found – stay idle
            st.timer = rand(IDLE_TIME_MIN, IDLE_TIME_MAX);
          }
        }
        break;

      case 'walking': {
        const dx = st.target.x - sprite.x;
        const dy = st.target.y - sprite.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < ARRIVAL_DIST) {
          sprite.setVelocity(0, 0);
          st.state = 'pausing';
          st.timer = rand(PAUSE_TIME_MIN, PAUSE_TIME_MAX);
        } else {
          // Clamp NPC within room bounds — abort if drifted outside
          const room = scene.rooms[st.roomId];
          if (room) {
            const T = scene._npcTileSize;
            const minX = room.x * T;
            const maxX = (room.x + room.w) * T;
            const minY = room.y * T;
            const maxY = (room.y + room.h) * T;
            if (sprite.x < minX || sprite.x > maxX || sprite.y < minY || sprite.y > maxY) {
              // Snap back inside room and go idle
              sprite.x = Math.max(minX + T, Math.min(maxX - T, sprite.x));
              sprite.y = Math.max(minY + T, Math.min(maxY - T, sprite.y));
              sprite.setVelocity(0, 0);
              st.state = 'idle';
              st.timer = rand(IDLE_TIME_MIN, IDLE_TIME_MAX);
              break;
            }
          }
          const vx = (dx / dist) * st.speed;
          const vy = (dy / dist) * st.speed;
          sprite.setVelocity(vx, vy);
        }
        break;
      }

      case 'pausing':
        sprite.setVelocity(0, 0);
        st.timer -= delta;
        if (st.timer <= 0) {
          st.state = 'idle';
          st.timer = rand(IDLE_TIME_MIN, IDLE_TIME_MAX);
          st.speed = rand(PACE_SPEED_MIN, PACE_SPEED_MAX);
        }
        break;
    }

    _syncLabel(scene, id, sprite);
  }
}

/** Keep the name label centred above the sprite. */
function _syncLabel(scene, id, sprite) {
  const label = scene.npcLabels[id];
  if (label) {
    label.x = sprite.x;
    label.y = sprite.y - 20;
  }
}
