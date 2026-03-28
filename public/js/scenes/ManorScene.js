import { createWeatherTextures, createWeather } from '../weather.js';
import { createLighting, updateLighting } from '../lighting.js';

import { initNPCMovement, updateNPCMovement } from '../npcMovement.js';
import { updateTimedEvent, checkTimedEventTrigger, cancelTimedEvent, completeTimedEvent, restoreFledNPCs } from '../timedEvents.js';
import { updateChase, maybeChaseOnWrongAccusation } from '../chase.js';
import { initNPCApproach, updateNPCApproach, isNPCApproaching } from '../npcApproach.js';

/**
 * ManorScene — 2D manor with rooms, NPCs, and evidence.
 * Uses a tile-based layout with collision walls and doorways.
 */
export default class ManorScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ManorScene' });
    this.facing = 'down';
  }

  create() {
    try {
    console.log('ManorScene.create() starting');
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

    // Multi-floor system
    this.currentFloor = 0; // 0 = ground, 1 = upper
    this._floorTransitioning = false;
    this._floorObjects = { 0: [], 1: [] }; // Track objects per floor
    this._floorWalls = { 0: [], 1: [] };   // Track wall physics per floor
    this._floorFurniture = { 0: [], 1: [] }; // Track furniture physics per floor
    this._npcFloors = {}; // Track NPC floor assignments

    // Ground floor room definitions (tile coords)
    this.rooms = {
      main_hall:   { name:'Main Hall',       x:12, y:12, w:12, h:8,  floor:'tile_carpet', floorNum: 0 },
      study:       { name:'Study',           x:1,  y:12, w:10, h:8,  floor:'tile_carpet', floorNum: 0 },
      library:     { name:'Library',         x:25, y:12, w:10, h:8,  floor:'tile_carpet', floorNum: 0 },
      kitchen:     { name:'Kitchen',         x:1,  y:1,  w:10, h:10, floor:'tile_kitchen_floor', floorNum: 0 },
      dining_room: { name:'Dining Room',     x:25, y:1,  w:10, h:10, floor:'tile_floor', floorNum: 0 },
      conservatory:{ name:'Conservatory',    x:1,  y:21, w:10, h:10, floor:'tile_floor', floorNum: 0 },
      bedroom:     { name:"Clara's Bedroom", x:25, y:21, w:10, h:10, floor:'tile_carpet', floorNum: 0 },
      garden:      { name:'Garden',          x:12, y:21, w:12, h:10, floor:'tile_grass', floorNum: 0 },
      foyer:       { name:'Foyer',           x:12, y:1,  w:12, h:10, floor:'tile_floor', floorNum: 0 },
      // Upper floor rooms (reuse same tile coordinate space)
      upper_hall:     { name:'Upper Landing', x:12, y:12, w:12, h:8,  floor:'tile_upper_floor', floorNum: 1 },
      upper_study:    { name:'Lord\'s Study', x:1,  y:12, w:10, h:8,  floor:'tile_carpet', floorNum: 1 },
      upper_bedroom:  { name:'Master Bedroom',x:25, y:21, w:10, h:10, floor:'tile_carpet', floorNum: 1 },
      guest_bedroom:  { name:'Guest Bedroom', x:1,  y:1,  w:10, h:10, floor:'tile_carpet', floorNum: 1 },
      balcony:        { name:'Balcony',       x:12, y:1,  w:12, h:10, floor:'tile_floor', floorNum: 1 },
    };

    // Doorways per floor
    this.doors = {
      0: [
        { x:17, y:10, w:2, h:4 }, // foyer <-> main hall (vertical)
        { x:10, y:15, w:4, h:2 }, // study <-> main hall (horizontal)
        { x:23, y:15, w:4, h:2 }, // main hall <-> library (horizontal)
        { x:10, y:5,  w:4, h:2 }, // kitchen <-> foyer (horizontal)
        { x:23, y:5,  w:4, h:2 }, // foyer <-> dining room (horizontal)
        { x:17, y:19, w:2, h:4 }, // main hall <-> garden (vertical)
        { x:10, y:25, w:4, h:2 }, // conservatory <-> garden (horizontal)
        { x:23, y:25, w:4, h:2 }, // garden <-> bedroom (horizontal)
      ],
      1: [
        { x:17, y:10, w:2, h:4 }, // balcony <-> upper hall (vertical)
        { x:10, y:15, w:4, h:2 }, // upper study <-> upper hall (horizontal)
        { x:23, y:25, w:4, h:2 }, // upper hall area <-> master bedroom (horizontal)
        { x:10, y:5,  w:4, h:2 }, // guest bedroom <-> balcony (horizontal)
      ],
    };

    // Staircase definitions — where stairs are on each floor
    this.stairs = [
      { x: 24, y: 14, w: 2, h: 2, fromFloor: 0, toFloor: 1, exitX: 24, exitY: 14 },
      { x: 24, y: 14, w: 2, h: 2, fromFloor: 1, toFloor: 0, exitX: 24, exitY: 14 },
    ];

    this.MAP_W = 36;
    this.MAP_H = 32;

    // Build both floors
    this._buildFloorLevel(0, T);
    this._buildFloorLevel(1, T);
    this._placeStairs(T);
    this._placeCrimeScene(T);
    this._placeFurniture(T);
    this._placeNPCs(T);
    initNPCMovement(this);
    this._placeEvidence(T);
    this._setupPlayer(T);
    this._setupCamera(T);
    this._setupInput();
    initNPCApproach(this);
    this._createAmbientParticles();

    // Show only ground floor initially
    this._showFloor(0);

    // Weather effects (noir fog by default)
    createWeatherTextures(this);
    createWeather(this, 'fog', this.MAP_W, this.MAP_H, T);

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

    // Night overlay (dark blue tint over everything)
    this.nightOverlay = this.add.rectangle(
      this.MAP_W * T / 2, this.MAP_H * T / 2,
      this.MAP_W * T, this.MAP_H * T,
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
    // Periodic check for hidden room and red herring (every 30s)
    this._midGameCheckTimer = this.time.addEvent({
      delay: 30000, loop: true,
      callback: () => { this._checkHiddenRoom(); this._checkRedHerring(); }
    });

    // Listen for accusation events from main.js
    this._onWrongAccusation = (e) => maybeChaseOnWrongAccusation(this, e.detail.suspectId);
    this._onCorrectAccusation = () => completeTimedEvent(this);
    window.addEventListener('wrong-accusation', this._onWrongAccusation);
    window.addEventListener('correct-accusation', this._onCorrectAccusation);

    console.log('ManorScene.create() complete');
    } catch(err) {
      console.error('ManorScene.create() CRASHED:', err);
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
      // Sync NPC floor positions
      if (data.npcFloors) {
        for (const [id, floor] of Object.entries(data.npcFloors)) {
          this._npcFloors[id] = floor;
          if (this.npcs[id]) this.npcs[id].setData('floor', floor);
        }
      }

      // Sync player floor position from server state, if provided
      if (typeof data.playerFloor === 'number') {
        this.currentFloor = data.playerFloor;
        if (this.player) {
          this.player.setData('floor', this.currentFloor);
        }
      }

      // Ensure the correct floor is shown based on currentFloor
      this._showFloor(this.currentFloor);
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

    // Use HTML overlay for night sequences (avoids Phaser zoom issues)
    const overlay = document.getElementById('night-overlay');
    const titleEl = document.getElementById('night-title');
    const subtitleEl = document.getElementById('night-subtitle');
    const convoEl = document.getElementById('night-conversation');
    const promptEl = document.getElementById('night-prompt');

    // Show loading state
    titleEl.textContent = '\u{1F319} Night Falls Over Blackwood Manor';
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
    let nightResult;
    try {
      nightResult = await window.gameAPI.advanceDay();
    } catch(err) { console.error('Night advance failed:', err); }

    clearInterval(dotInterval);

    // Show each conversation one at a time
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

    // Reposition NPCs — offset any that would overlap, update floor tracking
    const usedPositions = [];
    for (const npcPos of dayConfig.npcPositions) {
      const sprite = this.npcs[npcPos.id];
      if (!sprite) continue;

      // Update NPC floor
      const npcFloor = npcPos.floor ?? 0;
      this._npcFloors[npcPos.id] = npcFloor;
      sprite.setData('floor', npcFloor);

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
        label.setPosition(newX, ny * T - 8);
      }
    }

    // Refresh floor visibility after NPC repositioning
    this._showFloor(this.currentFloor);

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
        const evFloor = pos.floor ?? 0;
        const glow = this.add.image(pos.x*T+T/2, pos.y*T+T/2, 'ev_glow').setDepth(8).setAlpha(0.7).setScale(1.5);
        this.tweens.add({
          targets: glow, alpha:{from:0.4,to:1.0}, scale:{from:1.3,to:1.8},
          duration:1200, yoyo:true, repeat:-1, ease:'Sine.easeInOut'
        });

        const texKey = 'ev_' + pos.id;
        const spriteKey = this.textures.exists(texKey) ? texKey : 'ev_glow';
        const sprite = this.physics.add.sprite(pos.x*T+T/2, pos.y*T+T/2, spriteKey)
          .setDepth(9).setImmovable(true).setScale(1.5);
        sprite.body.setSize(20, 20);
        sprite.setData('id', pos.id);
        sprite.setData('floor', evFloor);
        this.evidenceItems[pos.id] = { sprite, glow, collected: false, floor: evFloor };
      }

      // Refresh floor visibility after evidence update
      this._showFloor(this.currentFloor);
    } catch (err) {
      console.warn('Failed to update evidence positions:', err);
    }

    window.inventoryManager?.refresh();
  }

  // ── BUILD ──────────────────────────────────────────────────

  _buildFloorLevel(floorNum, T) {
    const floorRooms = Object.values(this.rooms).filter(r => r.floorNum === floorNum);
    const floorDoors = this.doors[floorNum] || [];

    // Build floor tiles
    for (const room of floorRooms) {
      for (let ry = 0; ry < room.h; ry++)
        for (let rx = 0; rx < room.w; rx++) {
          const img = this.add.image((room.x+rx)*T+T/2, (room.y+ry)*T+T/2, room.floor).setDepth(0);
          this._floorObjects[floorNum].push(img);
        }

      // Room name label
      const label = this.add.text((room.x+room.w/2)*T, (room.y+1)*T, room.name, {
        fontFamily: '"Playfair Display", serif', fontSize: '11px', color: '#c9a84c55'
      }).setOrigin(0.5).setDepth(1);
      this._floorObjects[floorNum].push(label);
    }

    // Floor under doorways
    for (const d of floorDoors)
      for (let dy=0; dy<d.h; dy++)
        for (let dx=0; dx<d.w; dx++) {
          const img = this.add.image((d.x+dx)*T+T/2, (d.y+dy)*T+T/2, 'tile_floor').setDepth(0);
          this._floorObjects[floorNum].push(img);
        }

    // Build walls
    const grid = Array.from({length:this.MAP_H}, () => Array(this.MAP_W).fill(true));
    for (const r of floorRooms)
      for (let ry=1; ry<r.h-1; ry++)
        for (let rx=1; rx<r.w-1; rx++)
          grid[r.y+ry][r.x+rx] = false;
    for (const d of floorDoors)
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
          const wallImg = this.add.image(x*T+T/2, y*T+T/2, 'tile_wall').setDepth(0);
          this._floorObjects[floorNum].push(wallImg);
        }
        // Physics body for all wall cells
        const b = this.add.rectangle(x*T+T/2, y*T+T/2, T, T).setVisible(false);
        this.physics.add.existing(b, true);
        this._floorWalls[floorNum].push(b);
        this.wallGroup.add(b);
      }
  }

  _placeStairs(T) {
    this.stairZones = [];
    for (const stair of this.stairs) {
      // Place stair tile images
      const texKey = stair.toFloor > stair.fromFloor ? 'tile_stairs' : 'tile_stairs_down';
      for (let sy = 0; sy < stair.h; sy++)
        for (let sx = 0; sx < stair.w; sx++) {
          const img = this.add.image((stair.x+sx)*T+T/2, (stair.y+sy)*T+T/2, texKey).setDepth(1);
          this._floorObjects[stair.fromFloor].push(img);
        }

      // Create a trigger zone for the stair area
      const zone = this.add.zone(
        (stair.x + stair.w / 2) * T,
        (stair.y + stair.h / 2) * T,
        stair.w * T,
        stair.h * T
      );
      zone.setData('fromFloor', stair.fromFloor);
      zone.setData('toFloor', stair.toFloor);
      zone.setData('exitX', stair.exitX);
      zone.setData('exitY', stair.exitY);
      this.stairZones.push(zone);
    }
  }

  _showFloor(floorNum) {
    // Show objects for the target floor, hide objects for other floors
    for (const [fNum, objects] of Object.entries(this._floorObjects)) {
      const show = parseInt(fNum) === floorNum;
      for (const obj of objects) {
        if (obj && !obj.destroyed) obj.setVisible(show);
      }
    }

    // Enable/disable wall physics per floor
    for (const [fNum, walls] of Object.entries(this._floorWalls)) {
      const enable = parseInt(fNum) === floorNum;
      for (const wall of walls) {
        if (wall && wall.body && !wall.destroyed) {
          wall.body.enable = enable;
        }
      }
    }

    // Enable/disable furniture physics per floor
    for (const [fNum, furniture] of Object.entries(this._floorFurniture)) {
      const enable = parseInt(fNum) === floorNum;
      for (const body of furniture) {
        if (body && body.body && !body.destroyed) {
          body.body.enable = enable;
        }
      }
    }

    // Show/hide NPCs based on their floor
    for (const [id, sprite] of Object.entries(this.npcs)) {
      const npcFloor = this._npcFloors[id] ?? 0;
      const show = npcFloor === floorNum;
      sprite.setVisible(show);
      if (sprite.body) sprite.body.enable = show;
      if (this.npcLabels[id]) this.npcLabels[id].setVisible(show);
    }

    // Show/hide evidence based on their floor
    for (const [id, ev] of Object.entries(this.evidenceItems)) {
      if (ev.collected) continue;
      const evFloor = ev.floor ?? 0;
      const show = evFloor === floorNum;
      if (ev.sprite && !ev.sprite.destroyed) {
        ev.sprite.setVisible(show);
        if (ev.sprite.body) ev.sprite.body.enable = show;
      }
      if (ev.glow && !ev.glow.destroyed) ev.glow.setVisible(show);
    }

    // Update floor indicator in HUD
    this._updateFloorIndicator(floorNum);
  }

  async _switchFloor(toFloor) {
    if (this._floorTransitioning || toFloor === this.currentFloor) return;
    this._floorTransitioning = true;

    const T = this.T;
    const cam = this.cameras.main;

    // Create fade overlay
    const fadeRect = this.add.rectangle(
      cam.scrollX + cam.width / 2,
      cam.scrollY + cam.height / 2,
      cam.width * 2,
      cam.height * 2,
      0x000000, 0
    ).setScrollFactor(0).setDepth(500);

    // Fade to black
    await new Promise(resolve => {
      this.tweens.add({
        targets: fadeRect, alpha: 1, duration: 400, ease: 'Power2',
        onComplete: resolve
      });
    });

    // Switch floor
    this.currentFloor = toFloor;
    this._showFloor(toFloor);

    // Notify server of floor change
    window.gameAPI?.setFloor(toFloor).catch(() => {});

    // Show floor transition text
    const floorName = toFloor === 0 ? 'Ground Floor' : toFloor === 1 ? 'Upper Floor' : 'Basement';
    const transText = this.add.text(
      cam.width / 2, cam.height / 2,
      '↕ ' + floorName,
      { fontFamily: '"Playfair Display", serif', fontSize: '16px', color: '#c9a84c',
        stroke: '#0a0a0a', strokeThickness: 3 }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(501).setAlpha(1);

    await new Promise(r => this.time.delayedCall(500, r));

    // Fade from black
    await new Promise(resolve => {
      this.tweens.add({
        targets: fadeRect, alpha: 0, duration: 400, ease: 'Power2',
        onComplete: resolve
      });
    });

    // Fade out transition text
    this.tweens.add({
      targets: transText, alpha: 0, duration: 600,
      onComplete: () => { transText.destroy(); fadeRect.destroy(); }
    });

    this._floorTransitioning = false;
  }

  _updateFloorIndicator(floorNum) {
    const el = document.getElementById('hud-floor-indicator');
    if (!el) return;
    const labels = { '-1': 'Basement', '0': 'Ground Floor', '1': 'Upper Floor' };
    el.textContent = '🏠 ' + (labels[floorNum] ?? `Floor ${floorNum}`);
    el.title = labels[floorNum] ?? `Floor ${floorNum}`;
  }

  _placeFurniture(T) {
    const defs = [
      // Study (ground floor)
      {x:4,y:14,k:'furn_desk',f:0},{x:8,y:13,k:'furn_bookshelf',f:0},{x:6,y:18,k:'furn_fireplace',f:0},
      // Library (ground floor)
      {x:28,y:13,k:'furn_bookshelf',f:0},{x:28,y:15,k:'furn_bookshelf',f:0},{x:32,y:13,k:'furn_bookshelf',f:0},{x:32,y:17,k:'furn_table',f:0},
      // Kitchen (ground floor)
      {x:4,y:3,k:'furn_stove',f:0},{x:4,y:6,k:'furn_table',f:0},
      // Dining Room (ground floor)
      {x:30,y:5,k:'furn_table',f:0},
      // Conservatory (ground floor)
      {x:4,y:23,k:'furn_plant',f:0},{x:7,y:23,k:'furn_plant',f:0},{x:4,y:27,k:'furn_plant',f:0},{x:8,y:26,k:'furn_plant',f:0},
      // Clara's Bedroom (ground floor)
      {x:28,y:23,k:'furn_bed',f:0},{x:32,y:23,k:'furn_desk',f:0},
      // Foyer (ground floor)
      {x:17,y:5,k:'furn_table',f:0},{x:15,y:3,k:'furn_plant',f:0},{x:20,y:3,k:'furn_plant',f:0},
      // Main Hall (ground floor)
      {x:17,y:14,k:'furn_fireplace',f:0},

      // Upper floor furniture
      // Upper Study
      {x:4,y:14,k:'furn_desk',f:1},{x:8,y:13,k:'furn_bookshelf',f:1},
      // Master Bedroom (upper floor)
      {x:28,y:23,k:'furn_bed',f:1},{x:32,y:23,k:'furn_desk',f:1},
      // Guest Bedroom (upper floor)
      {x:4,y:3,k:'furn_bed',f:1},{x:4,y:6,k:'furn_desk',f:1},
      // Upper Landing
      {x:17,y:14,k:'furn_table',f:1},{x:15,y:14,k:'furn_plant',f:1},
      // Balcony
      {x:15,y:3,k:'furn_plant',f:1},{x:20,y:3,k:'furn_plant',f:1},{x:17,y:5,k:'furn_plant',f:1},
    ];
    for (const f of defs) {
      const floorNum = f.f ?? 0;
      const img = this.add.image(f.x*T+T/2, f.y*T+T/2, f.k).setDepth(2);
      const body = this.add.rectangle(f.x*T+T/2, f.y*T+T/2, img.width, img.height).setVisible(false);
      this.physics.add.existing(body, true);
      this.furnitureGroup.add(body);
      this._floorObjects[floorNum].push(img);
      this._floorFurniture[floorNum].push(body);
    }
  }

  _placeNPCs(T) {
    const defs = [
      { id:'victoria', key:'npc_victoria', name:'Lady Victoria',  x:6,  y:25, floor:0 },
      { id:'hartwell', key:'npc_hartwell', name:'Dr. Hartwell',   x:30, y:16, floor:0 },
      { id:'clara',    key:'npc_clara',    name:'Clara Blackwood', x:30, y:26, floor:1 },
      { id:'price',    key:'npc_price',    name:'Mr. Price',      x:30, y:4,  floor:0 },
      { id:'agnes',    key:'npc_agnes',    name:'Mrs. Whitfield', x:6,  y:5,  floor:0 },
    ];
    for (const n of defs) {
      const sprite = this.physics.add.sprite(n.x*T+T/2, n.y*T+T/2, n.key)
        .setDepth(5);
      sprite.body.setSize(28, 28);
      sprite.setCollideWorldBounds(true);
      sprite.setPushable(false);
      sprite.setData('id', n.id);
      sprite.setData('name', n.name);
      sprite.setData('floor', n.floor);

      const label = this.add.text(n.x*T+T/2, n.y*T-8, n.name, {
        fontFamily: '"Playfair Display", serif', fontSize: '9px', color: '#c9a84c',
        stroke: '#0a0a0a', strokeThickness: 2
      }).setOrigin(0.5).setDepth(10);
      this.npcLabels[n.id] = label;

      this.tweens.add({
        targets: sprite, scaleY:{from:1,to:1.03},
        duration:2000, yoyo:true, repeat:-1, ease:'Sine.easeInOut'
      });
      this.npcs[n.id] = sprite;
      this._npcFloors[n.id] = n.floor;
    }

    // Add NPC-to-NPC colliders so they never overlap
    const npcList = Object.values(this.npcs);
    for (let i = 0; i < npcList.length; i++) {
      for (let j = i + 1; j < npcList.length; j++) {
        this.physics.add.collider(npcList[i], npcList[j]);
      }
    }
    // NPC-to-wall colliders so NPCs stay inside rooms
    for (const sprite of npcList) {
      this.physics.add.collider(sprite, this.wallGroup);
      this.physics.add.collider(sprite, this.furnitureGroup);
    }
  }

  _placeCrimeScene(T) {
    const room = this.rooms.study;
    const cx = (room.x + Math.floor(room.w / 2)) * T + T / 2;
    const cy = (room.y + Math.floor(room.h / 2)) * T + T / 2;
    this._crimeSceneRoom = 'Study';

    // Body outline in center of study
    const body = this.add.image(cx, cy, 'crime_body_outline').setDepth(2).setAlpha(0.85);
    this._floorObjects[0].push(body);

    // Blood splatters near the body
    const b1 = this.add.image(cx + T, cy - T * 0.5, 'crime_blood_1').setDepth(2).setAlpha(0.7);
    const b2 = this.add.image(cx - T * 0.8, cy + T * 0.6, 'crime_blood_2').setDepth(2).setAlpha(0.6);
    const b3 = this.add.image(cx + T * 1.5, cy + T, 'crime_blood_1').setDepth(2).setAlpha(0.5);
    this._floorObjects[0].push(b1, b2, b3);

    // Crime tape across the study entrance (doorway at x:10, y:15)
    const doorX = 10 * T + T;
    const doorY = 15 * T + T / 2;
    const t1 = this.add.image(doorX, doorY, 'crime_tape').setDepth(2).setAlpha(0.8);
    const t2 = this.add.image(doorX, doorY + 8, 'crime_tape').setDepth(2).setAlpha(0.8);
    this._floorObjects[0].push(t1, t2);
  }

  _placeEvidence(T) {
    const defs = [
      { id:'brandy_glass',       key:'ev_brandy_glass',       x:5,  y:14, floor:0 },
      { id:'prescription_pad',   key:'ev_prescription_pad',   x:32, y:15, floor:0 },
      { id:'foxglove_cuttings',  key:'ev_foxglove_cuttings',  x:16, y:26, floor:0 },
      { id:'edmunds_letter',     key:'ev_edmunds_letter',     x:4,  y:15, floor:0 },
      { id:'love_letter',        key:'ev_love_letter',        x:7,  y:24, floor:0 },
      { id:'business_documents', key:'ev_business_documents', x:3,  y:14, floor:0 },
      { id:'agnes_diary',        key:'ev_agnes_diary',        x:5,  y:7,  floor:0 },
      { id:'claras_manuscript',  key:'ev_claras_manuscript',  x:31, y:27, floor:1 },
    ];
    for (const e of defs) {
      const glow = this.add.image(e.x*T+T/2, e.y*T+T/2, 'ev_glow').setDepth(8).setAlpha(0.7).setScale(1.5);
      this.tweens.add({
        targets:glow, alpha:{from:0.4,to:1.0}, scale:{from:1.3,to:1.8},
        duration:1200, yoyo:true, repeat:-1, ease:'Sine.easeInOut'
      });
      const sprite = this.physics.add.sprite(e.x*T+T/2, e.y*T+T/2, e.key)
        .setDepth(9).setImmovable(true).setScale(1.5);
      sprite.body.setSize(20,20);
      sprite.setData('id', e.id);
      sprite.setData('floor', e.floor);
      this.evidenceItems[e.id] = { sprite, glow, collected:false, floor: e.floor };
    }
  }

  _setupPlayer(T) {
    this.player = this.physics.add.sprite(18*T+T/2, 16*T+T/2, 'player_down_0').setDepth(6);
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
    // Use direct DOM listener for E key — Phaser's addKey is unreliable for this
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
    updateNPCMovement(this, this.game.loop.delta);
    updateTimedEvent(this, this.game.loop.delta);
    checkTimedEventTrigger(this);
    updateChase(this, this.game.loop.delta);
    updateLighting(this);
    this._handleInteractions();
    this._checkStairs();
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

    // NPCs — only interact with NPCs on the current floor
    for (const [id, sprite] of Object.entries(this.npcs)) {
      if ((this._npcFloors[id] ?? 0) !== this.currentFloor) continue;
      const d = Phaser.Math.Distance.Between(this.player.x,this.player.y, sprite.x,sprite.y);
      if (d < closestDist) { closest={id,sprite,name:sprite.getData('name')}; closestDist=d; closestType='npc'; }
    }
    // Evidence — only interact with evidence on the current floor
    const evEntries = Object.entries(this.evidenceItems);
    for (const [id, ev] of evEntries) {
      if (ev.collected) continue;
      if ((ev.floor ?? 0) !== this.currentFloor) continue;
      const d = Phaser.Math.Distance.Between(this.player.x,this.player.y, ev.sprite.x,ev.sprite.y);
      if (d < closestDist) { closest={id,sprite:ev.sprite}; closestDist=d; closestType='evidence'; }
    }

    // Debug: log every 60 frames when near anything
    if (!this._dbgFrame) this._dbgFrame = 0;
    this._dbgFrame++;
    if (this._dbgFrame % 120 === 0 && evEntries.length > 0) {
      const nearestEv = evEntries.reduce((best, [id, ev]) => {
        if (ev.collected) return best;
        const d = Phaser.Math.Distance.Between(this.player.x,this.player.y, ev.sprite.x,ev.sprite.y);
        return (!best || d < best.d) ? {id, d, x: ev.sprite.x, y: ev.sprite.y} : best;
      }, null);
      if (nearestEv) {
        console.log(`[Debug] Player(${Math.round(this.player.x)},${Math.round(this.player.y)}) nearestEvidence="${nearestEv.id}" dist=${Math.round(nearestEv.d)} at(${nearestEv.x},${nearestEv.y}) closest=${closestType} items=${evEntries.length}`);
      }
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
        console.log(`[Interact] E pressed → type=${closestType} id=${closest.id} dist=${Math.round(closestDist)}`);
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

  _checkStairs() {
    if (this._floorTransitioning) return;
    if (!this.stairZones) return;

    const px = this.player.x;
    const py = this.player.y;

    for (const zone of this.stairZones) {
      if (zone.getData('fromFloor') !== this.currentFloor) continue;

      const zx = zone.x;
      const zy = zone.y;
      const hw = zone.width / 2;
      const hh = zone.height / 2;

      if (px > zx - hw && px < zx + hw && py > zy - hh && py < zy + hh) {
        const toFloor = zone.getData('toFloor');
        this._switchFloor(toFloor);
        break;
      }
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
    let roomName = this.currentFloor === 0 ? 'Hallway' : 'Upper Hallway';
    for (const room of Object.values(this.rooms)) {
      if (room.floorNum !== this.currentFloor) continue;
      if (px>=room.x && px<room.x+room.w && py>=room.y && py<room.y+room.h) {
        roomName = room.name; break;
      }
    }
    this.roomLabel.setText(roomName);
    if (this._lastRoom !== roomName) {
      this._lastRoom = roomName;
      if (!this._crimeSceneSeen && roomName === this._crimeSceneRoom) {
        this._crimeSceneSeen = true;
        window.gameAPI?.narrate('crime_scene', 'The crime scene. Lord Edmund Blackwood lies here in the Study, struck down during what should have been a quiet evening. The chalk outline and dark stains tell a grim story.').then(r => {
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

  _showIntro() {    const cam = this.cameras.main;
    const w = cam.width, h = cam.height;
    const ov = this.add.rectangle(w/2,h/2,w,h,0x000000,0.95).setScrollFactor(0).setDepth(300);
    const texts = [
      this.add.text(w/2,h/2-70,'SHADOWS OF BLACKWOOD MANOR',{fontFamily:'"Playfair Display",serif',fontSize:'18px',color:'#c9a84c',fontStyle:'bold'}).setOrigin(0.5),
      this.add.text(w/2,h/2-40,'━━━━━━━━━━━━━━━━━━━━',{fontSize:'10px',color:'#c9a84c33'}).setOrigin(0.5),
      this.add.text(w/2,h/2-10,'Lord Edmund Blackwood has been found dead\nin his study at Blackwood Manor.',{fontFamily:'"Lora",serif',fontSize:'11px',color:'#e8dcc8',align:'center'}).setOrigin(0.5),
      this.add.text(w/2,h/2+25,'The dinner party guests are all suspects.\nExplore the manor. Find evidence. Interrogate.',{fontFamily:'"Lora",serif',fontSize:'10px',color:'#aaa',align:'center'}).setOrigin(0.5),
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

    // Expand map if needed
    const needW = room.x + room.w + 1;
    const needH = room.y + room.h + 1;
    if (needW > this.MAP_W) this.MAP_W = needW;
    if (needH > this.MAP_H) this.MAP_H = needH;

    // Add the room to rooms registry
    this.rooms[room.id] = { name: room.name, x: room.x, y: room.y, w: room.w, h: room.h, floor: room.floor || 'tile_carpet', floorNum: 0 };

    // Add doorway to ground floor doors
    if (room.doorway) {
      if (!this.doors[0]) this.doors[0] = [];
      this.doors[0].push(room.doorway);
    }

    // Build floor tiles for the new room
    const floorKey = this.textures.exists(room.floor) ? room.floor : 'tile_carpet';
    for (let ry = 0; ry < room.h; ry++)
      for (let rx = 0; rx < room.w; rx++)
        this.add.image((room.x+rx)*T+T/2, (room.y+ry)*T+T/2, floorKey).setDepth(0);

    // Room name label
    this.add.text((room.x+room.w/2)*T, (room.y+1)*T, room.name, {
      fontFamily: '"Playfair Display", serif', fontSize: '11px', color: '#c9a84c55'
    }).setOrigin(0.5).setDepth(1);

    // Floor under doorway
    if (room.doorway) {
      const d = room.doorway;
      for (let dy = 0; dy < d.h; dy++)
        for (let dx = 0; dx < d.w; dx++)
          this.add.image((d.x+dx)*T+T/2, (d.y+dy)*T+T/2, 'tile_floor').setDepth(0);
    }

    // Remove wall physics bodies AND visible wall images where the doorway is
    if (room.doorway) {
      const d = room.doorway;
      // Destroy physics walls
      this.wallGroup.getChildren().forEach(wall => {
        const wx = Math.floor(wall.x / T);
        const wy = Math.floor(wall.y / T);
        if (wx >= d.x && wx < d.x + d.w && wy >= d.y && wy < d.y + d.h) {
          wall.destroy();
        }
      });
      // Also destroy any visible wall tile images in the doorway
      this.children.list.filter(c => c.texture && c.texture.key === 'tile_wall').forEach(wallImg => {
        const wx = Math.floor(wallImg.x / T);
        const wy = Math.floor(wallImg.y / T);
        if (wx >= d.x && wx < d.x + d.w && wy >= d.y && wy < d.y + d.h) {
          wallImg.destroy();
        }
      });
    }

    // Build walls for the new room area
    const grid = Array.from({length: this.MAP_H}, () => Array(this.MAP_W).fill(true));
    for (const r of Object.values(this.rooms).filter(r => r.floorNum === 0))
      for (let ry = 1; ry < r.h - 1; ry++)
        for (let rx = 1; rx < r.w - 1; rx++)
          if (r.y+ry < this.MAP_H && r.x+rx < this.MAP_W) grid[r.y+ry][r.x+rx] = false;
    for (const d of (this.doors[0] || []))
      for (let dy = 0; dy < d.h; dy++)
        for (let dx = 0; dx < d.w; dx++) {
          const gy = d.y+dy, gx = d.x+dx;
          if (gy >= 0 && gy < this.MAP_H && gx >= 0 && gx < this.MAP_W) grid[gy][gx] = false;
        }

    const neighbors = (x, y) => [[x-1,y],[x+1,y],[x,y-1],[x,y+1]];
    // Only add walls in the new room area (+ margin)
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
        this._floorWalls[0].push(b);
      }

    // Place evidence in the new room
    for (const ev of (room.evidence || [])) {
      // Generate evidence texture at runtime
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

    // Update camera bounds
    this.cameras.main.setBounds(0, 0, this.MAP_W * T, this.MAP_H * T);

    // Dramatic reveal: camera shake + narration
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

    // Generate NPC sprite texture at runtime
    const texKey = 'npc_' + npc.id;
    if (!this.textures.exists(texKey)) {
      const bodyColor = npc.color || 0x8b4513;
      const g = this.make.graphics({x:0, y:0, add:false});
      // Head
      g.fillStyle(0xf5d5b8, 1); g.fillCircle(16, 8, 7);
      // Body
      g.fillStyle(bodyColor, 1); g.fillRect(8, 14, 16, 12);
      // Eyes
      g.fillStyle(0x000000, 1); g.fillRect(13, 6, 2, 2); g.fillRect(18, 6, 2, 2);
      // Legs
      g.fillStyle(0x222222, 1); g.fillRect(10, 26, 4, 6); g.fillRect(18, 26, 4, 6);
      // Distinguishing hat (red herring identifier)
      g.fillStyle(0xcc3333, 1); g.fillRect(10, 1, 12, 4);
      g.generateTexture(texKey, 32, 32); g.destroy();
    }

    // Determine spawn position from room data or use provided coordinates
    const nx = npc.x;
    const ny = npc.y;

    const sprite = this.physics.add.sprite(nx*T+T/2, ny*T+T/2, texKey)
      .setDepth(5).setImmovable(true);
    sprite.body.setSize(28, 28);
    sprite.setData('id', npc.id);
    sprite.setData('name', npc.name);

    const label = this.add.text(nx*T+T/2, ny*T-8, npc.name, {
      fontFamily: '"Playfair Display", serif', fontSize: '9px', color: '#c9a84c',
      stroke: '#0a0a0a', strokeThickness: 2
    }).setOrigin(0.5).setDepth(10);
    this.npcLabels[npc.id] = label;

    this.tweens.add({
      targets: sprite, scaleY:{from:1,to:1.03},
      duration:2000, yoyo:true, repeat:-1, ease:'Sine.easeInOut'
    });
    this.npcs[npc.id] = sprite;

    // Add colliders
    this.physics.add.collider(this.player, sprite);
    Object.values(this.npcs).forEach(other => {
      if (other !== sprite) this.physics.add.collider(sprite, other);
    });

    // Entrance narration
    this._showNarration(`A new figure has appeared: ${npc.name}`);
  }
}
