import { createWeatherTextures, createWeather } from '../weather.js';
import { createLighting, updateLighting } from '../lighting.js';

import { initNPCMovement, updateNPCMovement } from '../npcMovement.js';
import { updateTimedEvent, checkTimedEventTrigger, cancelTimedEvent, completeTimedEvent, restoreFledNPCs } from '../timedEvents.js';
import { updateChase, maybeChaseOnWrongAccusation } from '../chase.js';
import { initNPCApproach, updateNPCApproach, isNPCApproaching } from '../npcApproach.js';
import { initEmotionVisuals, syncEmotionPositions } from '../npcEmotions.js';
import { ISO_TILE_W, ISO_TILE_H, tileToScreen, screenToTile, isoMapBounds, isoDepth } from '../isoUtils.js';

/**
 * CruiseManorScene — 2D cruise ship with rooms, NPCs, and evidence.
 * Uses a tile-based layout with collision walls and doorways.
 */
export default class CruiseManorScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CruiseManorScene' });
    this.facing = 'down';
  }

  create() {
    try {
    console.log('CruiseManorScene.create() starting');
    const T = 32; // Physics tile size (world space)
    this.T = T;

    this.MAP_W = 40;
    this.MAP_H = 54;

    // Isometric rendering setup
    const bounds = isoMapBounds(this.MAP_W, this.MAP_H);
    this._isoOffsetX = bounds.offsetX;
    this._isoOffsetY = bounds.offsetY;
    this._isoMapW = bounds.width;
    this._isoMapH = bounds.height;
    this._lastRoom = '';
    this._narratorTimeout = null;
    this.wallGroup = this.physics.add.staticGroup();
    this.furnitureGroup = this.physics.add.staticGroup();
    this.npcs = {};
    this.npcLabels = {};
    this.evidenceItems = {};
    this._eWasDown = false;
    this._crimeSceneSeen = false;

    // Room definitions — boat-shaped layout
    // The ship hull tapers at bow (top) and stern (bottom)
    // Hull outline: widest at y≈20-30 (beam ~28 tiles), narrowing at bow/stern
    this.rooms = {
      // BOW (top) — narrow
      bridge:           { name:'Bridge',            x:15, y:3,  w:10, h:6,  floor:'tile_metal' },
      // FORWARD
      observation_deck: { name:'Observation Deck',  x:11, y:10, w:18, h:6,  floor:'tile_wood_deck' },
      // UPPER DECK
      library:          { name:'Ship Library',      x:8,  y:17, w:10, h:6,  floor:'tile_carpet_blue' },
      penthouse:        { name:'Penthouse Suite',   x:22, y:17, w:10, h:6,  floor:'tile_carpet_blue' },
      // MIDSHIP — widest
      lounge:           { name:'Grand Lounge',      x:6,  y:24, w:28, h:6,  floor:'tile_carpet_blue' },
      // MID-AFT
      casino:           { name:'Casino',            x:6,  y:31, w:12, h:6,  floor:'tile_carpet_red' },
      restaurant:       { name:'Restaurant',        x:22, y:31, w:12, h:6,  floor:'tile_carpet_red' },
      // AFT
      kitchen:          { name:'Kitchen',           x:7,  y:38, w:10, h:6,  floor:'tile_tile_white' },
      pool_deck:        { name:'Pool Deck',         x:23, y:38, w:10, h:6,  floor:'tile_wood_deck' },
      // STERN
      staff_quarters:   { name:'Staff Quarters',    x:9,  y:45, w:8,  h:6,  floor:'tile_metal' },
      medical_bay:      { name:'Medical Bay',       x:12, y:45, w:8,  h:6,  floor:'tile_tile_white' },
      security_office:  { name:'Security Office',   x:20, y:45, w:8,  h:6,  floor:'tile_metal' },
    };

    // Doorways connecting rooms
    this.doors = [
      { x:18, y:8,  w:4, h:3 },  // bridge <-> observation_deck
      { x:15, y:15, w:4, h:3 },  // observation_deck <-> library
      { x:21, y:15, w:4, h:3 },  // observation_deck <-> penthouse
      { x:11, y:22, w:4, h:3 },  // library <-> lounge
      { x:25, y:22, w:4, h:3 },  // penthouse <-> lounge
      { x:10, y:29, w:4, h:3 },  // lounge <-> casino
      { x:26, y:29, w:4, h:3 },  // lounge <-> restaurant
      { x:17, y:29, w:6, h:3 },  // lounge <-> (casino-restaurant corridor)
      { x:10, y:36, w:4, h:3 },  // casino <-> kitchen
      { x:26, y:36, w:4, h:3 },  // restaurant <-> pool_deck
      { x:12, y:43, w:4, h:3 },  // kitchen <-> staff_quarters/medical_bay
      { x:24, y:43, w:4, h:3 },  // pool_deck <-> security_office
      { x:16, y:48, w:4, h:2 },  // medical_bay <-> staff_quarters (internal)
      { x:19, y:48, w:4, h:2 },  // medical_bay <-> security_office (internal)
    ];

    this._buildFloors(T);
    this._buildWalls(T);
    this._placeCrimeScene(T);
    this._placeFurniture(T);
    this._placeNPCs(T);
    initNPCMovement(this);
    this._placeEvidence(T);
    this._setupPlayer(T);
    this._setupCamera(T);
    this._setupInput();
    initNPCApproach(this);
    initEmotionVisuals(this, this.npcs, this.npcLabels);
    this._createAmbientParticles();

    // Proximity speech bubble state
    this._proxBubbles = {};      // { npcId: { text: Phaser.Text, timer: ms } }
    this._proxCooldowns = {};    // { npcId: timestamp of last bubble }

    // Weather effects (ocean rain by default)
    createWeatherTextures(this);
    createWeather(this, 'rain', this.MAP_W, this.MAP_H, T);

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
    this.time.delayedCall(300, () => this._showIntro());

    // Day/night cycle state
    this.currentDay = 1;
    this.dayTimer = 0;
    this.DAY_DURATION = 5 * 60 * 1000; // 5 minutes in ms
    this.isNight = false;
    this.transitioning = false;

    // Night overlay (dark blue tint over everything — uses iso map size)
    this.nightOverlay = this.add.rectangle(
      this._isoMapW / 2, this._isoMapH / 2,
      this._isoMapW, this._isoMapH,
      0x0a0a2a, 0
    ).setDepth(50).setAlpha(0);

    // Day/time clock — driven via HTML HUD bar
    this.GAME_START_HOUR = 10; // 10:00 AM
    this.GAME_END_HOUR = 18;   // 6:00 PM
    this._updateClock(0);

    // Lighting / flashlight system
    createLighting(this, this.MAP_W, this.MAP_H, T);

    // Sync with server
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

    console.log('CruiseManorScene.create() complete');
    } catch(err) {
      console.error('CruiseManorScene.create() CRASHED:', err);
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

    // Update profile display every ~5 seconds
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

    // Darken the game world
    this.tweens.add({ targets: this.nightOverlay, alpha: 0.7, duration: 2000, ease: 'Power2' });
    await new Promise(r => this.time.delayedCall(2200, r));
    const overlay = document.getElementById('night-overlay');
    const titleEl = document.getElementById('night-title');
    const subtitleEl = document.getElementById('night-subtitle');
    const convoEl = document.getElementById('night-conversation');
    const promptEl = document.getElementById('night-prompt');

    // Show loading state
    titleEl.textContent = '\u{1F319} Night Falls Over the Meridian';
    subtitleEl.textContent = 'The suspects are talking in the shadows...';
    convoEl.innerHTML = '';
    promptEl.textContent = '';
    overlay.classList.remove('hidden');

    // Animate dots while waiting
    let dots = 0;
    const dotInterval = setInterval(() => {
      dots = (dots + 1) % 4;
      subtitleEl.textContent = 'The suspects are talking in the shadows' + '.'.repeat(dots);
    }, 500);

    // Trigger night on server (Director plans + NPC conversations execute)
    console.log('[Night] Calling advanceDay API...');
    let nightResult;
    try {
      nightResult = await window.gameAPI.advanceDay();
      console.log('[Night] advanceDay returned:', nightResult?.timeOfDay, 'conversations:', nightResult?.conversations?.length ?? 0);
    } catch(err) {
      console.error('[Night] advanceDay FAILED:', err);
      subtitleEl.textContent = 'Connection lost — click to continue to dawn...';
    }

    clearInterval(dotInterval);

    // Show each conversation one at a time
    const conversations = nightResult?.conversations ?? [];
    if (conversations.length === 0) {
      console.warn('[Night] No conversations received from server');
      subtitleEl.textContent = 'The ship falls silent...';
      convoEl.innerHTML = '';
      const fallbackP = document.createElement('p');
      fallbackP.style.cssText = 'color:#e8dcc8;font-style:italic;text-align:center;margin:24px 0;opacity:0.7';
      fallbackP.textContent = 'The suspects retreat to their cabins, speaking only in whispers you cannot hear.';
      convoEl.appendChild(fallbackP);
      promptEl.textContent = 'Click or press any key to continue...';
      await new Promise(resolve => {
        const done = () => { document.removeEventListener('keydown', done); promptEl.removeEventListener('click', done); resolve(); };
        setTimeout(() => { document.addEventListener('keydown', done, { once: true }); promptEl.addEventListener('click', done, { once: true }); }, 400);
      });
    }

    for (let ci = 0; ci < conversations.length; ci++) {
      const convo = conversations[ci];
      console.log(`[Night] Showing conversation ${ci+1}/${conversations.length}: ${convo.participantNames?.join(' & ')}`);

      titleEl.textContent = '\u{1F319} ' + convo.participantNames.join(' & ');
      subtitleEl.textContent = convo.location;
      convoEl.innerHTML = '';

      for (const ex of convo.exchanges) {
        const isA = ex.speaker === convo.participants[0];
        const div = document.createElement('div');
        div.className = 'night-exchange ' + (isA ? 'speaker-a' : 'speaker-b');
        const nameDiv = document.createElement('div');
        nameDiv.className = 'speaker-name';
        nameDiv.textContent = ex.speakerName;
        const textDiv = document.createElement('div');
        textDiv.className = 'speaker-text';
        textDiv.textContent = '\u201C' + ex.text + '\u201D';
        div.appendChild(nameDiv);
        div.appendChild(textDiv);
        convoEl.appendChild(div);
      }

      promptEl.textContent = ci < conversations.length - 1
        ? 'Click or press any key for next conversation...'
        : 'Click or press any key to continue...';

      // Wait for click or keypress
      await new Promise(resolve => {
        const done = () => { document.removeEventListener('keydown', done); promptEl.removeEventListener('click', done); resolve(); };
        setTimeout(() => { document.addEventListener('keydown', done, { once: true }); promptEl.addEventListener('click', done, { once: true }); }, 400);
      });
    }

    // Advance night -> next day
    let dayResult;
    try {
      dayResult = await window.gameAPI.advanceDay();
    } catch(err) { console.error('Day advance failed:', err); dayResult = null; }

    // Show dawn summary
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

    // Hide overlay
    overlay.classList.add('hidden');

    // Apply new day state
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

    // Reposition NPCs — offset any that would overlap
    const usedPositions = [];
    for (const npcPos of dayConfig.npcPositions) {
      const sprite = this.npcs[npcPos.id];
      if (!sprite) continue;

      let nx = npcPos.x;
      let ny = npcPos.y;

      // Check for collision with already-placed NPCs and offset if needed
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
        label.setPosition(newX, ny * T - 16);
      }
    }

    // Update evidence positions
    try {
      const positions = await window.gameAPI.getEvidencePositions();

      // Remove sprites for evidence no longer present
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

      // Add new evidence sprites
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
    const ox = this._isoOffsetX, oy = this._isoOffsetY;

    // Build hull mask — defines which tiles are inside the ship
    this._hullGrid = Array.from({length:this.MAP_H}, () => Array(this.MAP_W).fill(false));

    // Mark room tiles as hull
    for (const room of Object.values(this.rooms))
      for (let ry = 0; ry < room.h; ry++)
        for (let rx = 0; rx < room.w; rx++) {
          const gx = room.x+rx, gy = room.y+ry;
          if (gx >= 0 && gx < this.MAP_W && gy >= 0 && gy < this.MAP_H)
            this._hullGrid[gy][gx] = true;
        }
    // Mark doorway tiles as hull
    for (const d of this.doors)
      for (let dy = 0; dy < d.h; dy++)
        for (let dx = 0; dx < d.w; dx++) {
          const gx = d.x+dx, gy = d.y+dy;
          if (gx >= 0 && gx < this.MAP_W && gy >= 0 && gy < this.MAP_H)
            this._hullGrid[gy][gx] = true;
        }

    // Fill hull border — expand hull by 1 tile for the outer wall band
    const hullExpanded = Array.from({length:this.MAP_H}, () => Array(this.MAP_W).fill(false));
    for (let y = 0; y < this.MAP_H; y++)
      for (let x = 0; x < this.MAP_W; x++) {
        if (this._hullGrid[y][x]) {
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              const ny = y+dy, nx = x+dx;
              if (ny >= 0 && ny < this.MAP_H && nx >= 0 && nx < this.MAP_W)
                hullExpanded[ny][nx] = true;
            }
        }
      }

    // Render water for all non-hull tiles
    const waterMargin = 6;
    for (let y = -waterMargin; y < this.MAP_H + waterMargin; y++)
      for (let x = -waterMargin; x < this.MAP_W + waterMargin; x++) {
        const inHull = y >= 0 && y < this.MAP_H && x >= 0 && x < this.MAP_W && hullExpanded[y][x];
        if (!inHull) {
          const { x: sx, y: sy } = tileToScreen(x, y, ox, oy);
          this.add.image(sx, sy, 'tile_water').setDepth(isoDepth(x, y) - 1);
        }
      }

    // Render room floor tiles
    for (const room of Object.values(this.rooms)) {
      for (let ry = 0; ry < room.h; ry++)
        for (let rx = 0; rx < room.w; rx++) {
          const { x, y } = tileToScreen(room.x+rx, room.y+ry, ox, oy);
          this.add.image(x, y, room.floor).setDepth(isoDepth(room.x+rx, room.y+ry) - 0.5);
        }

      // Room name label
      const rcx = room.x + room.w / 2;
      const rcy = room.y + 1;
      const { x: lx, y: ly } = tileToScreen(rcx, rcy, ox, oy);
      this.add.text(lx, ly, room.name, {
        fontFamily: '"Playfair Display", serif', fontSize: '11px', color: '#c9a84c',
        backgroundColor: '#0a0a0acc', padding: { x: 4, y: 2 }
      }).setOrigin(0.5).setDepth(isoDepth(rcx, rcy) + 5);
    }
    // Floor under doorways
    for (const d of this.doors)
      for (let dy = 0; dy < d.h; dy++)
        for (let dx = 0; dx < d.w; dx++) {
          const { x, y } = tileToScreen(d.x+dx, d.y+dy, ox, oy);
          this.add.image(x, y, 'tile_metal').setDepth(isoDepth(d.x+dx, d.y+dy) - 0.5);
        }
  }

  _buildWalls(T) {
    const ox = this._isoOffsetX, oy = this._isoOffsetY;
    // Passability grid (true = blocked)
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
        // Only render visible walls (adjacent to passable)
        const visible = neighbors(x,y).some(([nx,ny]) =>
          nx>=0&&nx<this.MAP_W&&ny>=0&&ny<this.MAP_H&&!grid[ny][nx]);
        if (visible) {
          const { x: sx, y: sy } = tileToScreen(x, y, ox, oy);
          this.add.image(sx, sy, 'tile_wall')
            .setDepth(isoDepth(x, y) + 0.5)
            .setOrigin(0.5, 0.67);
        }
        // Physics body in world space
        const b = this.add.rectangle(x*T+T/2, y*T+T/2, T, T).setVisible(false);
        this.physics.add.existing(b, true);
        this.wallGroup.add(b);
      }
  }

  _placeFurniture(T) {
    const ox = this._isoOffsetX, oy = this._isoOffsetY;
    const defs = [
      // Bridge
      {x:18,y:4,k:'furn_console'},{x:18,y:7,k:'furn_console'},
      // Observation deck
      {x:17,y:11,k:'furn_ship_table'},{x:23,y:11,k:'furn_bookshelf'},
      // Library
      {x:11,y:18,k:'furn_bookshelf'},{x:11,y:20,k:'furn_bookshelf'},{x:15,y:18,k:'furn_bookshelf'},
      // Penthouse
      {x:25,y:18,k:'furn_ship_bed'},{x:29,y:18,k:'furn_ship_desk'},
      // Grand Lounge
      {x:18,y:25,k:'furn_bar'},{x:12,y:27,k:'furn_ship_table'},{x:26,y:27,k:'furn_ship_table'},
      // Casino
      {x:8,y:32,k:'furn_slot_machine'},{x:11,y:32,k:'furn_slot_machine'},{x:14,y:32,k:'furn_slot_machine'},{x:12,y:35,k:'furn_bar'},
      // Restaurant
      {x:24,y:32,k:'furn_ship_table'},{x:28,y:32,k:'furn_ship_table'},{x:26,y:35,k:'furn_ship_table'},
      // Kitchen
      {x:10,y:39,k:'furn_stove'},{x:10,y:42,k:'furn_stove'},
      // Pool deck
      {x:27,y:40,k:'furn_pool'},
      // Staff quarters
      {x:10,y:46,k:'furn_locker'},{x:13,y:46,k:'furn_locker'},{x:15,y:48,k:'furn_ship_bed'},
      // Medical bay
      {x:14,y:46,k:'furn_medical_bed'},{x:17,y:46,k:'furn_medical_bed'},{x:16,y:49,k:'furn_ship_desk'},
      // Security office
      {x:22,y:46,k:'furn_console'},{x:25,y:46,k:'furn_ship_desk'},
    ];
    for (const f of defs) {
      const { x, y } = tileToScreen(f.x, f.y, ox, oy);
      const img = this.add.image(x, y, f.k)
        .setDepth(isoDepth(f.x, f.y) + 0.3)
        .setOrigin(0.5, 0.75);
      // Physics body in world space
      const body = this.add.rectangle(f.x*T+T/2, f.y*T+T/2, T, T).setVisible(false);
      this.physics.add.existing(body, true);
      this.furnitureGroup.add(body);
    }
  }

  _placeNPCs(T) {
    const ox = this._isoOffsetX, oy = this._isoOffsetY;
    this._npcIsoSprites = {};
    const defs = [
      { id:'vasquez',    key:'npc_vasquez',    name:'Dr. Vasquez',        x:16, y:47 },
      { id:'harrington', key:'npc_harrington', name:'Capt. Harrington',   x:19, y:5  },
      { id:'isabelle',   key:'npc_isabelle',   name:'Isabelle Thorne',    x:20, y:26 },
      { id:'volkov',     key:'npc_volkov',     name:'Nikolai Volkov',     x:26, y:33 },
      { id:'diego',      key:'npc_diego',      name:'Diego Reyes',        x:27, y:41 },
      { id:'lydia',      key:'npc_lydia',      name:'Lydia Chen',         x:10, y:33 },
      { id:'wells',      key:'npc_wells',      name:'Rep. Wells',         x:12, y:19 },
      { id:'sofia',      key:'npc_sofia',      name:'Sofia Andersson',    x:12, y:47 },
      { id:'romano',     key:'npc_romano',     name:'Chef Romano',        x:12, y:40 },
      { id:'okafor',     key:'npc_okafor',     name:'Chief Okafor',       x:24, y:47 },
      { id:'yuki',       key:'npc_yuki',       name:'Yuki Tanaka',        x:20, y:12 },
    ];
    for (const n of defs) {
      // Physics sprite (invisible, world space)
      const sprite = this.physics.add.sprite(n.x*T+T/2, n.y*T+T/2, n.key).setVisible(false);
      sprite.body.setSize(28, 28);
      sprite.setCollideWorldBounds(true);
      sprite.setPushable(false);
      sprite.setData('id', n.id);
      sprite.setData('name', n.name);

      // Visual iso sprite
      const { x: ix, y: iy } = tileToScreen(n.x, n.y, ox, oy);
      const isoSprite = this.add.sprite(ix, iy, n.key)
        .setDepth(isoDepth(n.x, n.y) + 0.4)
        .setOrigin(0.5, 0.85);
      this._npcIsoSprites[n.id] = isoSprite;

      // Name label with background
      const labelText = '\u{1F610} ' + n.name;
      const label = this.add.text(0, 0, labelText, {
        fontFamily: '"Playfair Display", serif', fontSize: '9px', color: '#e8dcc8',
      }).setOrigin(0.5).setDepth(isoDepth(n.x, n.y) + 10.1);
      const bg = this.add.graphics().setDepth(isoDepth(n.x, n.y) + 10);
      const pad = { x: 7, y: 3 };
      bg.fillStyle(0x111111, 0.85);
      bg.fillRoundedRect(-label.width / 2 - pad.x, -label.height / 2 - pad.y,
        label.width + pad.x * 2, label.height + pad.y * 2, 6);
      bg.setPosition(ix, iy - 10);
      label.setPosition(ix, iy - 10);
      this.npcLabels[n.id] = label;
      if (!this._npcLabelBgs) this._npcLabelBgs = {};
      this._npcLabelBgs[n.id] = bg;

      this.tweens.add({
        targets: isoSprite, scaleY:{from:1,to:1.03},
        duration:2000, yoyo:true, repeat:-1, ease:'Sine.easeInOut'
      });
      this.npcs[n.id] = sprite;
    }

    // Colliders
    const npcList = Object.values(this.npcs);
    for (let i = 0; i < npcList.length; i++)
      for (let j = i + 1; j < npcList.length; j++)
        this.physics.add.collider(npcList[i], npcList[j]);
    for (const sprite of npcList) {
      this.physics.add.collider(sprite, this.wallGroup);
      this.physics.add.collider(sprite, this.furnitureGroup);
    }
  }

  _placeCrimeScene(T) {
    const ox = this._isoOffsetX, oy = this._isoOffsetY;
    const room = this.rooms.penthouse;
    const cx = room.x + Math.floor(room.w / 2);
    const cy = room.y + Math.floor(room.h / 2);
    this._crimeSceneRoom = 'Penthouse Suite';

    const { x: sx, y: sy } = tileToScreen(cx, cy, ox, oy);
    this.add.image(sx, sy, 'crime_body_outline').setDepth(isoDepth(cx, cy) + 0.15).setAlpha(0.85);

    const { x: b1x, y: b1y } = tileToScreen(cx+1, cy, ox, oy);
    this.add.image(b1x, b1y, 'crime_blood_1').setDepth(isoDepth(cx+1, cy) + 0.1).setAlpha(0.7);
    const { x: b2x, y: b2y } = tileToScreen(cx-1, cy+1, ox, oy);
    this.add.image(b2x, b2y, 'crime_blood_2').setDepth(isoDepth(cx-1, cy+1) + 0.1).setAlpha(0.6);

    // Crime tape across penthouse entrance
    const { x: tx, y: ty } = tileToScreen(23, 22, ox, oy);
    this.add.image(tx, ty, 'crime_tape').setDepth(isoDepth(23, 22) + 0.2).setAlpha(0.8);
    this.add.image(tx, ty + 6, 'crime_tape').setDepth(isoDepth(23, 22) + 0.2).setAlpha(0.8);
  }

  _placeEvidence(T) {
    const ox = this._isoOffsetX, oy = this._isoOffsetY;
    const defs = [
      { id:'insulin_pen',          key:'ev_insulin_pen',          x:26, y:19 },
      { id:'potassium_vial',       key:'ev_potassium_vial',       x:15, y:47 },
      { id:'fake_credentials',     key:'ev_fake_credentials',     x:23, y:47 },
      { id:'deck7_footage',        key:'ev_deck7_footage',        x:25, y:49 },
      { id:'medical_bag',          key:'ev_medical_bag',          x:18, y:48 },
      { id:'prenup_document',      key:'ev_prenup_document',      x:28, y:19 },
      { id:'love_notes',           key:'ev_love_notes',           x:13, y:34 },
      { id:'volkov_ledger',        key:'ev_volkov_ledger',        x:27, y:34 },
      { id:'wells_meeting_note',   key:'ev_wells_meeting_note',   x:13, y:19 },
      { id:'master_keycard_log',   key:'ev_master_keycard_log',   x:11, y:48 },
      { id:'harassment_complaint', key:'ev_harassment_complaint',  x:14, y:49 },
      { id:'yukis_photos',         key:'ev_yukis_photos',         x:22, y:12 },
      { id:'broken_camera_report', key:'ev_broken_camera_report', x:24, y:48 },
      { id:'romano_herb_list',     key:'ev_romano_herb_list',     x:11, y:41 },
    ];
    for (const e of defs) {
      const { x: ix, y: iy } = tileToScreen(e.x, e.y, ox, oy);
      const glow = this.add.image(ix, iy, 'ev_glow')
        .setDepth(isoDepth(e.x, e.y) + 0.35).setAlpha(0.7).setScale(1.5);
      this.tweens.add({
        targets:glow, alpha:{from:0.4,to:1.0}, scale:{from:1.3,to:1.8},
        duration:1200, yoyo:true, repeat:-1, ease:'Sine.easeInOut'
      });
      const evSprite = this.add.image(ix, iy, e.key)
        .setDepth(isoDepth(e.x, e.y) + 0.36).setScale(1.5)
        .setOrigin(0.5, 0.75);
      // Physics body in world space
      const physBody = this.physics.add.sprite(e.x*T+T/2, e.y*T+T/2, e.key)
        .setImmovable(true).setVisible(false);
      physBody.body.setSize(20, 20);
      physBody.setData('id', e.id);
      this.evidenceItems[e.id] = { sprite: physBody, isoSprite: evSprite, glow, collected: false, tileX: e.x, tileY: e.y };
    }
  }

  _setupPlayer(T) {
    // Physics body (invisible, world space)
    this.player = this.physics.add.sprite(20*T+T/2, 26*T+T/2, 'player_down_0').setVisible(false);
    this.player.body.setSize(14, 14).setOffset(9, 16);
    this.player.setCollideWorldBounds(true);
    this.physics.world.setBounds(0, 0, this.MAP_W * T, this.MAP_H * T);
    this.physics.add.collider(this.player, this.wallGroup);
    this.physics.add.collider(this.player, this.furnitureGroup);
    Object.values(this.npcs).forEach(s => this.physics.add.collider(this.player, s));

    // Visual iso sprite
    const ox = this._isoOffsetX, oy = this._isoOffsetY;
    const { x: ix, y: iy } = tileToScreen(20, 26, ox, oy);
    this._playerIso = this.add.sprite(ix, iy, 'player_down_0')
      .setDepth(isoDepth(20, 26) + 0.4)
      .setOrigin(0.5, 0.85);
  }

  _setupCamera(T) {
    // Camera follows the iso visual sprite
    this.cameras.main.startFollow(this._playerIso, true, 0.08, 0.08);
    this.cameras.main.setBounds(0, 0, this._isoMapW, this._isoMapH);
    this.cameras.main.setBackgroundColor('#0a0a0a');
    this.cameras.main.setZoom(1.5);
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

    // Toggle Phaser keyboard capture so HTML inputs work normally
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

    // Day/night timer
    if (!this.transitioning && !this.isNight) {
      this.dayTimer += this.game.loop.delta;
      const progress = Math.min(this.dayTimer / this.DAY_DURATION, 1);

      // Update timer bar and clock
      this._updateClock(progress);

      // Gradual dusk effect in last 20% of day
      if (progress > 0.8) {
        const duskProgress = (progress - 0.8) / 0.2;
        this.nightOverlay.setAlpha(duskProgress * 0.3);
      }

      // Day ends
      if (progress >= 1) {
        this._triggerNight();
      }
    }

    this._handleMovement();
    this._syncIsoPositions();
    updateNPCMovement(this, this.game.loop.delta);
    syncEmotionPositions(this.npcs, this.npcLabels);
    updateTimedEvent(this, this.game.loop.delta);
    checkTimedEventTrigger(this);
    updateChase(this, this.game.loop.delta);
    updateLighting(this);
    this._handleInteractions();
    this._checkProximityBubbles();
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
    if (vx||vy) this._playerIso.anims?.play?.('walk-'+this.facing, true) || this._playerIso.setTexture('player_'+this.facing+'_0');
    else this._playerIso.anims?.play?.('idle-'+this.facing, true) || this._playerIso.setTexture('player_'+this.facing+'_0');
  }

  /** Sync all iso visual sprites to match their physics body world positions */
  _syncIsoPositions() {
    const T = this.T;
    const ox = this._isoOffsetX, oy = this._isoOffsetY;

    // Player
    if (this.player && this._playerIso) {
      const tx = this.player.x / T;
      const ty = this.player.y / T;
      const { x, y } = tileToScreen(tx, ty, ox, oy);
      this._playerIso.setPosition(x, y);
      this._playerIso.setDepth(isoDepth(tx, ty) + 0.4);
    }

    // NPCs — sync iso sprites + labels from physics sprites
    for (const [id, physSprite] of Object.entries(this.npcs)) {
      const isoSprite = this._npcIsoSprites?.[id];
      if (!isoSprite || !physSprite) continue;
      const tx = physSprite.x / T;
      const ty = physSprite.y / T;
      const { x, y } = tileToScreen(tx, ty, ox, oy);
      isoSprite.setPosition(x, y);
      isoSprite.setDepth(isoDepth(tx, ty) + 0.4);

      // Update NPC facing based on velocity
      const vx = physSprite.body?.velocity?.x || 0;
      const vy = physSprite.body?.velocity?.y || 0;
      if (!this._npcFacing) this._npcFacing = {};
      if (Math.abs(vx) > 2 || Math.abs(vy) > 2) {
        let dir = 'down';
        if (Math.abs(vx) > Math.abs(vy)) dir = vx > 0 ? 'right' : 'left';
        else dir = vy > 0 ? 'down' : 'up';
        this._npcFacing[id] = dir;
      }

      // Label + bg follow iso sprite
      const label = this.npcLabels[id];
      if (label) {
        label.setPosition(x, y - 10);
        label.setDepth(isoDepth(tx, ty) + 10.1);
      }
      const bg = this._npcLabelBgs?.[id];
      if (bg) {
        bg.setPosition(x, y - 10);
        bg.setDepth(isoDepth(tx, ty) + 10);
      }
    }
  }

  _handleInteractions() {
    const range = 60;
    let closest = null, closestDist = range, closestType = null;

    // NPCs — use physics sprite positions for distance
    for (const [id, sprite] of Object.entries(this.npcs)) {
      const d = Phaser.Math.Distance.Between(this.player.x,this.player.y, sprite.x,sprite.y);
      if (d < closestDist) { closest={id,sprite,name:sprite.getData('name')}; closestDist=d; closestType='npc'; }
    }
    // Evidence
    for (const [id, ev] of Object.entries(this.evidenceItems)) {
      if (ev.collected) continue;
      const d = Phaser.Math.Distance.Between(this.player.x,this.player.y, ev.sprite.x,ev.sprite.y);
      if (d < closestDist) { closest={id,sprite:ev.sprite}; closestDist=d; closestType='evidence'; }
    }

    if (closest) {
      // Position the interact prompt at iso coordinates
      const ox2 = this._isoOffsetX, oy2 = this._isoOffsetY;
      const closestTx = closest.sprite.x / this.T;
      const closestTy = closest.sprite.y / this.T;
      const { x: px, y: py } = tileToScreen(closestTx, closestTy, ox2, oy2);
      this.interactPrompt.setPosition(px, py - 36);
      this.interactPrompt.setDepth(isoDepth(closestTx, closestTy) + 20);
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

  _checkProximityBubbles() {
    const BUBBLE_RANGE = 90;
    const COOLDOWN = 60000;
    const DISPLAY_TIME = 3000;
    const now = Date.now();
    const T = this.T;

    const PHRASES = {
      neutral: ['...', 'Hmm.', 'Detective.'],
      angry:   ["Haven't you bothered me enough?", 'What now?', 'I have nothing to say.', '*glares*'],
      nervous: ['Oh... you again...', '*fidgets*', 'I-I was just...', 'Please, I...'],
      friendly:['Detective, a moment?', 'I remembered something...', 'Perhaps I can help.', 'Over here...'],
    };

    // Update existing bubbles
    for (const [id, bubble] of Object.entries(this._proxBubbles)) {
      bubble.timer -= this.game.loop.delta;
      if (bubble.timer <= 0) {
        bubble.text.destroy();
        delete this._proxBubbles[id];
      } else {
        const sprite = this.npcs[id];
        if (sprite && !sprite.destroyed) {
          const ox = this._isoOffsetX, oy = this._isoOffsetY;
          const tx = sprite.x / T, ty = sprite.y / T;
          const { x: bx, y: by } = tileToScreen(tx, ty, ox, oy);
          bubble.text.setPosition(bx, by - 40);
          bubble.text.setDepth(isoDepth(tx, ty) + 15);
          bubble.text.setAlpha(Math.min(1, bubble.timer / 500));
        }
      }
    }

    // Check NPCs in range for new bubbles
    for (const [id, sprite] of Object.entries(this.npcs)) {
      if (this._proxBubbles[id]) continue;
      if (this._proxCooldowns[id] && now - this._proxCooldowns[id] < COOLDOWN) continue;

      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, sprite.x, sprite.y);
      if (d > BUBBLE_RANGE || d < 40) continue;

      const mood = window._npcMoodVariants?.[id] || 'neutral';
      const pool = PHRASES[mood] || PHRASES.neutral;
      const text = pool[Math.floor(Math.random() * pool.length)];

      const ox = this._isoOffsetX, oy = this._isoOffsetY;
      const bTx = sprite.x / T, bTy = sprite.y / T;
      const { x: bx2, y: by2 } = tileToScreen(bTx, bTy, ox, oy);
      const bubble = this.add.text(bx2, by2 - 40, text, {
        fontFamily: '"Lora", serif', fontSize: '8px', color: '#e8dcc8',
        backgroundColor: 'rgba(10,10,10,0.85)', padding: { x: 5, y: 3 },
        stroke: '#333', strokeThickness: 1,
      }).setOrigin(0.5).setDepth(15).setAlpha(0);

      this.tweens.add({ targets: bubble, alpha: 1, duration: 300 });

      this._proxBubbles[id] = { text: bubble, timer: DISPLAY_TIME };
      this._proxCooldowns[id] = now;
    }
  }

  async _collectEvidence(evidenceId) {
    const ev = this.evidenceItems[evidenceId];
    if (!ev || ev.collected) return;
    try {
      const res = await window.gameAPI.collectEvidence(evidenceId);
      if (res.collected || res.alreadyCollected) {
        ev.collected = true;
        const targets = [ev.glow];
        if (ev.isoSprite) targets.push(ev.isoSprite);
        this.tweens.add({
          targets, y: '-=20', alpha: 0, scale: 0.3,
          duration: 400, ease: 'Power2',
          onComplete: () => {
            ev.sprite.destroy();
            ev.glow.destroy();
            if (ev.isoSprite) ev.isoSprite.destroy();
          }
        });
        if (res.evidence) this._showPopup(res.evidence);
        window.inventoryManager?.refresh();
        // Narrate evidence discovery
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
    let roomName = 'Corridor';
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
        window.gameAPI?.narrate('crime_scene', 'The crime scene. Marcus Thorne was found dead here in his Penthouse Suite. The luxury cabin now bears the grim marks of violence.').then(r => {
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

  _showIntro() {
    const cam = this.cameras.main;
    const w = cam.width, h = cam.height;
    const ov = this.add.rectangle(w/2,h/2,w,h,0x000000,0.95).setScrollFactor(0).setDepth(300);
    const texts = [
      this.add.text(w/2,h/2-70,'DEATH ON THE MERIDIAN',{fontFamily:'"Playfair Display",serif',fontSize:'18px',color:'#c9a84c',fontStyle:'bold'}).setOrigin(0.5),
      this.add.text(w/2,h/2-40,'━━━━━━━━━━━━━━━━━━━━',{fontSize:'10px',color:'#c9a84c33'}).setOrigin(0.5),
      this.add.text(w/2,h/2-10,'Marcus Thorne, tech billionaire, has been found\ndead in his penthouse suite on the MS Meridian.',{fontFamily:'"Lora",serif',fontSize:'11px',color:'#e8dcc8',align:'center'}).setOrigin(0.5),
      this.add.text(w/2,h/2+25,'11 suspects. 14 pieces of evidence.\nExplore the ship. Find the truth.',{fontFamily:'"Lora",serif',fontSize:'10px',color:'#aaa',align:'center'}).setOrigin(0.5),
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
    const ox = this._isoOffsetX, oy = this._isoOffsetY;

    const needW = room.x + room.w + 1;
    const needH = room.y + room.h + 1;
    if (needW > this.MAP_W) this.MAP_W = needW;
    if (needH > this.MAP_H) this.MAP_H = needH;

    this.rooms[room.id] = { name: room.name, x: room.x, y: room.y, w: room.w, h: room.h, floor: room.floor || 'tile_metal' };

    if (room.doorway) {
      this.doors.push(room.doorway);
    }

    const floorKey = this.textures.exists(room.floor) ? room.floor : 'tile_metal';
    for (let ry = 0; ry < room.h; ry++)
      for (let rx = 0; rx < room.w; rx++) {
        const { x, y } = tileToScreen(room.x+rx, room.y+ry, ox, oy);
        this.add.image(x, y, floorKey).setDepth(isoDepth(room.x+rx, room.y+ry) - 0.5);
      }

    const rcx = room.x + room.w / 2, rcy = room.y + 1;
    const { x: lx, y: ly } = tileToScreen(rcx, rcy, ox, oy);
    this.add.text(lx, ly, room.name, {
      fontFamily: '"Playfair Display", serif', fontSize: '11px', color: '#c9a84c',
      backgroundColor: '#0a0a0acc', padding: { x: 4, y: 2 }
    }).setOrigin(0.5).setDepth(isoDepth(rcx, rcy) + 5);

    if (room.doorway) {
      const d = room.doorway;
      for (let dy = 0; dy < d.h; dy++)
        for (let dx = 0; dx < d.w; dx++) {
          const { x, y } = tileToScreen(d.x+dx, d.y+dy, ox, oy);
          this.add.image(x, y, 'tile_metal').setDepth(isoDepth(d.x+dx, d.y+dy) - 0.5);
        }
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
        if (visible) {
          const { x: isx, y: isy } = tileToScreen(x, y, ox, oy);
          this.add.image(isx, isy, 'tile_wall')
            .setDepth(isoDepth(x, y) + 0.5)
            .setOrigin(0.5, 0.67);
        }
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

      const { x: eix, y: eiy } = tileToScreen(ev.x, ev.y, ox, oy);
      const glow = this.add.image(eix, eiy, 'ev_glow')
        .setDepth(isoDepth(ev.x, ev.y) + 0.35).setAlpha(0.7).setScale(1.5);
      this.tweens.add({
        targets: glow, alpha:{from:0.4,to:1.0}, scale:{from:1.3,to:1.8},
        duration:1200, yoyo:true, repeat:-1, ease:'Sine.easeInOut'
      });
      const evSprite = this.add.image(eix, eiy, evKey)
        .setDepth(isoDepth(ev.x, ev.y) + 0.36).setScale(1.5)
        .setOrigin(0.5, 0.75);
      const physBody = this.physics.add.sprite(ev.x*T+T/2, ev.y*T+T/2, evKey)
        .setImmovable(true).setVisible(false);
      physBody.body.setSize(20, 20);
      physBody.setData('id', ev.id);
      this.evidenceItems[ev.id] = { sprite: physBody, isoSprite: evSprite, glow, collected: false, tileX: ev.x, tileY: ev.y };
    }

    // Update iso bounds
    const newBounds = isoMapBounds(this.MAP_W, this.MAP_H);
    this._isoMapW = newBounds.width;
    this._isoMapH = newBounds.height;
    this.cameras.main.setBounds(0, 0, this._isoMapW, this._isoMapH);
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
    const ox = this._isoOffsetX, oy = this._isoOffsetY;

    const texKey = 'npc_' + npc.id;
    if (!this.textures.exists(texKey)) {
      const bodyColor = npc.color || 0x556b2f;
      const g = this.make.graphics({x:0, y:0, add:false});
      g.fillStyle(0xf5d5b8, 1); g.fillCircle(16, 8, 7);
      g.fillStyle(bodyColor, 1); g.fillRect(8, 14, 16, 12);
      g.fillStyle(0x000000, 1); g.fillRect(13, 6, 2, 2); g.fillRect(18, 6, 2, 2);
      g.fillStyle(0x222222, 1); g.fillRect(10, 26, 4, 6); g.fillRect(18, 26, 4, 6);
      g.fillStyle(0xcc3333, 1); g.fillRect(10, 1, 12, 4);
      g.generateTexture(texKey, 32, 32); g.destroy();
    }

    // Physics sprite (invisible, world space)
    const sprite = this.physics.add.sprite(npc.x*T+T/2, npc.y*T+T/2, texKey)
      .setVisible(false).setImmovable(true);
    sprite.body.setSize(28, 28);
    sprite.setData('id', npc.id);
    sprite.setData('name', npc.name);

    // Visual iso sprite
    const { x: ix, y: iy } = tileToScreen(npc.x, npc.y, ox, oy);
    const isoSprite = this.add.sprite(ix, iy, texKey)
      .setDepth(isoDepth(npc.x, npc.y) + 0.4)
      .setOrigin(0.5, 0.85);
    if (!this._npcIsoSprites) this._npcIsoSprites = {};
    this._npcIsoSprites[npc.id] = isoSprite;

    const labelText = '\u{1F610} ' + npc.name;
    const label = this.add.text(0, 0, labelText, {
      fontFamily: '"Playfair Display", serif', fontSize: '9px', color: '#e8dcc8',
    }).setOrigin(0.5).setDepth(isoDepth(npc.x, npc.y) + 10.1);
    const bg = this.add.graphics().setDepth(isoDepth(npc.x, npc.y) + 10);
    const pad = { x: 7, y: 3 };
    bg.fillStyle(0x111111, 0.85);
    bg.fillRoundedRect(-label.width / 2 - pad.x, -label.height / 2 - pad.y,
      label.width + pad.x * 2, label.height + pad.y * 2, 6);
    bg.setPosition(ix, iy - 10);
    label.setPosition(ix, iy - 10);
    this.npcLabels[npc.id] = label;
    if (!this._npcLabelBgs) this._npcLabelBgs = {};
    this._npcLabelBgs[npc.id] = bg;

    this.tweens.add({
      targets: isoSprite, scaleY:{from:1,to:1.03},
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
