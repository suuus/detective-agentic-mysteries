import { createWeatherTextures, createWeather } from '../weather.js';
import { createLighting, updateLighting } from '../lighting.js';

import { initNPCMovement, updateNPCMovement } from '../npcMovement.js';
import { updateTimedEvent, checkTimedEventTrigger, cancelTimedEvent, completeTimedEvent, restoreFledNPCs } from '../timedEvents.js';
import { updateChase, maybeChaseOnWrongAccusation } from '../chase.js';
import { initNPCApproach, updateNPCApproach, isNPCApproaching } from '../npcApproach.js';

/**
 * RandomManorScene — dynamically built 2D manor from generated mystery data.
 * Reads layout from window._generatedWorld (populated by RandomBootScene).
 */
export default class RandomManorScene extends Phaser.Scene {
  constructor() {
    super({ key: 'RandomManorScene' });
    this.facing = 'down';
  }

  create() {
    try {
    console.log('RandomManorScene.create() starting');
    const T = 32;
    this.T = T;
    this._lastRoom = '';
    this._narratorTimeout = null;
    this.wallGroup = this.physics.add.staticGroup();
    this.furnitureGroup = this.physics.add.staticGroup();
    this.npcs = {};
    this.npcLabels = {};
    this.evidenceItems = {};
    this._eWasDown = false;
    this._crimeSceneSeen = false;

    const world = window._generatedWorld;
    if (!world || !world.rooms || world.rooms.length === 0) {
      console.error('No generated world data found');
      return;
    }

    // Build rooms from generated data
    this.rooms = {};
    for (const r of world.rooms) {
      this.rooms[r.id] = { name: r.name, x: r.x, y: r.y, w: r.w, h: r.h, floor: r.floor };
    }

    // Auto-generate doors between nearby rooms
    const rooms = world.rooms;
    this.doors = [];
    for (let i = 0; i < rooms.length; i++) {
      for (let j = i + 1; j < rooms.length; j++) {
        const a = rooms[i], b = rooms[j];
        const aRight = a.x + a.w, aBottom = a.y + a.h;
        const bRight = b.x + b.w, bBottom = b.y + b.h;

        // Check horizontal adjacency: a is left of b (or close)
        const hGap = b.x - aRight;
        if (hGap >= 0 && hGap <= 3) {
          // Find vertical overlap
          const overlapTop = Math.max(a.y, b.y);
          const overlapBot = Math.min(aBottom, bBottom);
          if (overlapBot - overlapTop >= 2) {
            const doorY = overlapTop + Math.floor((overlapBot - overlapTop) / 2) - 1;
            this.doors.push({ x: aRight - 1, y: doorY, w: hGap + 2, h: 2 });
          }
        }
        // b is left of a
        const hGap2 = a.x - bRight;
        if (hGap2 >= 0 && hGap2 <= 3) {
          const overlapTop = Math.max(a.y, b.y);
          const overlapBot = Math.min(aBottom, bBottom);
          if (overlapBot - overlapTop >= 2) {
            const doorY = overlapTop + Math.floor((overlapBot - overlapTop) / 2) - 1;
            this.doors.push({ x: bRight - 1, y: doorY, w: hGap2 + 2, h: 2 });
          }
        }
        // Check vertical adjacency: a is above b (or close)
        const vGap = b.y - aBottom;
        if (vGap >= 0 && vGap <= 3) {
          const overlapLeft = Math.max(a.x, b.x);
          const overlapRight = Math.min(aRight, bRight);
          if (overlapRight - overlapLeft >= 2) {
            const doorX = overlapLeft + Math.floor((overlapRight - overlapLeft) / 2) - 1;
            this.doors.push({ x: doorX, y: aBottom - 1, w: 2, h: vGap + 2 });
          }
        }
        // b is above a
        const vGap2 = a.y - bBottom;
        if (vGap2 >= 0 && vGap2 <= 3) {
          const overlapLeft = Math.max(a.x, b.x);
          const overlapRight = Math.min(aRight, bRight);
          if (overlapRight - overlapLeft >= 2) {
            const doorX = overlapLeft + Math.floor((overlapRight - overlapLeft) / 2) - 1;
            this.doors.push({ x: doorX, y: bBottom - 1, w: 2, h: vGap2 + 2 });
          }
        }
      }
    }
    console.log(`[RandomManor] Generated ${this.doors.length} doors for ${rooms.length} rooms`);

    // Fallback: ensure every room is reachable — if a room has no door, force one to nearest room
    const roomsWithDoors = new Set();
    for (const d of this.doors) {
      for (const r of rooms) {
        const rRight = r.x + r.w, rBottom = r.y + r.h;
        // Check if door touches this room's perimeter
        if (d.x + d.w >= r.x && d.x <= rRight && d.y + d.h >= r.y && d.y <= rBottom) {
          roomsWithDoors.add(r.id);
        }
      }
    }
    for (const r of rooms) {
      if (roomsWithDoors.has(r.id)) continue;
      // Find nearest other room and force a door
      let best = null, bestDist = Infinity;
      for (const other of rooms) {
        if (other.id === r.id) continue;
        const cx1 = r.x + r.w / 2, cy1 = r.y + r.h / 2;
        const cx2 = other.x + other.w / 2, cy2 = other.y + other.h / 2;
        const dist = Math.abs(cx1 - cx2) + Math.abs(cy1 - cy2);
        if (dist < bestDist) { bestDist = dist; best = other; }
      }
      if (best) {
        // Create a corridor door between them
        const midX = Math.floor((r.x + r.w / 2 + best.x + best.w / 2) / 2);
        const midY = Math.floor((r.y + r.h / 2 + best.y + best.h / 2) / 2);
        // Horizontal or vertical based on relative position
        if (Math.abs(r.x - best.x) > Math.abs(r.y - best.y)) {
          const doorY = Math.max(r.y, best.y) + 1;
          const startX = Math.min(r.x + r.w, best.x + best.w) - 1;
          const endX = Math.max(r.x, best.x) + 1;
          this.doors.push({ x: Math.min(startX, endX), y: doorY, w: Math.abs(endX - startX) + 1, h: 2 });
        } else {
          const doorX = Math.max(r.x, best.x) + 1;
          const startY = Math.min(r.y + r.h, best.y + best.h) - 1;
          const endY = Math.max(r.y, best.y) + 1;
          this.doors.push({ x: doorX, y: Math.min(startY, endY), w: 2, h: Math.abs(endY - startY) + 1 });
        }
        console.log(`[RandomManor] Forced door for isolated room "${r.id}" → "${best.id}"`);
      }
    }

    // Compute dynamic map size from room positions
    let maxX = 0, maxY = 0;
    for (const r of world.rooms) {
      maxX = Math.max(maxX, r.x + r.w + 1);
      maxY = Math.max(maxY, r.y + r.h + 1);
    }
    this.MAP_W = Math.max(maxX + 1, 20);
    this.MAP_H = Math.max(maxY + 1, 15);

    this._buildFloors(T);
    this._buildWalls(T);
    this._placeCrimeScene(T, world);
    this._placeFurniture(T);
    this._placeNPCs(T, world);
    initNPCMovement(this);
    this._placeEvidence(T, world);
    this._setupPlayer(T);
    this._setupCamera(T);
    this._setupInput();
    initNPCApproach(this);
    this._createAmbientParticles();

    // Weather effects — use generated world data or randomize by theme
    createWeatherTextures(this);
    const _weatherType = world.visual?.weather
      || ['rain', 'fog', 'storm', 'snow', 'clear'][Math.floor(Math.random() * 5)];
    createWeather(this, _weatherType, this.MAP_W, this.MAP_H, T);

    // Room label HUD
    this.roomLabel = this.add.text(16, 16, '', {
      fontFamily: '"Playfair Display", Georgia, serif', fontSize: '13px',
      color: '#c9a84c', backgroundColor: 'rgba(0,0,0,0.6)', padding: { x:8, y:4 }
    }).setScrollFactor(0).setDepth(100);

    // Interaction prompt sprite
    this.interactPrompt = this.add.text(0, 0, '', {
      fontFamily: '"Lora", serif', fontSize: '10px', color: '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.8)', padding: { x: 8, y: 4 },
      stroke: '#c9a84c', strokeThickness: 1,
    }).setOrigin(0.5).setDepth(20).setVisible(false);
    this._wasBlocked = false;

    // Intro overlay
    this.time.delayedCall(300, () => this._showIntro(world));

    // Day/night cycle state
    this.currentDay = 1;
    this.dayTimer = 0;
    this.DAY_DURATION = 5 * 60 * 1000;
    this.isNight = false;
    this.transitioning = false;

    // Night overlay
    this.nightOverlay = this.add.rectangle(
      this.MAP_W * T / 2, this.MAP_H * T / 2,
      this.MAP_W * T, this.MAP_H * T,
      0x0a0a2a, 0
    ).setDepth(50).setAlpha(0);

    // Ambient tint from visual theme
    const ambientTint = world.visual?.ambientTint;
    if (ambientTint) {
      const tintCol = parseInt(ambientTint.replace('#',''), 16) || 0;
      if (tintCol) {
        this.add.rectangle(
          this.MAP_W * T / 2, this.MAP_H * T / 2,
          this.MAP_W * T, this.MAP_H * T,
          tintCol, 0
        ).setDepth(45).setAlpha(0.15);
      }
    }

    this.GAME_START_HOUR = 10;
    this.GAME_END_HOUR = 18;
    this._updateClock(0);

    // Lighting / flashlight system
    createLighting(this, this.MAP_W, this.MAP_H, T);

    this._hiddenRoomRevealed = false;
    this._redHerringSpawned = false;
    this._syncDayState();
    this._midGameCheckTimer = this.time.addEvent({
      delay: 30000, loop: true,
      callback: () => { this._checkHiddenRoom(); this._checkRedHerring(); }
    });

    this._onWrongAccusation = (e) => maybeChaseOnWrongAccusation(this, e.detail.suspectId);
    this._onCorrectAccusation = () => completeTimedEvent(this);
    window.addEventListener('wrong-accusation', this._onWrongAccusation);
    window.addEventListener('correct-accusation', this._onCorrectAccusation);

    console.log('RandomManorScene.create() complete');
    } catch(err) {
      console.error('RandomManorScene.create() CRASHED:', err);
    }
  }

  // ── DAY/NIGHT CYCLE ────────────────────────────────────────

  _updateClock(progress) {
    const totalHours = this.GAME_END_HOUR - this.GAME_START_HOUR;
    const currentHourFloat = this.GAME_START_HOUR + totalHours * progress;
    const hour24 = Math.floor(currentHourFloat) % 24;
    const minutes = Math.floor((currentHourFloat % 1) * 60);
    const hour12 = hour24 % 12 || 12;
    const ampm = hour24 >= 12 && hour24 < 24 ? 'PM' : 'AM';
    const timeStr = `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    let icon = '🌙';
    if (hour24 >= 6 && hour24 < 17) icon = '☀️';
    else if (hour24 >= 17 && hour24 < 19) icon = '🌅';

    const el = (id) => document.getElementById(id);
    if (el('hud-clock-icon')) el('hud-clock-icon').textContent = icon;
    if (el('hud-clock-day')) el('hud-clock-day').textContent = `Day ${this.currentDay}`;
    if (el('hud-clock-time')) el('hud-clock-time').textContent = timeStr;
    if (el('hud-clock-fill')) el('hud-clock-fill').style.width = `${(1 - progress) * 100}%`;

    if (!this._profileTimer) this._profileTimer = 0;
    this._profileTimer += this.game.loop.delta;
    if (this._profileTimer > 5000) {
      this._profileTimer = 0;
      window.gameAPI?.getProfile().then(p => {
        const el2 = document.getElementById('hud-profile-style');
        const icon2 = document.getElementById('hud-profile-icon');
        if (el2 && p.style !== 'unknown') {
          el2.textContent = p.style;
          const icons = { aggressive: '👊', sympathetic: '🤝', methodical: '🔍', scattered: '🎲', manipulative: '🎭' };
          if (icon2) icon2.textContent = icons[p.style] || '🕵️';
        }
      }).catch(() => {});
    }
  }

  async _syncDayState() {
    try {
      const data = await window.gameAPI.getDay();
      this.currentDay = data.currentDay;
      this.isNight = data.timeOfDay === 'night';
      this._updateClock(0);
      if (this.isNight) {
        this.nightOverlay.setAlpha(0.6);
      }
      // Check for mid-game reveals
      this._checkHiddenRoom();
      this._checkRedHerring();
    } catch (err) {
      console.warn('Failed to sync day state:', err);
    }
  }

  async _triggerNight() {
    if (this.transitioning) return;
    this.transitioning = true;

    cancelTimedEvent(this);

    if (window.dialogManager?.isOpen()) window.dialogManager.close();
    window.setMusicMood?.('night');

    this.tweens.add({ targets: this.nightOverlay, alpha: 0.7, duration: 2000, ease: 'Power2' });
    await new Promise(r => this.time.delayedCall(2200, r));

    const overlay = document.getElementById('night-overlay');
    const titleEl = document.getElementById('night-title');
    const subtitleEl = document.getElementById('night-subtitle');
    const convoEl = document.getElementById('night-conversation');
    const promptEl = document.getElementById('night-prompt');

    const world = window._generatedWorld;
    titleEl.textContent = '\u{1F319} Night Falls...';
    subtitleEl.textContent = 'The suspects are talking in the shadows...';
    convoEl.innerHTML = '';
    promptEl.textContent = '';
    overlay.classList.remove('hidden');

    let dots = 0;
    const dotInterval = setInterval(() => {
      dots = (dots + 1) % 4;
      subtitleEl.textContent = 'The suspects are talking in the shadows' + '.'.repeat(dots);
    }, 500);

    let nightResult;
    try {
      nightResult = await window.gameAPI.advanceDay();
    } catch(err) { console.error('Night advance failed:', err); }

    clearInterval(dotInterval);

    const conversations = nightResult?.conversations ?? [];

    for (let ci = 0; ci < conversations.length; ci++) {
      const convo = conversations[ci];

      titleEl.textContent = '\u{1F319} ' + convo.participantNames.join(' & ');
      subtitleEl.textContent = convo.location;
      convoEl.innerHTML = '';

      for (const ex of convo.exchanges) {
        const isA = ex.speaker === convo.participants[0];
        const div = document.createElement('div');
        div.className = 'night-exchange ' + (isA ? 'speaker-a' : 'speaker-b');
        div.innerHTML =
          '<div class="speaker-name">' + ex.speakerName + '</div>' +
          '<div class="speaker-text">\u201C' + ex.text + '\u201D</div>';
        convoEl.appendChild(div);
      }

      promptEl.textContent = ci < conversations.length - 1
        ? 'Click or press any key for next conversation...'
        : 'Click or press any key to continue...';

      await new Promise(resolve => {
        const done = () => { document.removeEventListener('keydown', done); promptEl.removeEventListener('click', done); resolve(); };
        setTimeout(() => { document.addEventListener('keydown', done, { once: true }); promptEl.addEventListener('click', done, { once: true }); }, 400);
      });
    }

    let dayResult;
    try {
      dayResult = await window.gameAPI.advanceDay();
    } catch(err) { console.error('Day advance failed:', err); dayResult = null; }

    if (dayResult) {
      titleEl.textContent = '\u2600\uFE0F Day ' + dayResult.currentDay + ' \u2014 Dawn';
      subtitleEl.textContent = '';
      convoEl.innerHTML = '';

      if (dayResult.overnightNarrative) {
        const p = document.createElement('p');
        p.style.cssText = 'color:#e8dcc8;font-style:italic;line-height:1.7;text-align:center;margin:16px 0';
        p.textContent = dayResult.overnightNarrative;
        convoEl.appendChild(p);
      }

      if (dayResult.removedEvidence?.length > 0) {
        const warn = document.createElement('p');
        warn.style.cssText = 'color:#ef9a9a;font-style:italic;text-align:center;font-size:0.85rem;margin:8px 0';
        warn.textContent = '\u26A0\uFE0F Some evidence has disappeared overnight...';
        convoEl.appendChild(warn);
      }

      promptEl.textContent = 'Click or press any key to begin the new day...';

      await new Promise(resolve => {
        const done = () => { document.removeEventListener('keydown', done); promptEl.removeEventListener('click', done); resolve(); };
        setTimeout(() => { document.addEventListener('keydown', done, { once: true }); promptEl.addEventListener('click', done, { once: true }); }, 400);
      });
    }

    overlay.classList.add('hidden');

    this.currentDay = dayResult?.currentDay ?? this.currentDay + 1;
    this._updateClock(0);
    this.dayTimer = 0;
    this.isNight = false;
    this.transitioning = false;
    this.tweens.add({ targets: this.nightOverlay, alpha: 0, duration: 1500, ease: 'Power2' });
    restoreFledNPCs(this);
    window.setMusicMood?.('calm');
    await this._applyDayChanges(dayResult?.dayConfig);
  }

  async _applyDayChanges(dayConfig) {
    if (!dayConfig) return;
    const T = this.T;

    const usedPositions = [];
    for (const npcPos of dayConfig.npcPositions) {
      const sprite = this.npcs[npcPos.id];
      if (!sprite) continue;

      let nx = npcPos.x;
      let ny = npcPos.y;

      const offsets = [[0,0],[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1],[2,0],[-2,0],[0,2],[0,-2]];
      for (const [ox, oy] of offsets) {
        const tx = nx + ox;
        const ty = ny + oy;
        if (!usedPositions.some(p => p.x === tx && p.y === ty)) {
          nx = tx;
          ny = ty;
          break;
        }
      }
      usedPositions.push({ x: nx, y: ny });

      const newX = nx * T + T/2;
      const newY = ny * T + T/2;
      sprite.setPosition(newX, newY);

      const label = this.npcLabels[npcPos.id];
      if (label) {
        label.setPosition(newX, ny * T - 8);
      }
    }

    try {
      const positions = await window.gameAPI.getEvidencePositions();

      for (const [id, ev] of Object.entries(this.evidenceItems)) {
        if (ev.collected) continue;
        const stillExists = positions.find(p => p.id === id);
        if (!stillExists) {
          ev.collected = true;
          if (ev.sprite) { ev.sprite.destroy(); }
          if (ev.glow) { ev.glow.destroy(); }
        } else {
          const pos = positions.find(p => p.id === id);
          if (pos) {
            ev.sprite.setPosition(pos.x * T + T/2, pos.y * T + T/2);
            ev.glow.setPosition(pos.x * T + T/2, pos.y * T + T/2);
          }
        }
      }

      for (const pos of positions) {
        if (this.evidenceItems[pos.id]) continue;
        const glow = this.add.image(pos.x*T+T/2, pos.y*T+T/2, 'ev_glow').setDepth(3).setAlpha(0.6);
        this.tweens.add({
          targets: glow, alpha:{from:0.3,to:0.8}, scale:{from:0.9,to:1.2},
          duration:1200, yoyo:true, repeat:-1, ease:'Sine.easeInOut'
        });

        const texKey = 'ev_' + pos.id;
        const spriteKey = this.textures.exists(texKey) ? texKey : 'ev_glow';
        const sprite = this.physics.add.sprite(pos.x*T+T/2, pos.y*T+T/2, spriteKey)
          .setDepth(4).setImmovable(true);
        sprite.body.setSize(20, 20);
        sprite.setData('id', pos.id);
        this.evidenceItems[pos.id] = { sprite, glow, collected: false };
      }
    } catch (err) {
      console.warn('Failed to update evidence positions:', err);
    }

    window.inventoryManager?.refresh();
  }

  // ── BUILD ──────────────────────────────────────────────────

  _buildFloors(T) {
    for (const room of Object.values(this.rooms)) {
      const floorKey = this.textures.exists(room.floor) ? room.floor : 'tile_floor';
      for (let ry = 0; ry < room.h; ry++)
        for (let rx = 0; rx < room.w; rx++)
          this.add.image((room.x+rx)*T+T/2, (room.y+ry)*T+T/2, floorKey).setDepth(0);

      this.add.text((room.x+room.w/2)*T, (room.y+1)*T, room.name, {
        fontFamily: '"Playfair Display", serif', fontSize: '11px', color: '#c9a84c55'
      }).setOrigin(0.5).setDepth(1);
    }
    for (const d of this.doors)
      for (let dy=0; dy<d.h; dy++)
        for (let dx=0; dx<d.w; dx++)
          this.add.image((d.x+dx)*T+T/2, (d.y+dy)*T+T/2, 'tile_floor').setDepth(0);
  }

  _buildWalls(T) {
    const grid = Array.from({length:this.MAP_H}, () => Array(this.MAP_W).fill(true));
    for (const r of Object.values(this.rooms))
      for (let ry=1; ry<r.h-1; ry++)
        for (let rx=1; rx<r.w-1; rx++)
          grid[r.y+ry][r.x+rx] = false;
    for (const d of this.doors)
      for (let dy=0; dy<d.h; dy++)
        for (let dx=0; dx<d.w; dx++) {
          const gy=d.y+dy, gx=d.x+dx;
          if(gy>=0&&gy<this.MAP_H&&gx>=0&&gx<this.MAP_W) grid[gy][gx]=false;
        }

    const neighbors = (x,y) => [[x-1,y],[x+1,y],[x,y-1],[x,y+1]];
    for (let y=0; y<this.MAP_H; y++)
      for (let x=0; x<this.MAP_W; x++) {
        if (!grid[y][x]) continue;
        const visible = neighbors(x,y).some(([nx,ny]) =>
          nx>=0&&nx<this.MAP_W&&ny>=0&&ny<this.MAP_H&&!grid[ny][nx]);
        if (visible)
          this.add.image(x*T+T/2, y*T+T/2, 'tile_wall').setDepth(0);
        const b = this.add.rectangle(x*T+T/2, y*T+T/2, T, T).setVisible(false);
        this.physics.add.existing(b, true);
        this.wallGroup.add(b);
      }
  }

  _placeCrimeScene(T, world) {
    // Determine crime scene room from victim data or use first room
    const victim = world?.victim;
    let crimeRoomId = null;
    if (victim?.location) {
      crimeRoomId = victim.location;
    }
    if (!crimeRoomId || !this.rooms[crimeRoomId]) {
      crimeRoomId = Object.keys(this.rooms)[0];
    }
    const room = this.rooms[crimeRoomId];
    if (!room) return;

    const cx = (room.x + Math.floor(room.w / 2)) * T + T / 2;
    const cy = (room.y + Math.floor(room.h / 2)) * T + T / 2;
    this._crimeSceneRoom = room.name;

    const victimName = victim?.name || 'The victim';

    // Body outline in center of room
    this.add.image(cx, cy, 'crime_body_outline').setDepth(2).setAlpha(0.85);

    // Blood splatters near the body
    this.add.image(cx + T, cy - T * 0.5, 'crime_blood_1').setDepth(2).setAlpha(0.7);
    this.add.image(cx - T * 0.8, cy + T * 0.6, 'crime_blood_2').setDepth(2).setAlpha(0.6);
    this.add.image(cx + T * 1.5, cy + T, 'crime_blood_1').setDepth(2).setAlpha(0.5);

    // Crime tape near the top edge of the room
    const tapeX = (room.x + Math.floor(room.w / 2)) * T;
    const tapeY = room.y * T + T + 4;
    this.add.image(tapeX, tapeY, 'crime_tape').setDepth(2).setAlpha(0.8);
    this.add.image(tapeX, tapeY + 8, 'crime_tape').setDepth(2).setAlpha(0.8);

    this._crimeDescription = `The crime scene. ${victimName} was found dead here in the ${room.name}. The chalk outline and dark stains mark where the body fell.`;
  }

  _placeFurniture(T) {
    // Place 1-2 furniture items per room
    const furnKeys = ['furn_table', 'furn_desk', 'furn_bookshelf', 'furn_plant'];
    const rooms = Object.values(this.rooms);
    for (const room of rooms) {
      const count = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < count; i++) {
        const fx = room.x + 2 + Math.floor(Math.random() * (room.w - 4));
        const fy = room.y + 2 + Math.floor(Math.random() * (room.h - 4));
        const key = furnKeys[Math.floor(Math.random() * furnKeys.length)];
        const img = this.add.image(fx*T+T/2, fy*T+T/2, key).setDepth(2);
        const body = this.add.rectangle(fx*T+T/2, fy*T+T/2, img.width, img.height).setVisible(false);
        this.physics.add.existing(body, true);
        this.furnitureGroup.add(body);
      }
    }
  }

  _placeNPCs(T, world) {
    for (const char of world.characters) {
      const room = this.rooms[char.location] || Object.values(this.rooms)[0];
      // Place inside room interior
      const nx = room.x + 2 + Math.floor(Math.random() * (room.w - 4));
      const ny = room.y + 2 + Math.floor(Math.random() * (room.h - 4));

      const texKey = 'npc_' + char.id;
      const spriteKey = this.textures.exists(texKey) ? texKey : 'npc_' + world.characters[0].id;
      const sprite = this.physics.add.sprite(nx*T+T/2, ny*T+T/2, spriteKey)
        .setDepth(5);
      sprite.body.setSize(28, 28);
      sprite.setCollideWorldBounds(true);
      sprite.setPushable(false);
      sprite.setData('id', char.id);
      sprite.setData('name', char.name);

      const label = this.add.text(nx*T+T/2, ny*T-8, char.name, {
        fontFamily: '"Playfair Display", serif', fontSize: '9px', color: '#c9a84c',
        stroke: '#0a0a0a', strokeThickness: 2
      }).setOrigin(0.5).setDepth(10);
      this.npcLabels[char.id] = label;

      this.tweens.add({
        targets: sprite, scaleY:{from:1,to:1.03},
        duration:2000, yoyo:true, repeat:-1, ease:'Sine.easeInOut'
      });
      this.npcs[char.id] = sprite;
    }

    // NPC-to-NPC colliders
    const npcList = Object.values(this.npcs);
    for (let i = 0; i < npcList.length; i++) {
      for (let j = i + 1; j < npcList.length; j++) {
        this.physics.add.collider(npcList[i], npcList[j]);
      }
    }
    // NPC-to-wall colliders so NPCs can't escape rooms
    for (const sprite of npcList) {
      this.physics.add.collider(sprite, this.wallGroup);
      this.physics.add.collider(sprite, this.furnitureGroup);
    }
  }

  _placeEvidence(T, world) {
    const positions = world.evidencePositions || {};
    for (const ev of world.evidence) {
      const pos = positions[ev.id];
      if (!pos) continue;
      const glow = this.add.image(pos.x*T+T/2, pos.y*T+T/2, 'ev_glow').setDepth(3).setAlpha(0.6);
      this.tweens.add({
        targets:glow, alpha:{from:0.3,to:0.8}, scale:{from:0.9,to:1.2},
        duration:1200, yoyo:true, repeat:-1, ease:'Sine.easeInOut'
      });
      const texKey = 'ev_' + ev.id;
      const spriteKey = this.textures.exists(texKey) ? texKey : 'ev_glow';
      const sprite = this.physics.add.sprite(pos.x*T+T/2, pos.y*T+T/2, spriteKey)
        .setDepth(4).setImmovable(true);
      sprite.body.setSize(20,20);
      sprite.setData('id', ev.id);
      this.evidenceItems[ev.id] = { sprite, glow, collected:false };
    }
  }

  _setupPlayer(T) {
    // Start in the first room
    const firstRoom = Object.values(this.rooms)[0];
    const px = firstRoom.x + Math.floor(firstRoom.w / 2);
    const py = firstRoom.y + Math.floor(firstRoom.h / 2);
    this.player = this.physics.add.sprite(px*T+T/2, py*T+T/2, 'player_down_0').setDepth(6);
    this.player.body.setSize(14, 14).setOffset(9, 16);
    this.player.setCollideWorldBounds(true);
    this.physics.world.setBounds(0, 0, this.MAP_W * T, this.MAP_H * T);
    this.physics.add.collider(this.player, this.wallGroup);
    this.physics.add.collider(this.player, this.furnitureGroup);
    Object.values(this.npcs).forEach(s => this.physics.add.collider(this.player, s));
  }

  _setupCamera(T) {
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setBounds(0, 0, this.MAP_W*T, this.MAP_H*T);
    this.cameras.main.setBackgroundColor('#0a0a0a');
    this.cameras.main.setZoom(2);
  }

  _setupInput() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });
    this._ePressed = false;
    this._eBound = (e) => {
      if (e.key === 'e' || e.key === 'E') this._ePressed = true;
    };
    window.addEventListener('keydown', this._eBound);
  }

  _createAmbientParticles() {
    if (!this.textures.exists('dust')) {
      const c = this.textures.createCanvas('dust', 2, 2);
      c.context.fillStyle = '#e8dcc8';
      c.context.fillRect(0, 0, 2, 2);
      c.refresh();
    }
    this.add.particles(0, 0, 'dust', {
      x: { min: 0, max: this.MAP_W * this.T },
      y: { min: 0, max: this.MAP_H * this.T },
      lifespan: 6000, speed: { min: 3, max: 10 },
      alpha: { start: 0, end: 0.2 }, scale: { start: 0.5, end: 1.5 },
      frequency: 400, blendMode: 'ADD',
    }).setDepth(3);
  }

  // ── UPDATE ─────────────────────────────────────────────────

  _isOverlayOpen() {
    return window.dialogManager?.isOpen()
      || !document.getElementById('inventory-panel')?.classList.contains('hidden')
      || !document.getElementById('notebook-panel')?.classList.contains('hidden')
      || !document.getElementById('accusation-modal')?.classList.contains('hidden')
      || !document.getElementById('end-screen')?.classList.contains('hidden');
  }

  update() {
    const blocked = this._isOverlayOpen();

    if (blocked !== this._wasBlocked) {
      this._wasBlocked = blocked;
      this.input.keyboard.enabled = !blocked;
      if (blocked) {
        this.player.setVelocity(0);
        this.player.anims.play('idle-'+this.facing, true);
        this.interactPrompt.setVisible(false);
        this._ePressed = false;
      }
    }

    if (blocked) {
      this.player.setVelocity(0);
      return;
    }

    if (!this.transitioning && !this.isNight) {
      this.dayTimer += this.game.loop.delta;
      const progress = Math.min(this.dayTimer / this.DAY_DURATION, 1);

      this._updateClock(progress);

      if (progress > 0.8) {
        const duskProgress = (progress - 0.8) / 0.2;
        this.nightOverlay.setAlpha(duskProgress * 0.3);
      }

      if (progress >= 1) {
        this._triggerNight();
      }
    }

    this._handleMovement();
    updateNPCMovement(this, this.game.loop.delta);
    updateTimedEvent(this, this.game.loop.delta);
    checkTimedEventTrigger(this);
    updateChase(this, this.game.loop.delta);
    updateLighting(this);
    this._handleInteractions();
    updateNPCApproach(this, this.game.loop.delta);
    this._updateRoomLabel();
  }

  _handleMovement() {
    const speed = 120;
    let vx=0, vy=0;
    if (this.cursors.left.isDown  || this.wasd.left.isDown)  { vx=-speed; this.facing='left'; }
    if (this.cursors.right.isDown || this.wasd.right.isDown) { vx=speed;  this.facing='right'; }
    if (this.cursors.up.isDown    || this.wasd.up.isDown)    { vy=-speed; this.facing='up'; }
    if (this.cursors.down.isDown  || this.wasd.down.isDown)  { vy=speed;  this.facing='down'; }
    if (vx&&vy) { vx*=0.707; vy*=0.707; }
    this.player.setVelocity(vx, vy);
    if (vx||vy) this.player.anims.play('walk-'+this.facing, true);
    else this.player.anims.play('idle-'+this.facing, true);
  }

  _handleInteractions() {
    const range = 60;
    let closest = null, closestDist = range, closestType = null;

    for (const [id, sprite] of Object.entries(this.npcs)) {
      const d = Phaser.Math.Distance.Between(this.player.x,this.player.y, sprite.x,sprite.y);
      if (d < closestDist) { closest={id,sprite,name:sprite.getData('name')}; closestDist=d; closestType='npc'; }
    }
    for (const [id, ev] of Object.entries(this.evidenceItems)) {
      if (ev.collected) continue;
      const d = Phaser.Math.Distance.Between(this.player.x,this.player.y, ev.sprite.x,ev.sprite.y);
      if (d < closestDist) { closest={id,sprite:ev.sprite}; closestDist=d; closestType='evidence'; }
    }

    if (closest) {
      this.interactPrompt.setPosition(closest.sprite.x, closest.sprite.y-28);
      const label = closestType==='npc'
        ? (isNPCApproaching(this, closest.id) ? '[E] Listen' : `[E] Talk to ${closest.name}`)
        : `[E] Examine`;
      this.interactPrompt.setText(label);
      this.interactPrompt.setVisible(true);

      if (this._ePressed) {
        this._ePressed = false;
        if (closestType==='npc') {
          if (isNPCApproaching(this, closest.id)) {
            window.dialogManager?.openWithPrompt(closest.id, closest.name);
          } else {
            window.dialogManager?.open(closest.id, closest.name);
          }
        } else {
          this._collectEvidence(closest.id);
        }
      }
    } else {
      this.interactPrompt.setVisible(false);
      this._ePressed = false;
    }
  }

  async _collectEvidence(evidenceId) {
    const ev = this.evidenceItems[evidenceId];
    if (!ev || ev.collected) return;
    try {
      const res = await window.gameAPI.collectEvidence(evidenceId);
      if (res.collected || res.alreadyCollected) {
        ev.collected = true;
        this.tweens.add({
          targets:[ev.sprite,ev.glow], y:ev.sprite.y-20, alpha:0, scale:0.3,
          duration:400, ease:'Power2',
          onComplete:()=>{ ev.sprite.destroy(); ev.glow.destroy(); }
        });
        if (res.evidence) this._showPopup(res.evidence);
        window.inventoryManager?.refresh();
        if (res.evidence) {
          window.gameAPI?.narrate('evidence_found', `Found: ${res.evidence.name} — ${res.evidence.detail}`).then(r => {
            if (r.narration) this._showNarration(r.narration);
          });
        }
      }
    } catch(err) { console.error('Collect failed:', err); }
  }

  _showPopup(evidence) {
    const cam = this.cameras.main;
    const w = cam.width, h = cam.height;
    const bg = this.add.rectangle(w/2,h/2,320,130,0x0a0a0a,0.92)
      .setScrollFactor(0).setDepth(200).setStrokeStyle(1,0xc9a84c);
    const title = this.add.text(w/2,h/2-40, '📋 '+evidence.name, {
      fontFamily:'"Playfair Display",serif',fontSize:'14px',color:'#c9a84c',fontStyle:'bold'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    const desc = this.add.text(w/2,h/2+5, evidence.detail, {
      fontFamily:'"Lora",serif',fontSize:'10px',color:'#e8dcc8',
      wordWrap:{width:280},align:'center'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    const hint = this.add.text(w/2,h/2+50,'Press any key…',{fontSize:'9px',color:'#888'})
      .setOrigin(0.5).setScrollFactor(0).setDepth(201);
    this.time.delayedCall(300, () => {
      this.input.keyboard.once('keydown', () => {
        bg.destroy(); title.destroy(); desc.destroy(); hint.destroy();
      });
    });
  }

  _updateRoomLabel() {
    const T = this.T;
    const px = Math.floor(this.player.x/T), py = Math.floor(this.player.y/T);
    let roomName = 'Hallway';
    for (const room of Object.values(this.rooms)) {
      if (px>=room.x && px<room.x+room.w && py>=room.y && py<room.y+room.h) {
        roomName = room.name; break;
      }
    }
    this.roomLabel.setText(roomName);
    if (this._lastRoom !== roomName) {
      this._lastRoom = roomName;
      if (!this._crimeSceneSeen && roomName === this._crimeSceneRoom) {
        this._crimeSceneSeen = true;
        const desc = this._crimeDescription || `The crime scene. Something terrible happened here in the ${roomName}.`;
        window.gameAPI?.narrate('crime_scene', desc).then(r => {
          if (r?.narration) this._showNarration(r.narration);
        });
      }
      window.gameAPI?.narrate('room_enter', `Player entered: ${roomName}`).then(r => {
        if (r.narration) this._showNarration(r.narration);
      });
    }
  }

  _showNarration(text) {
    const unreliable = text.endsWith('[UNRELIABLE]');
    const displayText = unreliable ? text.replace(/\s*\[UNRELIABLE\]\s*$/, '') : text;
    window._lastNarrationUnreliable = unreliable;
    if (window.speakNarration) window.speakNarration(displayText);
    const bar = document.getElementById('narrator-bar');
    const textEl = document.getElementById('narrator-text');
    if (!bar || !textEl) return;
    textEl.textContent = displayText;
    bar.classList.toggle('narrator-unreliable', unreliable);
    bar.classList.remove('hidden');
    clearTimeout(this._narratorTimeout);
    this._narratorTimeout = setTimeout(() => bar.classList.add('hidden'), 6000);
  }

  _showIntro(world) {
    const cam = this.cameras.main;
    const w = cam.width, h = cam.height;
    const title = world?.title || 'Mystery';
    const setting = world?.setting || 'A mysterious location...';
    const ov = this.add.rectangle(w/2,h/2,w,h,0x000000,0.95).setScrollFactor(0).setDepth(300);
    const texts = [
      this.add.text(w/2,h/2-70, title.toUpperCase(),{fontFamily:'"Playfair Display",serif',fontSize:'18px',color:'#c9a84c',fontStyle:'bold',wordWrap:{width:w-60},align:'center'}).setOrigin(0.5),
      this.add.text(w/2,h/2-40,'━━━━━━━━━━━━━━━━━━━━',{fontSize:'10px',color:'#c9a84c33'}).setOrigin(0.5),
      this.add.text(w/2,h/2-10, setting,{fontFamily:'"Lora",serif',fontSize:'11px',color:'#e8dcc8',align:'center',wordWrap:{width:w-80}}).setOrigin(0.5),
      this.add.text(w/2,h/2+25,'Explore. Find evidence. Interrogate the suspects.',{fontFamily:'"Lora",serif',fontSize:'10px',color:'#aaa',align:'center'}).setOrigin(0.5),
      this.add.text(w/2,h/2+55,'WASD: Move  |  E: Interact  |  Bottom HUD: Evidence, Notebook, Accuse',{fontSize:'9px',color:'#888'}).setOrigin(0.5),
      this.add.text(w/2,h/2+75,'Press any key to begin…',{fontSize:'10px',color:'#c9a84c'}).setOrigin(0.5),
    ];
    texts.forEach(t => t.setScrollFactor(0).setDepth(301));
    this.time.delayedCall(500, () => {
      this.input.keyboard.once('keydown', () => {
        this.tweens.add({
          targets:[ov,...texts], alpha:0, duration:800,
          onComplete:()=>{ ov.destroy(); texts.forEach(t=>t.destroy()); }
        });
      });
    });
  }

  // ── HIDDEN ROOM SYSTEM ────────────────────────────────────────

  async _checkHiddenRoom() {
    if (this._hiddenRoomRevealed) return;
    try {
      const data = await window.gameAPI.checkHiddenRoom();
      if (data.revealed && data.room) {
        this._revealHiddenRoom(data.room);
      }
    } catch (err) {
      console.warn('Hidden room check failed:', err);
    }
  }

  _revealHiddenRoom(room) {
    if (this._hiddenRoomRevealed) return;
    this._hiddenRoomRevealed = true;
    const T = this.T;

    const needW = room.x + room.w + 1;
    const needH = room.y + room.h + 1;
    if (needW > this.MAP_W) this.MAP_W = needW;
    if (needH > this.MAP_H) this.MAP_H = needH;

    this.rooms[room.id] = { name: room.name, x: room.x, y: room.y, w: room.w, h: room.h, floor: room.floor || 'tile_floor' };

    if (room.doorway) {
      this.doors.push(room.doorway);
    }

    const floorKey = this.textures.exists(room.floor) ? room.floor : 'tile_floor';
    for (let ry = 0; ry < room.h; ry++)
      for (let rx = 0; rx < room.w; rx++)
        this.add.image((room.x+rx)*T+T/2, (room.y+ry)*T+T/2, floorKey).setDepth(0);

    this.add.text((room.x+room.w/2)*T, (room.y+1)*T, room.name, {
      fontFamily: '"Playfair Display", serif', fontSize: '11px', color: '#c9a84c55'
    }).setOrigin(0.5).setDepth(1);

    if (room.doorway) {
      const d = room.doorway;
      for (let dy = 0; dy < d.h; dy++)
        for (let dx = 0; dx < d.w; dx++)
          this.add.image((d.x+dx)*T+T/2, (d.y+dy)*T+T/2, 'tile_floor').setDepth(0);
    }

    // Remove wall physics bodies AND visible wall images where the doorway is
    if (room.doorway) {
      const d = room.doorway;
      this.wallGroup.getChildren().forEach(wall => {
        const wx = Math.floor(wall.x / T);
        const wy = Math.floor(wall.y / T);
        if (wx >= d.x && wx < d.x + d.w && wy >= d.y && wy < d.y + d.h) {
          wall.destroy();
        }
      });
      this.children.list.filter(c => c.texture && c.texture.key === 'tile_wall').forEach(wallImg => {
        const wx = Math.floor(wallImg.x / T);
        const wy = Math.floor(wallImg.y / T);
        if (wx >= d.x && wx < d.x + d.w && wy >= d.y && wy < d.y + d.h) {
          wallImg.destroy();
        }
      });
    }

    const grid = Array.from({length: this.MAP_H}, () => Array(this.MAP_W).fill(true));
    for (const r of Object.values(this.rooms))
      for (let ry = 1; ry < r.h - 1; ry++)
        for (let rx = 1; rx < r.w - 1; rx++)
          if (r.y+ry < this.MAP_H && r.x+rx < this.MAP_W) grid[r.y+ry][r.x+rx] = false;
    for (const d of this.doors)
      for (let dy = 0; dy < d.h; dy++)
        for (let dx = 0; dx < d.w; dx++) {
          const gy = d.y+dy, gx = d.x+dx;
          if (gy >= 0 && gy < this.MAP_H && gx >= 0 && gx < this.MAP_W) grid[gy][gx] = false;
        }

    const neighbors = (x, y) => [[x-1,y],[x+1,y],[x,y-1],[x,y+1]];
    const sx = Math.max(0, room.x - 1), sy = Math.max(0, room.y - 1);
    const ex = Math.min(this.MAP_W, room.x + room.w + 1), ey = Math.min(this.MAP_H, room.y + room.h + 1);
    for (let y = sy; y < ey; y++)
      for (let x = sx; x < ex; x++) {
        if (!grid[y][x]) continue;
        const visible = neighbors(x, y).some(([nx, ny]) =>
          nx >= 0 && nx < this.MAP_W && ny >= 0 && ny < this.MAP_H && !grid[ny][nx]);
        if (visible)
          this.add.image(x*T+T/2, y*T+T/2, 'tile_wall').setDepth(0);
        const b = this.add.rectangle(x*T+T/2, y*T+T/2, T, T).setVisible(false);
        this.physics.add.existing(b, true);
        this.wallGroup.add(b);
      }

    for (const ev of (room.evidence || [])) {
      const evKey = 'ev_' + ev.id;
      if (!this.textures.exists(evKey)) {
        const g = this.make.graphics({x:0, y:0, add:false});
        g.fillStyle(0xd4af37, 1); g.fillRect(1, 1, 14, 14);
        g.fillStyle(0xffd700, 1); g.fillRect(3, 3, 10, 10);
        g.fillStyle(0x8b6914, 1); g.fillRect(5, 5, 6, 6);
        g.generateTexture(evKey, 16, 16); g.destroy();
      }

      const glow = this.add.image(ev.x*T+T/2, ev.y*T+T/2, 'ev_glow').setDepth(8).setAlpha(0.7).setScale(1.5);
      this.tweens.add({
        targets: glow, alpha:{from:0.4,to:1.0}, scale:{from:1.3,to:1.8},
        duration:1200, yoyo:true, repeat:-1, ease:'Sine.easeInOut'
      });
      const sprite = this.physics.add.sprite(ev.x*T+T/2, ev.y*T+T/2, evKey)
        .setDepth(9).setImmovable(true).setScale(1.5);
      sprite.body.setSize(20, 20);
      sprite.setData('id', ev.id);
      this.evidenceItems[ev.id] = { sprite, glow, collected: false };
      this.physics.add.collider(this.player, sprite);
    }

    this.cameras.main.setBounds(0, 0, this.MAP_W * T, this.MAP_H * T);
    this.cameras.main.shake(500, 0.01);
    this.time.delayedCall(600, () => {
      window.gameAPI.narrate('hidden_room', `A hidden passage has been discovered! The ${room.name} lies beyond a secret entrance.`).then(result => {
        if (result?.narration) {
          this._showNarration(result.narration);
        } else {
          this._showNarration(`A hidden passage has been discovered! The ${room.name} has been revealed.`);
        }
      }).catch(() => {
        this._showNarration(`A hidden passage has been discovered! The ${room.name} has been revealed.`);
      });
    });
  }

  // ── RED HERRING NPC SYSTEM ────────────────────────────────────

  async _checkRedHerring() {
    if (this._redHerringSpawned) return;
    try {
      const data = await window.gameAPI.checkRedHerring();
      if (data.active && data.npc) {
        this._spawnRedHerring(data.npc);
      }
    } catch (err) {
      console.warn('Red herring check failed:', err);
    }
  }

  _spawnRedHerring(npc) {
    if (this._redHerringSpawned) return;
    this._redHerringSpawned = true;
    const T = this.T;

    const texKey = 'npc_' + npc.id;
    if (!this.textures.exists(texKey)) {
      const bodyColor = npc.color || 0x4a0e4e;
      const g = this.make.graphics({x:0, y:0, add:false});
      g.fillStyle(0xf5d5b8, 1); g.fillCircle(16, 8, 7);
      g.fillStyle(bodyColor, 1); g.fillRect(8, 14, 16, 12);
      g.fillStyle(0x000000, 1); g.fillRect(13, 6, 2, 2); g.fillRect(18, 6, 2, 2);
      g.fillStyle(0x222222, 1); g.fillRect(10, 26, 4, 6); g.fillRect(18, 26, 4, 6);
      g.fillStyle(0xcc3333, 1); g.fillRect(10, 1, 12, 4);
      g.generateTexture(texKey, 32, 32); g.destroy();
    }

    const sprite = this.physics.add.sprite(npc.x*T+T/2, npc.y*T+T/2, texKey)
      .setDepth(5).setImmovable(true);
    sprite.body.setSize(28, 28);
    sprite.setData('id', npc.id);
    sprite.setData('name', npc.name);

    const label = this.add.text(npc.x*T+T/2, npc.y*T-8, npc.name, {
      fontFamily: '"Playfair Display", serif', fontSize: '9px', color: '#c9a84c',
      stroke: '#0a0a0a', strokeThickness: 2
    }).setOrigin(0.5).setDepth(10);
    this.npcLabels[npc.id] = label;

    this.tweens.add({
      targets: sprite, scaleY:{from:1,to:1.03},
      duration:2000, yoyo:true, repeat:-1, ease:'Sine.easeInOut'
    });
    this.npcs[npc.id] = sprite;

    this.physics.add.collider(this.player, sprite);
    Object.values(this.npcs).forEach(other => {
      if (other !== sprite) this.physics.add.collider(sprite, other);
    });

    this._showNarration(`A new figure has appeared: ${npc.name}`);
  }
}
