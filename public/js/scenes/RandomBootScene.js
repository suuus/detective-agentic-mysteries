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
    const hairStyles = ['updo','receding','long','slicked','bun'];
    const builds = ['slim','broad','stout'];
    const moods = ['neutral','angry','nervous','friendly'];

    world.characters.forEach((char, i) => {
      const bodyCol = char.spriteColors ? this._hex(char.spriteColors.body) : fallback[i % fallback.length].body;
      const hairCol = char.spriteColors ? this._hex(char.spriteColors.hair) : fallback[i % fallback.length].hair;
      const costume = costumeLookup[char.id];
      const npcDef = {
        skin: 0xe8c99b, body: bodyCol, hair: hairCol,
        accent: bodyCol, hairStyle: hairStyles[i % hairStyles.length],
        build: builds[i % builds.length], accessory: null,
      };
      const S = 48;

      // Generate 4 mood variant sprites
      for (const mood of moods) {
        const texKey = mood === 'neutral' ? `npc_${char.id}` : `npc_${char.id}_${mood}`;
        this._tex(texKey, S, S, g => {
          this._drawNPCSprite(g, S, npcDef, mood);
          // Apply AI costume overlay on top (scaled from 32 to 48)
          if (costume) {
            const scaled = costume.map(op => this._scaleCostumeOp(op, 32, S));
            this._execCostume(g, scaled, S);
          }
          // Re-draw face features on top so costume doesn't cover them
          const cx = S / 2, cy = S / 2;
          const postureY = mood === 'nervous' ? 1 : mood === 'angry' ? -1 : 0;
          // Neck + head
          g.fillStyle(npcDef.skin); g.fillRect(cx - 4, cy - 4 + postureY, 8, 6);
          g.fillCircle(cx, cy - 12 + postureY, 9);
          // Eye whites + pupils
          const eyeY = cy - 12 + postureY;
          g.fillStyle(0xffffff); g.fillRect(cx-6,eyeY-1,4,3); g.fillRect(cx+2,eyeY-1,4,3);
          g.fillStyle(0x222222); g.fillRect(cx-5,eyeY,2,2); g.fillRect(cx+3,eyeY,2,2);
          // Mouth
          const mouthY = cy - 7 + postureY;
          g.fillStyle(0x993333); g.fillRect(cx-2,mouthY,4,1);
        });
      }

      // Generate portrait textures
      const PW = 128, PH = 160;
      for (const mood of moods) {
        const pKey = mood === 'neutral' ? `portrait_${char.id}` : `portrait_${char.id}_${mood}`;
        this._tex(pKey, PW, PH, g => {
          this._drawPortrait(g, PW, PH, npcDef, mood);
        });
      }
    });
  }

  /** Scale a costume draw op from original size to new size */
  _scaleCostumeOp(op, from, to) {
    if (!op) return op;
    const s = to / from;
    const scaled = { ...op };
    if (typeof scaled.x === 'number') scaled.x = Math.round(scaled.x * s);
    if (typeof scaled.y === 'number') scaled.y = Math.round(scaled.y * s);
    if (typeof scaled.w === 'number') scaled.w = Math.round(scaled.w * s);
    if (typeof scaled.h === 'number') scaled.h = Math.round(scaled.h * s);
    if (typeof scaled.r === 'number') scaled.r = Math.round(scaled.r * s);
    if (typeof scaled.x1 === 'number') scaled.x1 = Math.round(scaled.x1 * s);
    if (typeof scaled.y1 === 'number') scaled.y1 = Math.round(scaled.y1 * s);
    if (typeof scaled.x2 === 'number') scaled.x2 = Math.round(scaled.x2 * s);
    if (typeof scaled.y2 === 'number') scaled.y2 = Math.round(scaled.y2 * s);
    if (typeof scaled.x3 === 'number') scaled.x3 = Math.round(scaled.x3 * s);
    if (typeof scaled.y3 === 'number') scaled.y3 = Math.round(scaled.y3 * s);
    return scaled;
  }

  /** Draw a detailed NPC sprite — shared with BootScene pattern */
  _drawNPCSprite(g, S, npc, mood) {
    const cx = S / 2, cy = S / 2;
    const isSlim = npc.build === 'slim';
    const isBroad = npc.build === 'broad';
    const postureY = mood === 'nervous' ? 1 : mood === 'angry' ? -1 : 0;
    const shoulderOff = mood === 'nervous' ? 1 : mood === 'angry' ? -1 : 0;

    const bw = isSlim ? 14 : isBroad ? 18 : 16;
    const bh = 16;
    const bx = cx - bw / 2;
    const by = cy - 2 + postureY;
    g.fillStyle(npc.body); g.fillRect(bx, by, bw, bh);
    g.fillRect(bx - 2, by + shoulderOff, bw + 4, 4);
    g.fillStyle(npc.accent || npc.body);
    g.fillTriangle(cx - 2, by, cx, by + 5, cx + 2, by);
    // Neck (connects head to body)
    g.fillStyle(npc.skin); g.fillRect(cx - 4, cy - 4 + postureY, 8, 6);
    // Head
    g.fillCircle(cx, cy - 12 + postureY, 9);

    g.fillStyle(npc.hair);
    switch (npc.hairStyle) {
      case 'updo': g.fillRect(cx-8,cy-22+postureY,16,6); g.fillCircle(cx,cy-22+postureY,5); g.fillRect(cx-9,cy-18+postureY,18,3); break;
      case 'receding': g.fillRect(cx-7,cy-20+postureY,14,4); g.fillRect(cx+4,cy-18+postureY,5,4); g.fillRect(cx-9,cy-18+postureY,5,4); break;
      case 'long': g.fillRect(cx-9,cy-20+postureY,18,6); g.fillRect(cx-10,cy-16+postureY,4,14); g.fillRect(cx+6,cy-16+postureY,4,14); break;
      case 'slicked': g.fillRect(cx-8,cy-20+postureY,16,5); g.fillRect(cx-8,cy-17+postureY,16,2); break;
      case 'bun': g.fillRect(cx-7,cy-20+postureY,14,5); g.fillCircle(cx,cy-21+postureY,4); break;
      default: g.fillRect(cx-8,cy-20+postureY,16,5);
    }

    const eyeY = cy - 12 + postureY;
    g.fillStyle(0xffffff); g.fillRect(cx-6,eyeY-1,4,3); g.fillRect(cx+2,eyeY-1,4,3);
    g.fillStyle(0x222222); g.fillRect(cx-5,eyeY,2,2); g.fillRect(cx+3,eyeY,2,2);

    g.fillStyle(npc.hair, 0.8);
    if (mood === 'angry') { g.fillRect(cx-6,eyeY-4,4,1); g.fillRect(cx+2,eyeY-4,4,1); }
    else if (mood === 'nervous') { g.fillRect(cx-6,eyeY-5,4,1); g.fillRect(cx+2,eyeY-4,4,1); }
    else { g.fillRect(cx-6,eyeY-3,4,1); g.fillRect(cx+2,eyeY-3,4,1); }

    const mouthY = cy - 7 + postureY;
    g.fillStyle(0x993333);
    if (mood === 'angry') { g.fillRect(cx-2,mouthY+1,4,1); }
    else if (mood === 'nervous') { g.fillRect(cx-2,mouthY,4,2); }
    else if (mood === 'friendly') { g.fillRect(cx-3,mouthY,6,1); g.fillRect(cx-2,mouthY+1,4,1); }
    else { g.fillRect(cx-2,mouthY,4,1); }

    g.fillStyle(0x2a2a2a); g.fillRect(cx-5,cy+14+postureY,4,6); g.fillRect(cx+1,cy+14+postureY,4,6);
    g.fillStyle(0x1a1a1a); g.fillRect(cx-6,cy+19+postureY,5,2); g.fillRect(cx+1,cy+19+postureY,5,2);
    g.fillStyle(npc.body, 0.9); g.fillRect(bx-3,by+2,3,12); g.fillRect(bx+bw,by+2,3,12);
  }

  /** Draw a portrait bust — shared with BootScene pattern */
  _drawPortrait(g, W, H, npc, mood) {
    const cx = W / 2, cy = H / 2 - 10;
    const bgR = (npc.body >> 16) & 0xff, bgG = (npc.body >> 8) & 0xff, bgB = npc.body & 0xff;
    g.fillStyle(Phaser.Display.Color.GetColor(Math.floor(bgR*0.3), Math.floor(bgG*0.3), Math.floor(bgB*0.3)));
    g.fillRect(0, 0, W, H);
    g.fillStyle(0x000000, 0.3); g.fillRect(0,0,8,H); g.fillRect(W-8,0,8,H);

    const tiltX = mood === 'nervous' ? 3 : mood === 'angry' ? -2 : 0;
    const headCx = cx + tiltX;
    const bodyTop = cy + 30;
    g.fillStyle(npc.body); g.fillRect(cx-40,bodyTop+8,80,H-bodyTop-8); g.fillRect(cx-35,bodyTop,70,10);
    g.fillCircle(cx-35,bodyTop+5,8); g.fillCircle(cx+35,bodyTop+5,8);
    g.fillStyle(npc.accent || npc.body); g.fillTriangle(cx-8,bodyTop,cx,bodyTop+18,cx+8,bodyTop);
    g.fillStyle(npc.skin); g.fillRect(headCx-8,cy+22,16,12);
    g.fillCircle(headCx,cy,28); g.fillRect(headCx-22,cy,44,18); g.fillCircle(headCx,cy+16,20);

    g.fillStyle(npc.hair);
    switch (npc.hairStyle) {
      case 'updo': g.fillRect(headCx-26,cy-30,52,18); g.fillCircle(headCx,cy-34,14); break;
      case 'receding': g.fillRect(headCx-20,cy-28,40,10); g.fillRect(headCx+18,cy-22,12,12); g.fillRect(headCx-30,cy-22,12,12); break;
      case 'long': g.fillRect(headCx-28,cy-28,56,16); g.fillRect(headCx-30,cy-16,10,42); g.fillRect(headCx+20,cy-16,10,42); break;
      case 'slicked': g.fillRect(headCx-24,cy-28,48,14); g.fillRect(headCx-24,cy-18,48,4); break;
      case 'bun': g.fillRect(headCx-22,cy-28,44,14); g.fillCircle(headCx,cy-32,10); break;
    }

    const eyeY = cy - 2;
    const eyeSpacing = 12;
    g.fillStyle(0xffffff);
    const eyeW = mood === 'nervous' ? 10 : 8, eyeH = mood === 'nervous' ? 8 : 6;
    g.fillRect(headCx-eyeSpacing-eyeW/2,eyeY-eyeH/2,eyeW,eyeH);
    g.fillRect(headCx+eyeSpacing-eyeW/2,eyeY-eyeH/2,eyeW,eyeH);
    g.fillStyle(0x332211);
    const ps = mood === 'nervous' ? 3 : 4;
    g.fillCircle(headCx-eyeSpacing,eyeY,ps); g.fillCircle(headCx+eyeSpacing,eyeY,ps);
    g.fillStyle(0xffffff); g.fillRect(headCx-eyeSpacing-1,eyeY-2,2,2); g.fillRect(headCx+eyeSpacing-1,eyeY-2,2,2);

    g.fillStyle(npc.hair, 0.9);
    if (mood === 'angry') { g.fillRect(headCx-eyeSpacing-5,eyeY-9,10,2); g.fillRect(headCx+eyeSpacing-5,eyeY-9,10,2); }
    else if (mood === 'nervous') { g.fillRect(headCx-eyeSpacing-5,eyeY-12,10,2); g.fillRect(headCx+eyeSpacing-5,eyeY-9,10,2); }
    else { g.fillRect(headCx-eyeSpacing-5,eyeY-9,10,2); g.fillRect(headCx+eyeSpacing-5,eyeY-9,10,2); }

    const noseColor = Phaser.Display.Color.GetColor(
      Math.max(0,((npc.skin>>16)&0xff)-20), Math.max(0,((npc.skin>>8)&0xff)-15), Math.max(0,(npc.skin&0xff)-15));
    g.fillStyle(noseColor); g.fillRect(headCx-2,eyeY+6,4,8); g.fillRect(headCx-3,eyeY+12,6,2);

    if (mood === 'angry') { g.fillStyle(0x883333); g.fillRect(headCx-8,cy+18,16,3); }
    else if (mood === 'nervous') { g.fillStyle(0x994444); g.fillRect(headCx-6,cy+17,12,5); g.fillStyle(0x222222); g.fillRect(headCx-4,cy+18,8,3); }
    else if (mood === 'friendly') { g.fillStyle(0xaa5555); g.fillRect(headCx-10,cy+17,20,3); g.fillRect(headCx-8,cy+19,16,2); }
    else { g.fillStyle(0x884444); g.fillRect(headCx-7,cy+18,14,2); }
  }

  /**
   * Draw costume ops with safety: skip ops that would cover the face,
   * force partial alpha on ops overlapping the head region.
   */
  _execCostume(g, ops, canvasSize) {
    if (!Array.isArray(ops)) return;
    // Head region scaled to actual canvas size (base coords for 32×32)
    const s = (canvasSize || 32) / 32;
    const HEAD_LEFT = Math.round(11 * s), HEAD_RIGHT = Math.round(21 * s);
    const HEAD_TOP = Math.round(3 * s), HEAD_BOTTOM = Math.round(15 * s);
    for (const op of ops) {
      if (!op || !op.op) continue;
      // Skip giant fills that would cover the whole sprite
      if (op.op === 'fill' && op.w >= Math.round(28 * s) && op.h >= Math.round(28 * s)) continue;
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
