/**
 * RandomBootScene — fetches generated mystery data and creates dynamic textures
 * using the AI-provided visual palette and character colors.
 */
export default class RandomBootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'RandomBootScene' });
  }

  async create() {
    const { width, height } = this.cameras.main;
    const loadText = this.add.text(width/2, height/2, 'Loading generated world...', {
      fontFamily: '"Playfair Display", serif', fontSize: '18px', color: '#c9a84c'
    }).setOrigin(0.5);

    try {
      const res = await fetch('/api/mystery/rooms');
      const data = await res.json();
      window._generatedWorld = data;
    } catch(err) {
      loadText.setText('Failed to load world: ' + err.message);
      return;
    }

    this._genTiles();
    this._genFurniture();
    this._genPlayer();
    this._genPrompts();
    this._genNPCs();
    this._genEvidence();
    this._genCrimeScene();
    this._genStairs();
    this._genCreativeAssets();

    this.scene.start('RandomManorScene');
  }

  _hex(str) {
    if (!str || typeof str !== 'string') return 0x333333;
    return parseInt(str.replace('#', ''), 16) || 0x333333;
  }

  _tex(key, w, h, fn) {
    const g = this.make.graphics({ add: false });
    fn(g, w, h);
    g.generateTexture(key, w, h);
    g.destroy();
  }

  /** Execute an array of drawing instructions on a Phaser Graphics object. */
  _execDraw(g, ops) {
    if (!Array.isArray(ops)) return;
    for (const op of ops) {
      if (!op || !op.op) continue;
      const c = this._hex(op.color);
      const a = typeof op.alpha === 'number' ? op.alpha : 1;
      switch (op.op) {
        case 'fill':
          g.fillStyle(c, a); g.fillRect(op.x, op.y, op.w, op.h);
          break;
        case 'circle':
          g.fillStyle(c, a); g.fillCircle(op.x, op.y, op.r);
          break;
        case 'line':
          g.lineStyle(op.width || 1, c, a); g.lineBetween(op.x1, op.y1, op.x2, op.y2);
          break;
        case 'tri':
          g.fillStyle(c, a); g.fillTriangle(op.x1, op.y1, op.x2, op.y2, op.x3, op.y3);
          break;
        case 'stroke':
          g.lineStyle(op.width || 1, c, a); g.strokeRect(op.x, op.y, op.w, op.h);
          break;
        case 'ellipse':
          g.fillStyle(c, a); g.fillEllipse(op.x, op.y, op.w, op.h);
          break;
        case 'arc':
          g.lineStyle(op.width || 1, c, a);
          g.beginPath();
          g.arc(op.x, op.y, op.r, op.start || 0, op.end || Math.PI * 2, false);
          g.strokePath();
          break;
        case 'roundRect':
          g.fillStyle(c, a); g.fillRoundedRect(op.x, op.y, op.w, op.h, op.r || 4);
          break;
      }
    }
  }

  _genPlayer() {
    const S = 32;
    const dirNames = ['down','left','right','up'];
    for (let d = 0; d < 4; d++) {
      for (let f = 0; f < 3; f++) {
        const key = `player_${dirNames[d]}_${f}`;
        this._tex(key, S, S, (g) => {
          const cx = S/2, cy = S/2;
          const wb = f === 1 ? -1 : f === 2 ? 1 : 0;
          g.fillStyle(0x5c4a32); g.fillRect(cx-6, cy-2+wb, 12, 14);
          g.fillStyle(0xe8c99b); g.fillRect(cx-5, cy-10+wb, 10, 9);
          g.fillStyle(0x3a2f24); g.fillRect(cx-7, cy-14+wb, 14, 5); g.fillRect(cx-5, cy-16+wb, 10, 3);
          if (dirNames[d] !== 'up') {
            g.fillStyle(0x222222);
            if (dirNames[d] === 'down') { g.fillRect(cx-3,cy-6+wb,2,2); g.fillRect(cx+1,cy-6+wb,2,2); }
            else if (dirNames[d] === 'left') g.fillRect(cx-4,cy-6+wb,2,2);
            else g.fillRect(cx+2,cy-6+wb,2,2);
          }
          g.fillStyle(0x2a2a2a); g.fillRect(cx-4, cy+12, 3, 4); g.fillRect(cx+1, cy+12, 3, 4);
          g.fillStyle(0x1a1a1a); g.fillRect(cx-5, cy+15, 4, 2); g.fillRect(cx+1, cy+15, 4, 2);
        });
      }
    }
    const fr = 8;
    for (let d = 0; d < 4; d++) {
      const dir = dirNames[d];
      this.anims.create({ key: `walk-${dir}`, frames: [
        { key: `player_${dir}_0` }, { key: `player_${dir}_1` }, { key: `player_${dir}_0` }, { key: `player_${dir}_2` },
      ], frameRate: fr, repeat: -1 });
      this.anims.create({ key: `idle-${dir}`, frames: [{ key: `player_${dir}_0` }], frameRate: 1, repeat: -1 });
    }
  }

  _genTiles() {
    const v = window._generatedWorld?.visual || {};
    const wallCol = this._hex(v.wallColor || '#2d1117');
    const wallAcc = this._hex(v.wallAccent || '#3a1520');

    // Floor tiles — base set plus new ones
    this._tex('tile_floor', 32, 32, g => { g.fillStyle(0x3d3225); g.fillRect(0,0,32,32); g.lineStyle(1,0x342b1f); g.strokeRect(0,0,32,32); });
    this._tex('tile_carpet', 32, 32, g => { g.fillStyle(0x4a1a2a); g.fillRect(0,0,32,32); g.lineStyle(1,0xc9a84c,0.2); g.strokeRect(4,4,24,24); });
    this._tex('tile_metal', 32, 32, g => { g.fillStyle(0x3a3a3a); g.fillRect(0,0,32,32); g.fillStyle(0x444444); g.fillCircle(8,8,2); g.fillCircle(24,8,2); g.fillCircle(8,24,2); g.fillCircle(24,24,2); });
    this._tex('tile_wood_deck', 32, 32, g => { g.fillStyle(0x5c4a32); g.fillRect(0,0,32,32); g.lineStyle(1,0x4a3a22); for(let i=0;i<4;i++){ g.beginPath(); g.moveTo(0,8+i*8); g.lineTo(32,8+i*8); g.strokePath(); }});
    this._tex('tile_carpet_blue', 32, 32, g => { g.fillStyle(0x1a2a4a); g.fillRect(0,0,32,32); g.lineStyle(1,0x2a3a5a,0.3); g.strokeRect(4,4,24,24); });
    this._tex('tile_carpet_red', 32, 32, g => { g.fillStyle(0x4a1a1a); g.fillRect(0,0,32,32); g.lineStyle(1,0x5a2a2a,0.3); g.strokeRect(4,4,24,24); });
    this._tex('tile_tile_white', 32, 32, g => { g.fillStyle(0xd0d0d0); g.fillRect(0,0,32,32); g.fillStyle(0xc0c0c0); g.fillRect(0,0,16,16); g.fillRect(16,16,16,16); });
    // New floor types
    this._tex('tile_sand', 32, 32, g => { g.fillStyle(0xc2b280); g.fillRect(0,0,32,32); g.fillStyle(0xb8a870,0.5); g.fillRect(4,12,8,3); g.fillRect(18,6,6,2); });
    this._tex('tile_ice', 32, 32, g => { g.fillStyle(0xb0d4e8); g.fillRect(0,0,32,32); g.fillStyle(0xc8e4f8,0.6); g.fillRect(2,2,12,6); g.fillRect(16,18,14,8); });
    this._tex('tile_grass', 32, 32, g => { g.fillStyle(0x2d5a1e); g.fillRect(0,0,32,32); g.fillStyle(0x3a6a28); g.fillRect(4,4,6,3); g.fillRect(18,14,8,4); g.fillRect(8,24,6,3); });
    this._tex('tile_stone', 32, 32, g => { g.fillStyle(0x6b6b6b); g.fillRect(0,0,32,32); g.lineStyle(1,0x555555); g.strokeRect(0,0,16,16); g.strokeRect(16,0,16,16); g.strokeRect(8,16,16,16); });

    // Walls — use AI-designed wall tile if creative assets provide one, else palette colors
    const ca = window._generatedWorld?.creativeAssets;
    if (ca?.wallTile?.draw?.length > 0) {
      this._tex('tile_wall', 32, 32, g => this._execDraw(g, ca.wallTile.draw));
    } else {
      this._tex('tile_wall', 32, 32, g => {
        g.fillStyle(wallCol); g.fillRect(0,0,32,32);
        g.fillStyle(wallAcc); g.fillRect(2,2,28,12); g.fillRect(2,18,28,12);
      });
    }
  }

  _genFurniture() {
    const v = window._generatedWorld?.visual || {};
    const style = v.furnitureStyle || 'wooden';

    const palettes = {
      wooden:     { pri: 0x5c3a1e, sec: 0x6b4423, acc: 0x4a2e16 },
      metal:      { pri: 0x555555, sec: 0x6a6a6a, acc: 0x444444 },
      modern:     { pri: 0x2a2a2a, sec: 0x3a3a3a, acc: 0x1a1a1a },
      ornate:     { pri: 0x5c3a1e, sec: 0xc9a84c, acc: 0x8B6914 },
      rustic:     { pri: 0x6b4423, sec: 0x5c4a32, acc: 0x3a2a1a },
      clinical:   { pri: 0xcccccc, sec: 0xdddddd, acc: 0xaaaaaa },
      futuristic: { pri: 0x1a1a2e, sec: 0x2a2a4a, acc: 0x0044aa },
    };
    const p = palettes[style] || palettes.wooden;

    // Default palette-based furniture (always available as fallback)
    this._tex('furn_table', 48, 32, g => { g.fillStyle(p.pri); g.fillRect(4,4,40,24); g.fillStyle(p.sec); g.fillRect(6,6,36,20); });
    this._tex('furn_desk', 64, 32, g => { g.fillStyle(p.pri); g.fillRect(0,4,64,24); g.fillStyle(p.acc); g.fillRect(2,8,60,18); });
    this._tex('furn_bookshelf', 64, 32, g => {
      g.fillStyle(p.acc); g.fillRect(0,0,64,32);
      const c=[0x8B0000,0x00008B,0x006400,0x4B0082]; for(let i=0;i<8;i++){ g.fillStyle(c[i%4]); g.fillRect(4+i*7,4,6,12); g.fillRect(4+i*7,18,6,12); }
    });
    this._tex('furn_plant', 24, 32, g => { g.fillStyle(p.pri); g.fillRect(4,16,16,14); g.fillStyle(0x228B22); g.fillRect(8,2,3,14); g.fillRect(4,0,6,6); g.fillRect(12,2,6,6); });
    this._tex('furn_crate', 32, 32, g => { g.fillStyle(p.pri); g.fillRect(2,2,28,28); g.lineStyle(2,p.acc); g.strokeRect(4,4,24,24); g.beginPath(); g.moveTo(4,4); g.lineTo(28,28); g.strokePath(); });
    this._tex('furn_cabinet', 48, 32, g => { g.fillStyle(p.pri); g.fillRect(2,0,44,32); g.fillStyle(p.sec); g.fillRect(4,2,18,28); g.fillRect(26,2,18,28); g.fillStyle(p.acc); g.fillCircle(20,16,2); g.fillCircle(28,16,2); });

    // AI-designed setting-specific furniture
    const ca = window._generatedWorld?.creativeAssets;
    if (Array.isArray(ca?.furniture)) {
      ca.furniture.forEach((furn, i) => {
        if (!furn?.draw?.length) return;
        const w = Math.min(Math.max(furn.width || 48, 16), 64);
        const h = Math.min(Math.max(furn.height || 32, 16), 64);
        const key = `furn_custom_${i}`;
        furn._texKey = key;
        this._tex(key, w, h, g => this._execDraw(g, furn.draw));
      });
      console.log(`[Creative] Generated ${ca.furniture.length} custom furniture textures`);
    }
  }

  _genNPCs() {
    const world = window._generatedWorld;
    if (!world) return;
    const ca = world.creativeAssets;
    // Build costume lookup by characterId
    const costumeLookup = {};
    if (Array.isArray(ca?.npcCostumes)) {
      for (const c of ca.npcCostumes) {
        if (c?.characterId && Array.isArray(c.draw)) costumeLookup[c.characterId] = c.draw;
      }
    }
    // Fallback palette if AI didn't provide spriteColors
    const fallback = [
      { body: 0x8B2252, hair: 0xDAA520 }, { body: 0x2F4F4F, hair: 0x696969 },
      { body: 0x4a3280, hair: 0x8B4513 }, { body: 0x1a1a2e, hair: 0x333333 },
      { body: 0x2d2d2d, hair: 0xaaaaaa }, { body: 0x800020, hair: 0xDDDD00 },
      { body: 0x2a4a2a, hair: 0x1a1a1a }, { body: 0x4a4a4a, hair: 0x6b4423 },
    ];
    world.characters.forEach((char, i) => {
      const bodyCol = char.spriteColors ? this._hex(char.spriteColors.body) : fallback[i % fallback.length].body;
      const hairCol = char.spriteColors ? this._hex(char.spriteColors.hair) : fallback[i % fallback.length].hair;
      const costume = costumeLookup[char.id];
      this._tex('npc_' + char.id, 32, 32, g => {
        const cx=16, cy=16;
        // Base body (torso, skin, hair, legs — but NOT eyes yet)
        g.fillStyle(bodyCol); g.fillRect(cx-6,cy-2,12,14);
        g.fillStyle(0xe8c99b); g.fillRect(cx-5,cy-10,10,9);
        g.fillStyle(hairCol); g.fillRect(cx-5,cy-13,10,5);
        g.fillStyle(0x2a2a2a); g.fillRect(cx-4,cy+12,3,4); g.fillRect(cx+1,cy+12,3,4);
        // AI costume overlay — clamp to avoid obliterating the face/body
        if (costume) this._execCostume(g, costume);
        // Eyes drawn LAST so they're always visible on top of costume
        g.fillStyle(0x222222); g.fillRect(cx-3,cy-6,2,2); g.fillRect(cx+1,cy-6,2,2);
      });
    });
  }

  /**
   * Draw costume ops with safety: skip ops that would cover the face,
   * force partial alpha on ops overlapping the head region.
   */
  _execCostume(g, ops) {
    if (!Array.isArray(ops)) return;
    // Head region: roughly x(11-21), y(3-15) on 32×32 canvas
    const HEAD_LEFT = 11, HEAD_RIGHT = 21, HEAD_TOP = 3, HEAD_BOTTOM = 15;
    for (const op of ops) {
      if (!op || !op.op) continue;
      // Skip giant fills that would cover the whole sprite
      if (op.op === 'fill' && op.w >= 28 && op.h >= 28) continue;
      // For rectangles overlapping the face, force transparency so features show through
      if ((op.op === 'fill' || op.op === 'roundRect') && op.w > 6 && op.h > 6) {
        const opRight = (op.x || 0) + (op.w || 0);
        const opBottom = (op.y || 0) + (op.h || 0);
        const overlapsHead = (op.x || 0) < HEAD_RIGHT && opRight > HEAD_LEFT
                          && (op.y || 0) < HEAD_BOTTOM && opBottom > HEAD_TOP;
        if (overlapsHead) {
          // Draw with forced lower alpha so eyes/face still show
          const c = this._hex(op.color);
          const a = Math.min(typeof op.alpha === 'number' ? op.alpha : 1, 0.5);
          if (op.op === 'fill') { g.fillStyle(c, a); g.fillRect(op.x, op.y, op.w, op.h); }
          else { g.fillStyle(c, a); g.fillRoundedRect(op.x, op.y, op.w, op.h, op.r || 4); }
          continue;
        }
      }
      // Normal draw for non-overlapping ops
      const c = this._hex(op.color);
      const a = typeof op.alpha === 'number' ? op.alpha : 1;
      switch (op.op) {
        case 'fill':     g.fillStyle(c, a); g.fillRect(op.x, op.y, op.w, op.h); break;
        case 'circle':   g.fillStyle(c, a); g.fillCircle(op.x, op.y, op.r); break;
        case 'line':     g.lineStyle(op.width || 1, c, a); g.lineBetween(op.x1, op.y1, op.x2, op.y2); break;
        case 'tri':      g.fillStyle(c, a); g.fillTriangle(op.x1, op.y1, op.x2, op.y2, op.x3, op.y3); break;
        case 'stroke':   g.lineStyle(op.width || 1, c, a); g.strokeRect(op.x, op.y, op.w, op.h); break;
        case 'ellipse':  g.fillStyle(c, a); g.fillEllipse(op.x, op.y, op.w, op.h); break;
        case 'arc':      g.lineStyle(op.width || 1, c, a); g.beginPath(); g.arc(op.x, op.y, op.r, op.start || 0, op.end || Math.PI * 2, false); g.strokePath(); break;
        case 'roundRect': g.fillStyle(c, a); g.fillRoundedRect(op.x, op.y, op.w, op.h, op.r || 4); break;
      }
    }
  }

  _genEvidence() {
    const world = window._generatedWorld;
    if (!world) return;
    const accent = this._hex(world.visual?.accentColor || '#c9a84c');
    const ca = world.creativeAssets;

    // Build sprite lookup by evidenceId
    const spriteLookup = {};
    if (Array.isArray(ca?.evidenceSprites)) {
      for (const es of ca.evidenceSprites) {
        if (es?.evidenceId && Array.isArray(es.draw) && es.draw.length) spriteLookup[es.evidenceId] = es;
      }
    }

    world.evidence.forEach((ev) => {
      const aiSprite = spriteLookup[ev.id];
      if (aiSprite) {
        // Use AI-designed unique sprite
        const w = Math.min(Math.max(aiSprite.width || 16, 8), 24);
        const h = Math.min(Math.max(aiSprite.height || 16, 8), 24);
        this._tex('ev_' + ev.id, w, h, g => this._execDraw(g, aiSprite.draw));
      } else {
        // Fallback: generic colored evidence
        const col = ev.color ? this._hex(ev.color) : 0xf5f0e0;
        this._tex('ev_' + ev.id, 16, 16, g => {
          g.fillStyle(col); g.fillRect(3,2,10,12);
          g.fillStyle(col, 0.6); g.fillRect(5,4,6,3);
          g.fillStyle(0x333333); g.fillRect(5,9,5,1); g.fillRect(5,11,4,1);
        });
      }
    });
    // Glow uses accent color
    this._tex('ev_glow', 24, 24, g => { g.fillStyle(accent, 0.4); g.fillCircle(12, 12, 10); });
  }

  _genPrompts() {
    this._tex('prompt_talk', 64, 24, g => { g.fillStyle(0x000000); g.fillRect(0,0,64,24); g.lineStyle(1,0xc9a84c); g.strokeRect(0,0,64,24); });
    this._tex('prompt_examine', 80, 24, g => { g.fillStyle(0x000000); g.fillRect(0,0,80,24); g.lineStyle(1,0xc9a84c); g.strokeRect(0,0,80,24); });
  }

  _genCrimeScene() {
    const ca = window._generatedWorld?.creativeAssets?.crimeScene;

    // Body outline — AI-designed or default chalk outline (48×64)
    if (ca?.bodyOutline?.draw?.length) {
      this._tex('crime_body_outline', 48, 64, g => this._execDraw(g, ca.bodyOutline.draw));
    } else {
      this._tex('crime_body_outline', 48, 64, g => {
        g.lineStyle(2, 0xcccccc, 0.8);
        g.strokeCircle(24, 8, 6);
        g.lineBetween(24, 14, 24, 18);
        g.strokeRect(14, 18, 20, 20);
        g.lineBetween(14, 20, 4, 32); g.lineBetween(4, 32, 2, 38);
        g.lineBetween(34, 20, 44, 32); g.lineBetween(44, 32, 46, 38);
        g.lineBetween(18, 38, 12, 52); g.lineBetween(12, 52, 8, 62);
        g.lineBetween(30, 38, 36, 52); g.lineBetween(36, 52, 40, 62);
        g.fillStyle(0xaaaaaa, 0.15); g.fillCircle(24, 30, 18);
      });
    }

    // Scene markers — AI-designed or default blood pools (16×16 each)
    if (Array.isArray(ca?.markers) && ca.markers.length > 0) {
      ca.markers.forEach((marker, i) => {
        if (!marker?.draw?.length) return;
        this._tex(`crime_marker_${i}`, 16, 16, g => this._execDraw(g, marker.draw));
      });
      // Also create the classic keys as aliases to first markers for scene compat
      if (!this.textures.exists('crime_blood_1') && ca.markers[0]?.draw?.length) {
        this._tex('crime_blood_1', 16, 16, g => this._execDraw(g, ca.markers[0].draw));
      }
      if (!this.textures.exists('crime_blood_2') && ca.markers.length > 1 && ca.markers[1]?.draw?.length) {
        this._tex('crime_blood_2', 24, 24, g => this._execDraw(g, ca.markers[1].draw));
      } else if (!this.textures.exists('crime_blood_2')) {
        this._tex('crime_blood_2', 24, 24, g => {
          g.fillStyle(0x3a0000, 0.6); g.fillCircle(12, 12, 10);
          g.fillStyle(0x4a0000, 0.5); g.fillCircle(12, 12, 7);
        });
      }
    } else {
      this._tex('crime_blood_1', 16, 16, g => {
        g.fillStyle(0x4a0000, 0.7); g.fillCircle(8, 8, 5);
        g.fillStyle(0x3a0000, 0.5); g.fillCircle(5, 6, 3); g.fillCircle(11, 10, 2);
        g.fillRect(3, 8, 3, 2);
      });
      this._tex('crime_blood_2', 24, 24, g => {
        g.fillStyle(0x3a0000, 0.6); g.fillCircle(12, 12, 10);
        g.fillStyle(0x4a0000, 0.5); g.fillCircle(12, 12, 7);
        g.fillStyle(0x2a0000, 0.4); g.fillCircle(10, 14, 4); g.fillCircle(16, 10, 3);
      });
    }

    // Barrier — AI-designed or default crime tape (64×8)
    if (ca?.barrier?.draw?.length) {
      this._tex('crime_tape', 64, 8, g => this._execDraw(g, ca.barrier.draw));
    } else {
      this._tex('crime_tape', 64, 8, g => {
        g.fillStyle(0xccaa00); g.fillRect(0, 0, 64, 8);
        g.fillStyle(0x111111);
        for (let i = 0; i < 8; i++) {
          const x = i * 8;
          g.fillTriangle(x, 0, x+4, 4, x+8, 0);
          g.fillTriangle(x, 8, x+4, 4, x+8, 8);
        }
      });
    }
  }

  _genStairs() {
    // Only generate stair textures if the world has multi-floor support
    const world = window._generatedWorld;
    if (!world?.multiFloor) return;

    // Staircase tile going up (for ground floor)
    this._tex('tile_stairs', 32, 32, (g) => {
      g.fillStyle(0x5c3a1e); g.fillRect(0,0,32,32);
      g.fillStyle(0x4a2e16);
      for (let i = 0; i < 5; i++) {
        g.fillRect(0, i * 6 + 2, 32, 4);
        g.fillStyle(0x6b4423); g.fillRect(0, i * 6, 32, 2);
        g.fillStyle(0x4a2e16);
      }
      g.fillStyle(0xc9a84c, 0.7);
      g.fillTriangle(16, 4, 10, 14, 22, 14);
      g.fillRect(13, 14, 6, 8);
    });

    // Staircase tile going down (for upper floor)
    this._tex('tile_stairs_down', 32, 32, (g) => {
      g.fillStyle(0x5c3a1e); g.fillRect(0,0,32,32);
      g.fillStyle(0x4a2e16);
      for (let i = 0; i < 5; i++) {
        g.fillRect(0, i * 6 + 2, 32, 4);
        g.fillStyle(0x6b4423); g.fillRect(0, i * 6, 32, 2);
        g.fillStyle(0x4a2e16);
      }
      g.fillStyle(0xc9a84c, 0.7);
      g.fillTriangle(16, 28, 10, 18, 22, 18);
      g.fillRect(13, 10, 6, 8);
    });

    // Upper floor tile (slightly different shade)
    this._tex('tile_upper_floor', 32, 32, (g) => {
      g.fillStyle(0x3a2e22); g.fillRect(0,0,32,32);
      g.lineStyle(1, 0x302518); g.strokeRect(0,0,32,32);
      g.lineStyle(1, 0x322a1e);
      for(let i=0;i<5;i++){ g.beginPath(); g.moveTo(0,6+i*6); g.lineTo(32,6+i*6); g.strokePath(); }
    });
  }

  /**
   * Generate textures from the Creative Agency's AI-designed assets.
   * Each decoration and ambient prop becomes a named Phaser texture
   * that RandomManorScene can place in the world.
   */
  _genCreativeAssets() {
    const ca = window._generatedWorld?.creativeAssets;
    if (!ca) return;

    // Generate decoration textures — keyed by "decor_{roomId}_{index}"
    let decoIdx = 0;
    if (Array.isArray(ca.decorations)) {
      for (const roomDecor of ca.decorations) {
        if (!roomDecor?.items) continue;
        for (const item of roomDecor.items) {
          if (!item?.draw?.length) continue;
          const w = Math.min(Math.max(item.width || 32, 8), 64);
          const h = Math.min(Math.max(item.height || 32, 8), 64);
          const key = `decor_${decoIdx++}`;
          item._texKey = key; // attach generated key for scene to reference
          this._tex(key, w, h, g => this._execDraw(g, item.draw));
        }
      }
    }

    // Generate ambient prop textures — keyed by "prop_{index}"
    if (Array.isArray(ca.ambientProps)) {
      ca.ambientProps.forEach((prop, i) => {
        if (!prop?.draw?.length) return;
        const w = Math.min(Math.max(prop.width || 12, 4), 32);
        const h = Math.min(Math.max(prop.height || 12, 4), 32);
        const key = `prop_${i}`;
        prop._texKey = key;
        this._tex(key, w, h, g => this._execDraw(g, prop.draw));
      });
    }

    // Generate particle texture from creative config
    if (ca.particles) {
      const pColor = this._hex(ca.particles.color || '#e8dcc8');
      const pSize = Math.min(Math.max(ca.particles.size || 2, 1), 6);
      this._tex('creative_particle', pSize * 2, pSize * 2, g => {
        g.fillStyle(pColor); g.fillCircle(pSize, pSize, pSize);
      });
    }

    // Generate character portrait textures (64×64) for dialog panel
    if (Array.isArray(ca.portraits)) {
      for (const portrait of ca.portraits) {
        if (!portrait?.characterId || !Array.isArray(portrait.draw) || !portrait.draw.length) continue;
        const key = `portrait_${portrait.characterId}`;
        this._tex(key, 64, 64, g => this._execDraw(g, portrait.draw));
      }
      console.log(`[Creative] Generated ${ca.portraits.length} character portraits`);
    }

    // Generate custom weather particle texture
    if (ca.weather?.particle?.draw?.length) {
      const wp = ca.weather.particle;
      const w = Math.min(Math.max(wp.width || 4, 1), 16);
      const h = Math.min(Math.max(wp.height || 4, 1), 16);
      this._tex('weather_creative', w, h, g => this._execDraw(g, wp.draw));
      console.log(`[Creative] Generated custom weather particle texture (${w}×${h})`);
    }

    console.log(`[Creative] Generated ${decoIdx} decoration textures, ${ca.ambientProps?.length || 0} prop textures`);
  }
}
