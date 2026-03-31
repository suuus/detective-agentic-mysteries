/**
 * BootScene — generates all game sprites procedurally.
 */
export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    const { width, height } = this.cameras.main;
    this.add.text(width/2, height/2 - 30, 'Detective Agentic Mysteries', {
      fontFamily: '"Playfair Display", Georgia, serif', fontSize: '24px', color: '#c9a84c'
    }).setOrigin(0.5);
    this.loadingText = this.add.text(width/2, height/2 + 10, 'Generating manor…', {
      fontFamily: '"Lora", serif', fontSize: '14px', color: '#e8dcc8'
    }).setOrigin(0.5);
  }

  create() {
    try {
      this._genTiles();
      this._genFurniture();
      this._genStairs();
      this._genNPCs();
      this._genPortraits();
      this._genEvidence();
      this._genPlayer();
      this._genPrompts();
      this._genCrimeScene();
      console.log('BootScene: all textures generated, starting ManorScene');
      this.scene.start('ManorScene');
    } catch(err) {
      console.error('BootScene failed:', err);
      this.loadingText.setText('Error: ' + err.message);
    }
  }

  _tex(key, w, h, fn) {
    const g = this.make.graphics({ add: false });
    fn(g, w, h);
    g.generateTexture(key, w, h);
    g.destroy();
  }

  _genPlayer() {
    const S = 48;
    const dirNames = ['down','left','right','up'];

    for (let d = 0; d < 4; d++) {
      for (let f = 0; f < 3; f++) {
        const key = `player_${dirNames[d]}_${f}`;
        this._tex(key, S, S, (g) => {
          const cx = S/2, cy = S/2;
          const wb = f === 1 ? -1 : f === 2 ? 1 : 0; // walk bounce
          const dir = dirNames[d];

          // ── Trenchcoat (body) ──
          const coat = 0x5c4a32;
          const coatDk = 0x4a3a24;
          g.fillStyle(coat);
          g.fillRect(cx-7, cy-2+wb, 14, 16);
          // Shoulders
          g.fillRect(cx-9, cy-1+wb, 18, 4);
          // Coat collar
          g.fillStyle(0x6b5a3e);
          g.fillTriangle(cx-2, cy-2+wb, cx, cy+4+wb, cx+2, cy-2+wb);

          // ── Neck ──
          g.fillStyle(0xe0c8a0); g.fillRect(cx-3, cy-5+wb, 6, 5);

          // ── Head (androgynous — soft oval, medium features) ──
          g.fillStyle(0xe0c8a0);
          g.fillCircle(cx, cy-12+wb, 9);

          // ── Hair — short, swept, gender-neutral ──
          g.fillStyle(0x4a3a2a);
          g.fillRect(cx-8, cy-20+wb, 16, 6);
          g.fillRect(cx-9, cy-17+wb, 18, 3);
          if (dir === 'left' || dir === 'down') {
            g.fillRect(cx-9, cy-15+wb, 4, 5); // Side hair left
          }
          if (dir === 'right' || dir === 'down') {
            g.fillRect(cx+5, cy-15+wb, 4, 5); // Side hair right
          }

          // ── Detective hat ──
          g.fillStyle(0x3a2f24);
          g.fillRect(cx-10, cy-22+wb, 20, 4); // Brim
          g.fillRect(cx-7, cy-26+wb, 14, 5);  // Crown
          g.fillStyle(0x5c4a32);
          g.fillRect(cx-6, cy-22+wb, 12, 2);  // Hat band

          // ── Face features (direction-dependent) ──
          const eyeY = cy - 12 + wb;
          if (dir === 'up') {
            // Back of head — just hair
            g.fillStyle(0x4a3a2a);
            g.fillRect(cx-7, eyeY-2, 14, 7);
          } else if (dir === 'left') {
            // Side — one eye
            g.fillStyle(0xffffff);
            g.fillRect(cx-5, eyeY-1, 3, 3);
            g.fillStyle(0x333333);
            g.fillRect(cx-5, eyeY, 2, 2);
            // Nose
            g.fillStyle(0xd0b090);
            g.fillRect(cx-7, eyeY+3, 2, 3);
            // Mouth
            g.fillStyle(0xaa7766);
            g.fillRect(cx-5, eyeY+7, 3, 1);
          } else if (dir === 'right') {
            // Side — one eye
            g.fillStyle(0xffffff);
            g.fillRect(cx+2, eyeY-1, 3, 3);
            g.fillStyle(0x333333);
            g.fillRect(cx+3, eyeY, 2, 2);
            // Nose
            g.fillStyle(0xd0b090);
            g.fillRect(cx+5, eyeY+3, 2, 3);
            // Mouth
            g.fillStyle(0xaa7766);
            g.fillRect(cx+2, eyeY+7, 3, 1);
          } else {
            // Front — both eyes
            g.fillStyle(0xffffff);
            g.fillRect(cx-5, eyeY-1, 4, 3);
            g.fillRect(cx+1, eyeY-1, 4, 3);
            g.fillStyle(0x333333);
            g.fillRect(cx-4, eyeY, 2, 2);
            g.fillRect(cx+2, eyeY, 2, 2);
            // Eyebrows
            g.fillStyle(0x4a3a2a, 0.7);
            g.fillRect(cx-5, eyeY-3, 4, 1);
            g.fillRect(cx+1, eyeY-3, 4, 1);
            // Nose
            g.fillStyle(0xd0b090);
            g.fillRect(cx-1, eyeY+3, 2, 3);
            // Mouth
            g.fillStyle(0xaa7766);
            g.fillRect(cx-2, eyeY+7, 4, 1);
          }

          // ── Arms ──
          g.fillStyle(coat, 0.9);
          g.fillRect(cx-10, cy+wb, 3, 12);
          g.fillRect(cx+7, cy+wb, 3, 12);
          // Hands
          g.fillStyle(0xe0c8a0);
          g.fillRect(cx-10, cy+11+wb, 3, 3);
          g.fillRect(cx+7, cy+11+wb, 3, 3);

          // ── Legs (walk animation) ──
          g.fillStyle(0x2a2a2a);
          if (f === 1) {
            g.fillRect(cx-5, cy+14, 4, 6); g.fillRect(cx+2, cy+13, 4, 7);
          } else if (f === 2) {
            g.fillRect(cx-5, cy+13, 4, 7); g.fillRect(cx+2, cy+14, 4, 6);
          } else {
            g.fillRect(cx-5, cy+14, 4, 6); g.fillRect(cx+1, cy+14, 4, 6);
          }
          // Shoes
          g.fillStyle(0x1a1a1a);
          g.fillRect(cx-6, cy+19, 5, 2); g.fillRect(cx+1, cy+19, 5, 2);
        });
      }
    }

    const fr = 8;
    for (let d = 0; d < 4; d++) {
      const dir = dirNames[d];
      this.anims.create({
        key: `walk-${dir}`,
        frames: [
          { key: `player_${dir}_0` },
          { key: `player_${dir}_1` },
          { key: `player_${dir}_0` },
          { key: `player_${dir}_2` },
        ],
        frameRate: fr, repeat: -1
      });
      this.anims.create({
        key: `idle-${dir}`,
        frames: [{ key: `player_${dir}_0` }],
        frameRate: 1, repeat: -1
      });
    }
  }

  _genNPCs() {
    // NPC appearance data — each character has unique visual traits
    const npcs = [
      { id:'victoria', key:'npc_victoria', skin:0xf0d0b0, body:0x8B2252, hair:0xDAA520, accent:0x6b1a3f,
        hairStyle:'updo', build:'slim', accessory:'pearls' },
      { id:'hartwell', key:'npc_hartwell', skin:0xe8c99b, body:0x2F4F4F, hair:0x696969, accent:0xffffff,
        hairStyle:'receding', build:'broad', accessory:'glasses' },
      { id:'clara',    key:'npc_clara',    skin:0xf5d5c0, body:0x4a3280, hair:0x8B4513, accent:0xdda0dd,
        hairStyle:'long', build:'slim', accessory:'ribbon' },
      { id:'price',    key:'npc_price',    skin:0xe0c090, body:0x1a1a2e, hair:0x333333, accent:0xc9a84c,
        hairStyle:'slicked', build:'broad', accessory:'tie_pin' },
      { id:'agnes',    key:'npc_agnes',    skin:0xe8c99b, body:0x2d2d2d, hair:0xaaaaaa, accent:0xf5f5f5,
        hairStyle:'bun', build:'stout', accessory:'apron' },
    ];

    const moods = ['neutral','angry','nervous','friendly'];
    const dirs = ['down','left','right','up'];
    const S = 48; // Larger sprite size

    for (const n of npcs) {
      for (const mood of moods) {
        for (const dir of dirs) {
          // Key format: npc_victoria_down, npc_victoria_left_angry, etc.
          let texKey;
          if (mood === 'neutral') {
            texKey = dir === 'down' ? n.key : `${n.key}_${dir}`;
          } else {
            texKey = dir === 'down' ? `${n.key}_${mood}` : `${n.key}_${dir}_${mood}`;
          }
          this._tex(texKey, S, S, g => {
            this._drawNPCSprite(g, S, n, mood, dir);
          });
        }
      }
    }
  }

  /** Draw a detailed NPC sprite at the given size with mood-specific features */
  _drawNPCSprite(g, S, npc, mood, facing) {
    const cx = S / 2, cy = S / 2;
    const isSlim = npc.build === 'slim';
    const isBroad = npc.build === 'broad';
    const isStout = npc.build === 'stout';
    const dir = facing || 'down';

    // Posture offset based on mood
    const postureY = mood === 'nervous' ? 1 : mood === 'angry' ? -1 : 0;
    const shoulderOff = mood === 'nervous' ? 1 : mood === 'angry' ? -1 : 0;

    // ── Body / torso ──
    const bw = isSlim ? 14 : isBroad ? 18 : 16;
    const bh = 16;
    const bx = cx - bw / 2;
    const by = cy - 2 + postureY;
    g.fillStyle(npc.body);
    g.fillRect(bx, by, bw, bh);
    // Shoulders
    g.fillRect(bx - 2, by + shoulderOff, bw + 4, 4);

    // ── Accent / collar ──
    g.fillStyle(npc.accent);
    if (npc.accessory === 'apron') {
      g.fillRect(cx - 5, by + 4, 10, bh - 4);
      g.fillStyle(npc.accent, 0.5);
      g.fillRect(cx - 3, by + 4, 6, 2);
    } else {
      // V-neck / collar
      g.fillTriangle(cx - 2, by, cx, by + 5, cx + 2, by);
    }

    // ── Neck (connects head to body) ──
    g.fillStyle(npc.skin);
    g.fillRect(cx - 4, cy - 4 + postureY, 8, 6);

    // ── Head ──
    g.fillStyle(npc.skin);
    g.fillCircle(cx, cy - 12 + postureY, 9);

    // ── Hair ──
    g.fillStyle(npc.hair);
    switch (npc.hairStyle) {
      case 'updo':
        g.fillRect(cx - 8, cy - 22 + postureY, 16, 6);
        g.fillCircle(cx, cy - 22 + postureY, 5);
        g.fillRect(cx - 9, cy - 18 + postureY, 18, 3);
        break;
      case 'receding':
        g.fillRect(cx - 7, cy - 20 + postureY, 14, 4);
        g.fillRect(cx + 4, cy - 18 + postureY, 5, 4);
        g.fillRect(cx - 9, cy - 18 + postureY, 5, 4);
        break;
      case 'long':
        g.fillRect(cx - 9, cy - 20 + postureY, 18, 6);
        g.fillRect(cx - 10, cy - 16 + postureY, 4, 14);
        g.fillRect(cx + 6, cy - 16 + postureY, 4, 14);
        break;
      case 'slicked':
        g.fillRect(cx - 8, cy - 20 + postureY, 16, 5);
        g.fillRect(cx - 8, cy - 17 + postureY, 16, 2);
        break;
      case 'bun':
        g.fillRect(cx - 7, cy - 20 + postureY, 14, 5);
        g.fillCircle(cx, cy - 21 + postureY, 4);
        break;
      default:
        g.fillRect(cx - 8, cy - 20 + postureY, 16, 5);
    }

    // ── Eyes ── mood-dependent, direction-dependent
    const eyeY = cy - 12 + postureY;
    const eyeSpacing = 4;
    if (dir === 'up') {
      // Back of head — no eyes, just hair
      g.fillStyle(npc.hair);
      g.fillRect(cx - 6, eyeY - 2, 12, 6);
    } else if (dir === 'left') {
      // Side view — one eye on the left
      g.fillStyle(0xffffff);
      g.fillRect(cx - eyeSpacing - 3, eyeY - 1, 4, 3);
      g.fillStyle(0x222222);
      g.fillRect(cx - eyeSpacing - 3, eyeY, 2, 2);
    } else if (dir === 'right') {
      // Side view — one eye on the right
      g.fillStyle(0xffffff);
      g.fillRect(cx + eyeSpacing - 1, eyeY - 1, 4, 3);
      g.fillStyle(0x222222);
      g.fillRect(cx + eyeSpacing + 1, eyeY, 2, 2);
    } else {
      // Down (front) — both eyes
      g.fillStyle(0xffffff);
      g.fillRect(cx - eyeSpacing - 2, eyeY - 1, 4, 3);
      g.fillRect(cx + eyeSpacing - 2, eyeY - 1, 4, 3);
      g.fillStyle(0x222222);
      if (mood === 'angry') {
        g.fillRect(cx - eyeSpacing - 1, eyeY, 2, 2);
        g.fillRect(cx + eyeSpacing - 1, eyeY, 2, 2);
      } else if (mood === 'nervous') {
        g.fillRect(cx - eyeSpacing - 1, eyeY - 1, 2, 3);
        g.fillRect(cx + eyeSpacing - 1, eyeY - 1, 2, 3);
      } else {
        g.fillRect(cx - eyeSpacing - 1, eyeY, 2, 2);
        g.fillRect(cx + eyeSpacing - 1, eyeY, 2, 2);
      }
    }

    // ── Eyebrows ── mood-dependent (only for down, left, right — not up)
    if (dir !== 'up') {
      g.fillStyle(npc.hair, 0.8);
    if (mood === 'angry') {
      // Angled down inward (V shape)
      g.fillRect(cx - eyeSpacing - 2, eyeY - 4, 4, 1);
      g.fillRect(cx - eyeSpacing - 1, eyeY - 3, 2, 1);
      g.fillRect(cx + eyeSpacing - 2, eyeY - 4, 4, 1);
      g.fillRect(cx + eyeSpacing - 1, eyeY - 3, 2, 1);
    } else if (mood === 'nervous') {
      // Raised unevenly
      g.fillRect(cx - eyeSpacing - 2, eyeY - 5, 4, 1);
      g.fillRect(cx + eyeSpacing - 2, eyeY - 4, 4, 1);
    } else if (mood === 'friendly') {
      // Relaxed, slightly raised
      g.fillRect(cx - eyeSpacing - 2, eyeY - 4, 4, 1);
      g.fillRect(cx + eyeSpacing - 2, eyeY - 4, 4, 1);
    } else {
      // Neutral — flat
      g.fillRect(cx - eyeSpacing - 2, eyeY - 3, 4, 1);
      g.fillRect(cx + eyeSpacing - 2, eyeY - 3, 4, 1);
    }
    } // end if dir !== 'up'

    // ── Mouth ── mood-dependent (only visible from front and sides)
    if (dir !== 'up') {
    const mouthY = cy - 7 + postureY;
    const mouthX = dir === 'left' ? cx - 3 : dir === 'right' ? cx + 1 : cx - 2;
    const mouthW = dir === 'down' ? 4 : 3;
    g.fillStyle(0x993333);
    if (mood === 'angry') {
      g.fillRect(mouthX, mouthY + 1, mouthW, 1);
    } else if (mood === 'nervous') {
      g.fillRect(mouthX, mouthY, mouthW, 2);
    } else if (mood === 'friendly') {
      g.fillRect(mouthX - 1, mouthY, mouthW + 2, 1);
      g.fillRect(mouthX, mouthY + 1, mouthW, 1);
    } else {
      g.fillRect(mouthX, mouthY, mouthW, 1);
    }
    } // end if dir !== 'up' (mouth)

    // ── Accessory details ──
    g.fillStyle(npc.accent);
    if (npc.accessory === 'pearls') {
      for (let i = 0; i < 5; i++) g.fillCircle(cx - 4 + i * 2, by - 1, 1);
    } else if (npc.accessory === 'glasses') {
      g.lineStyle(1, 0xaaaaaa);
      g.strokeCircle(cx - eyeSpacing, eyeY, 3);
      g.strokeCircle(cx + eyeSpacing, eyeY, 3);
      g.lineBetween(cx - eyeSpacing + 3, eyeY, cx + eyeSpacing - 3, eyeY);
    } else if (npc.accessory === 'ribbon') {
      g.fillStyle(0xdda0dd);
      g.fillRect(cx + 5, cy - 18 + postureY, 4, 3);
    } else if (npc.accessory === 'tie_pin') {
      g.fillStyle(0xc9a84c);
      g.fillCircle(cx, by + 6, 2);
    }

    // ── Legs ──
    g.fillStyle(0x2a2a2a);
    g.fillRect(cx - 5, cy + 14 + postureY, 4, 6);
    g.fillRect(cx + 1, cy + 14 + postureY, 4, 6);
    // Shoes
    g.fillStyle(0x1a1a1a);
    g.fillRect(cx - 6, cy + 19 + postureY, 5, 2);
    g.fillRect(cx + 1, cy + 19 + postureY, 5, 2);

    // ── Arms ── mood-dependent posture
    g.fillStyle(npc.body, 0.9);
    if (mood === 'angry') {
      // Arms crossed
      g.fillRect(bx - 3, by + 6, 3, 8);
      g.fillRect(bx + bw, by + 6, 3, 8);
      g.fillStyle(npc.skin);
      g.fillRect(bx + 1, by + 8, bw - 2, 2);
    } else if (mood === 'nervous') {
      // Hands together / wringing
      g.fillRect(bx - 3, by + 3, 3, 10);
      g.fillRect(bx + bw, by + 3, 3, 10);
      g.fillStyle(npc.skin);
      g.fillRect(cx - 2, by + bh, 4, 3);
    } else {
      // Arms at sides
      g.fillRect(bx - 3, by + 2, 3, 12);
      g.fillRect(bx + bw, by + 2, 3, 12);
    }
  }

  _genPortraits() {
    const npcs = [
      { id:'victoria', skin:0xf0d0b0, body:0x8B2252, hair:0xDAA520, accent:0x6b1a3f,
        hairStyle:'updo', build:'slim', accessory:'pearls' },
      { id:'hartwell', skin:0xe8c99b, body:0x2F4F4F, hair:0x696969, accent:0xffffff,
        hairStyle:'receding', build:'broad', accessory:'glasses' },
      { id:'clara', skin:0xf5d5c0, body:0x4a3280, hair:0x8B4513, accent:0xdda0dd,
        hairStyle:'long', build:'slim', accessory:'ribbon' },
      { id:'price', skin:0xe0c090, body:0x1a1a2e, hair:0x333333, accent:0xc9a84c,
        hairStyle:'slicked', build:'broad', accessory:'tie_pin' },
      { id:'agnes', skin:0xe8c99b, body:0x2d2d2d, hair:0xaaaaaa, accent:0xf5f5f5,
        hairStyle:'bun', build:'stout', accessory:'apron' },
    ];

    const moods = ['neutral','angry','nervous','friendly'];
    const PW = 128, PH = 160;

    for (const npc of npcs) {
      for (const mood of moods) {
        const texKey = mood === 'neutral' ? `portrait_${npc.id}` : `portrait_${npc.id}_${mood}`;
        this._tex(texKey, PW, PH, g => {
          this._drawPortrait(g, PW, PH, npc, mood);
        });
      }
    }
  }

  _drawPortrait(g, W, H, npc, mood) {
    const cx = W / 2, cy = H / 2 - 10;

    // Background — character theme color, dark
    const bgR = (npc.body >> 16) & 0xff, bgG = (npc.body >> 8) & 0xff, bgB = npc.body & 0xff;
    g.fillStyle(Phaser.Display.Color.GetColor(
      Math.max(0, Math.floor(bgR * 0.3)),
      Math.max(0, Math.floor(bgG * 0.3)),
      Math.max(0, Math.floor(bgB * 0.3))
    ));
    g.fillRect(0, 0, W, H);
    // Vignette edges
    g.fillStyle(0x000000, 0.3);
    g.fillRect(0, 0, 8, H); g.fillRect(W - 8, 0, 8, H);
    g.fillRect(0, 0, W, 6); g.fillRect(0, H - 6, W, 6);

    // Head tilt based on mood
    const tiltX = mood === 'nervous' ? 3 : mood === 'angry' ? -2 : 0;
    const headCx = cx + tiltX;

    // ── Shoulders / upper body ──
    const bodyTop = cy + 30;
    g.fillStyle(npc.body);
    // Shoulders curve
    g.fillRect(cx - 40, bodyTop + 8, 80, H - bodyTop - 8);
    g.fillRect(cx - 35, bodyTop, 70, 10);
    g.fillCircle(cx - 35, bodyTop + 5, 8);
    g.fillCircle(cx + 35, bodyTop + 5, 8);

    // Collar / neckline
    g.fillStyle(npc.accent);
    g.fillTriangle(cx - 8, bodyTop, cx, bodyTop + 18, cx + 8, bodyTop);

    // Accessory on body
    if (npc.accessory === 'apron') {
      g.fillStyle(npc.accent, 0.7);
      g.fillRect(cx - 20, bodyTop + 14, 40, H - bodyTop - 14);
      g.fillStyle(npc.accent);
      g.fillRect(cx - 14, bodyTop + 14, 28, 4);
    } else if (npc.accessory === 'tie_pin') {
      g.fillStyle(0xc9a84c);
      g.fillCircle(cx, bodyTop + 20, 3);
      g.fillStyle(0xb0903a);
      g.fillCircle(cx, bodyTop + 20, 2);
    } else if (npc.accessory === 'pearls') {
      g.fillStyle(0xf5f0e8);
      for (let i = 0; i < 9; i++) {
        g.fillCircle(cx - 12 + i * 3, bodyTop - 2, 2);
      }
    }

    // ── Neck ──
    g.fillStyle(npc.skin);
    g.fillRect(headCx - 8, cy + 22, 16, 12);

    // ── Head (oval face) ──
    g.fillStyle(npc.skin);
    g.fillCircle(headCx, cy, 28);
    // Jaw — make face slightly oval
    g.fillRect(headCx - 22, cy, 44, 18);
    g.fillCircle(headCx, cy + 16, 20);

    // ── Hair ──
    g.fillStyle(npc.hair);
    switch (npc.hairStyle) {
      case 'updo':
        g.fillRect(headCx - 26, cy - 30, 52, 18);
        g.fillCircle(headCx, cy - 34, 14);
        g.fillRect(headCx - 28, cy - 20, 56, 6);
        break;
      case 'receding':
        g.fillRect(headCx - 20, cy - 28, 40, 10);
        g.fillRect(headCx + 18, cy - 22, 12, 12);
        g.fillRect(headCx - 30, cy - 22, 12, 12);
        break;
      case 'long':
        g.fillRect(headCx - 28, cy - 28, 56, 16);
        g.fillRect(headCx - 30, cy - 16, 10, 42);
        g.fillRect(headCx + 20, cy - 16, 10, 42);
        break;
      case 'slicked':
        g.fillRect(headCx - 24, cy - 28, 48, 14);
        g.fillRect(headCx - 24, cy - 18, 48, 4);
        break;
      case 'bun':
        g.fillRect(headCx - 22, cy - 28, 44, 14);
        g.fillCircle(headCx, cy - 32, 10);
        break;
    }

    // ── Eyes ──
    const eyeY = cy - 2;
    const eyeSpacing = 12;
    // Eye whites
    g.fillStyle(0xffffff);
    const eyeW = mood === 'nervous' ? 10 : 8;
    const eyeH = mood === 'nervous' ? 8 : 6;
    g.fillRect(headCx - eyeSpacing - eyeW / 2, eyeY - eyeH / 2, eyeW, eyeH);
    g.fillRect(headCx + eyeSpacing - eyeW / 2, eyeY - eyeH / 2, eyeW, eyeH);

    // Pupils
    g.fillStyle(0x332211);
    const pupilSize = mood === 'nervous' ? 3 : 4;
    const pupilOff = mood === 'angry' ? 1 : 0;
    g.fillCircle(headCx - eyeSpacing + pupilOff, eyeY + pupilOff, pupilSize);
    g.fillCircle(headCx + eyeSpacing + pupilOff, eyeY + pupilOff, pupilSize);
    // Highlight
    g.fillStyle(0xffffff);
    g.fillRect(headCx - eyeSpacing - 1, eyeY - 2, 2, 2);
    g.fillRect(headCx + eyeSpacing - 1, eyeY - 2, 2, 2);

    // ── Eyebrows ──
    g.fillStyle(npc.hair, 0.9);
    if (mood === 'angry') {
      // Angled inward (V-frown)
      g.fillRect(headCx - eyeSpacing - 5, eyeY - 9, 10, 2);
      g.fillRect(headCx - eyeSpacing - 3, eyeY - 8, 6, 2);
      g.fillRect(headCx + eyeSpacing - 5, eyeY - 9, 10, 2);
      g.fillRect(headCx + eyeSpacing - 3, eyeY - 8, 6, 2);
    } else if (mood === 'nervous') {
      // One raised
      g.fillRect(headCx - eyeSpacing - 5, eyeY - 12, 10, 2);
      g.fillRect(headCx + eyeSpacing - 5, eyeY - 9, 10, 2);
    } else if (mood === 'friendly') {
      // Gently arched
      g.fillRect(headCx - eyeSpacing - 5, eyeY - 10, 10, 2);
      g.fillRect(headCx + eyeSpacing - 5, eyeY - 10, 10, 2);
    } else {
      g.fillRect(headCx - eyeSpacing - 5, eyeY - 9, 10, 2);
      g.fillRect(headCx + eyeSpacing - 5, eyeY - 9, 10, 2);
    }

    // ── Nose ──
    g.fillStyle(Phaser.Display.Color.GetColor(
      Math.max(0, ((npc.skin >> 16) & 0xff) - 20),
      Math.max(0, ((npc.skin >> 8) & 0xff) - 15),
      Math.max(0, (npc.skin & 0xff) - 15)
    ));
    g.fillRect(headCx - 2, eyeY + 6, 4, 8);
    g.fillRect(headCx - 3, eyeY + 12, 6, 2);

    // ── Mouth ──
    if (mood === 'angry') {
      g.fillStyle(0x883333);
      g.fillRect(headCx - 8, cy + 18, 16, 3);
      g.fillStyle(0x662222);
      g.fillRect(headCx - 9, cy + 17, 2, 2);
      g.fillRect(headCx + 7, cy + 17, 2, 2);
    } else if (mood === 'nervous') {
      g.fillStyle(0x994444);
      g.fillRect(headCx - 6, cy + 17, 12, 5);
      g.fillStyle(0x222222);
      g.fillRect(headCx - 4, cy + 18, 8, 3);
    } else if (mood === 'friendly') {
      g.fillStyle(0xaa5555);
      g.fillRect(headCx - 10, cy + 17, 20, 3);
      g.fillRect(headCx - 8, cy + 19, 16, 2);
    } else {
      g.fillStyle(0x884444);
      g.fillRect(headCx - 7, cy + 18, 14, 2);
    }

    // ── Glasses (Hartwell) ──
    if (npc.accessory === 'glasses') {
      g.lineStyle(2, 0xaaaaaa, 0.8);
      g.strokeCircle(headCx - eyeSpacing, eyeY, 8);
      g.strokeCircle(headCx + eyeSpacing, eyeY, 8);
      g.lineBetween(headCx - eyeSpacing + 8, eyeY, headCx + eyeSpacing - 8, eyeY);
      g.lineBetween(headCx - eyeSpacing - 8, eyeY - 2, headCx - 28, eyeY - 6);
      g.lineBetween(headCx + eyeSpacing + 8, eyeY - 2, headCx + 28, eyeY - 6);
    }

    // ── Ribbon (Clara) ──
    if (npc.accessory === 'ribbon') {
      g.fillStyle(0xdda0dd);
      g.fillRect(headCx + 16, cy - 22, 10, 6);
      g.fillTriangle(headCx + 16, cy - 18, headCx + 21, cy - 14, headCx + 26, cy - 18);
    }
  }

  _genEvidence() {
    const items = {
      brandy_glass: (g,cx,cy) => {
        g.fillStyle(0xc9a84c); g.fillRect(cx-3,cy-6,6,8);
        g.fillStyle(0x8B4513); g.fillRect(cx-2,cy-4,4,4);
        g.fillStyle(0xc9a84c); g.fillRect(cx-1,cy+2,2,4); g.fillRect(cx-3,cy+5,6,2);
      },
      prescription_pad: (g,cx,cy) => {
        g.fillStyle(0xf5f5dc); g.fillRect(cx-5,cy-6,10,12);
        g.fillStyle(0x333333); g.fillRect(cx-3,cy-4,6,1); g.fillRect(cx-3,cy-2,4,1);
        g.fillStyle(0xcc3333); g.fillRect(cx+2,cy-6,3,3);
      },
      foxglove_cuttings: (g,cx,cy) => {
        g.fillStyle(0x228B22); g.fillRect(cx,cy-2,2,10);
        g.fillStyle(0xDA70D6); g.fillRect(cx-2,cy-6,3,3); g.fillRect(cx+1,cy-5,3,3);
      },
      edmunds_letter: (g,cx,cy) => {
        g.fillStyle(0xf5f0e0); g.fillRect(cx-5,cy-5,10,10);
        g.fillStyle(0x333333); g.fillRect(cx-3,cy-3,6,1); g.fillRect(cx-3,cy-1,5,1);
        g.fillStyle(0x8B0000); g.fillRect(cx+2,cy+3,3,2);
      },
      love_letter: (g,cx,cy) => {
        g.fillStyle(0xffe4e1); g.fillRect(cx-5,cy-5,10,10);
        g.fillStyle(0xcc3366); g.fillRect(cx-1,cy-3,2,4); g.fillRect(cx-2,cy-2,4,2);
      },
      business_documents: (g,cx,cy) => {
        g.fillStyle(0xd4c5a9); g.fillRect(cx-5,cy-6,10,12);
        g.fillStyle(0xc9a84c); g.fillRect(cx-4,cy-5,8,2);
        g.fillStyle(0x333333); g.fillRect(cx-3,cy-2,6,1); g.fillRect(cx-3,cy,5,1);
      },
      agnes_diary: (g,cx,cy) => {
        g.fillStyle(0x8B4513); g.fillRect(cx-5,cy-6,10,12);
        g.fillStyle(0xf5f0e0); g.fillRect(cx-4,cy-5,8,10);
        g.fillStyle(0xc9a84c); g.fillRect(cx-5,cy-6,2,12);
      },
      claras_manuscript: (g,cx,cy) => {
        g.fillStyle(0xf5f5f5); g.fillRect(cx-5,cy-6,10,12);
        g.fillStyle(0x666666); g.fillRect(cx-3,cy-4,5,1); g.fillRect(cx-3,cy-2,6,1);
        g.fillRect(cx-3,cy,4,1); g.fillRect(cx-3,cy+2,5,1);
      },
      burnt_note: (g,cx,cy) => {
        g.fillStyle(0x3a2a1a); g.fillRect(cx-5,cy-5,10,10);
        g.fillStyle(0x5a4a3a); g.fillRect(cx-4,cy-4,8,8);
        g.fillStyle(0xff6600); g.fillRect(cx-5,cy+2,3,3);
      },
      muddy_footprints: (g,cx,cy) => {
        g.fillStyle(0x4a3a2a); g.fillRect(cx-3,cy-6,5,4); g.fillRect(cx+1,cy-1,5,4);
      },
      digitalis_vial: (g,cx,cy) => {
        g.fillStyle(0xaaddaa); g.fillRect(cx-2,cy-6,4,10);
        g.fillStyle(0x88bb88); g.fillRect(cx-2,cy-2,4,6);
        g.fillStyle(0x666666); g.fillRect(cx-2,cy-7,4,2);
      },
      victoria_telegram: (g,cx,cy) => {
        g.fillStyle(0xf5f0d0); g.fillRect(cx-5,cy-4,10,8);
        g.fillStyle(0xc9a84c); g.fillRect(cx-5,cy-5,10,2);
        g.fillStyle(0x333333); g.fillRect(cx-3,cy-2,6,1); g.fillRect(cx-3,cy,5,1);
      }
    };
    for (const [key, draw] of Object.entries(items)) {
      this._tex('ev_'+key, 16, 16, g => draw(g, 8, 8));
    }
    this._tex('ev_glow', 24, 24, g => {
      g.fillStyle(0xc9a84c, 0.3);
      g.fillCircle(12, 12, 10);
    });
  }

  _genTiles() {
    // Isometric tile dimensions
    const TW = 64, TH = 48, TD = 24; // width, height (diamond), depth (wall sides)
    const hw = TW / 2, hh = TH / 2;

    // Helper: draw a diamond (top surface of a tile)
    const diamond = (g, cx, cy, color, alpha = 1) => {
      g.fillStyle(color, alpha);
      g.beginPath();
      g.moveTo(cx, cy - hh); g.lineTo(cx + hw, cy); g.lineTo(cx, cy + hh); g.lineTo(cx - hw, cy);
      g.closePath(); g.fillPath();
    };

    // Helper: draw a diamond outline
    const diamondStroke = (g, cx, cy, color, width = 1, alpha = 1) => {
      g.lineStyle(width, color, alpha);
      g.beginPath();
      g.moveTo(cx, cy - hh); g.lineTo(cx + hw, cy); g.lineTo(cx, cy + hh); g.lineTo(cx - hw, cy);
      g.closePath(); g.strokePath();
    };

    // Helper: darken a color
    const dk = (c, f) => {
      const r = Math.floor(((c>>16)&0xff)*f);
      const gv = Math.floor(((c>>8)&0xff)*f);
      const b = Math.floor((c&0xff)*f);
      return (r<<16)|(gv<<8)|b;
    };

    // Floor tile — wood floorboards
    this._tex('tile_floor', TW, TH, g => {
      const base = 0x3d3225;
      diamond(g, hw, hh, base);
      diamondStroke(g, hw, hh, dk(base, 0.7), 1, 0.5);
      // Plank lines across the diamond
      g.lineStyle(1, dk(base, 0.8), 0.4);
      for (let i = -2; i <= 2; i++) {
        const oy = i * 8;
        g.lineBetween(hw - 20 + Math.abs(i)*4, hh + oy, hw + 20 - Math.abs(i)*4, hh + oy);
      }
    });

    // Wall tile — isometric block with visible sides
    this._tex('tile_wall', TW, TH + TD, g => {
      const top = 0x2d1117, left = dk(0x3a1520, 0.6), right = dk(0x3a1520, 0.8);
      const cy = hh;
      // Left face
      g.fillStyle(left);
      g.beginPath();
      g.moveTo(0, cy); g.lineTo(hw, cy + hh); g.lineTo(hw, cy + hh + TD); g.lineTo(0, cy + TD);
      g.closePath(); g.fillPath();
      // Right face
      g.fillStyle(right);
      g.beginPath();
      g.moveTo(TW, cy); g.lineTo(hw, cy + hh); g.lineTo(hw, cy + hh + TD); g.lineTo(TW, cy + TD);
      g.closePath(); g.fillPath();
      // Top face
      diamond(g, hw, cy, top);
      // Brick lines on left face
      g.lineStyle(1, dk(left, 0.7), 0.3);
      g.lineBetween(4, cy + 8, hw - 4, cy + hh + 4);
      g.lineBetween(4, cy + 16, hw - 4, cy + hh + 12);
    });

    // Carpet tile — rich burgundy with gold trim
    this._tex('tile_carpet', TW, TH, g => {
      diamond(g, hw, hh, 0x4a1a2a);
      // Inner diamond pattern
      g.lineStyle(1, 0xc9a84c, 0.15);
      g.beginPath();
      g.moveTo(hw, hh - 16); g.lineTo(hw + 22, hh); g.lineTo(hw, hh + 16); g.lineTo(hw - 22, hh);
      g.closePath(); g.strokePath();
      g.beginPath();
      g.moveTo(hw, hh - 10); g.lineTo(hw + 14, hh); g.lineTo(hw, hh + 10); g.lineTo(hw - 14, hh);
      g.closePath(); g.strokePath();
    });

    // Grass tile
    this._tex('tile_grass', TW, TH, g => {
      diamond(g, hw, hh, 0x1a3a1a);
      // Speckles
      g.fillStyle(0x1f441f);
      for (let i = 0; i < 12; i++) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * 16;
        const px = hw + Math.cos(angle) * r;
        const py = hh + Math.sin(angle) * r * 0.75; // squish for iso
        g.fillRect(px, py, 2, 3);
      }
    });

    // Kitchen floor — checkerboard diamonds
    this._tex('tile_kitchen_floor', TW, TH, g => {
      diamond(g, hw, hh, 0x3a3530);
      // Inner smaller diamonds for checkerboard effect
      g.fillStyle(0x454038, 0.6);
      g.beginPath();
      g.moveTo(hw, hh - 12); g.lineTo(hw + 16, hh); g.lineTo(hw, hh + 12); g.lineTo(hw - 16, hh);
      g.closePath(); g.fillPath();
    });

    // Upper floor tile — slightly different shade
    this._tex('tile_upper_floor', TW, TH, g => {
      diamond(g, hw, hh, 0x3a2e22);
      diamondStroke(g, hw, hh, 0x302518, 1, 0.5);
      g.lineStyle(1, 0x322a1e, 0.3);
      for (let i = -2; i <= 2; i++) {
        const oy = i * 8;
        g.lineBetween(hw - 18 + Math.abs(i)*4, hh + oy, hw + 18 - Math.abs(i)*4, hh + oy);
      }
    });
  }

  _genFurniture() {
    const dk = (c,f) => { const r=Math.floor(((c>>16)&0xff)*f); const gv=Math.floor(((c>>8)&0xff)*f); const b=Math.floor((c&0xff)*f); return (r<<16)|(gv<<8)|b; };

    // Helper: draw an iso box. The box bottom-center is at (cx, baseY).
    // hw/hh = half-width/half-height of the top diamond, depth = side height.
    const isoBox = (g, cx, baseY, hw, hh, depth, topC, leftC, rightC) => {
      const topY = baseY - depth; // top of the side faces
      const diamondY = topY - hh; // center of the top diamond
      // Left face
      g.fillStyle(leftC); g.beginPath();
      g.moveTo(cx-hw, topY); g.lineTo(cx, topY+hh); g.lineTo(cx, baseY+hh); g.lineTo(cx-hw, baseY);
      g.closePath(); g.fillPath();
      // Right face
      g.fillStyle(rightC); g.beginPath();
      g.moveTo(cx+hw, topY); g.lineTo(cx, topY+hh); g.lineTo(cx, baseY+hh); g.lineTo(cx+hw, baseY);
      g.closePath(); g.fillPath();
      // Top diamond
      g.fillStyle(topC); g.beginPath();
      g.moveTo(cx, diamondY); g.lineTo(cx+hw, topY); g.lineTo(cx, topY+hh); g.lineTo(cx-hw, topY);
      g.closePath(); g.fillPath();
      return { topY, diamondY }; // useful for placing items on top
    };

    // Iso slope ratio (must match tile: hh/hw = 24/32 = 0.75)
    const S = 0.75;

    // Helper: draw a parallelogram on the RIGHT face of an iso box.
    // (x, y) is the top-left corner; w = horizontal extent; h = vertical extent.
    // The right face slopes: going right, Y decreases by S per pixel.
    const rightFaceRect = (g, x, y, w, h, color, alpha) => {
      g.fillStyle(color, alpha ?? 1);
      g.beginPath();
      g.moveTo(x, y); g.lineTo(x+w, y - w*S); g.lineTo(x+w, y - w*S + h); g.lineTo(x, y+h);
      g.closePath(); g.fillPath();
    };

    // Helper: draw a parallelogram on the LEFT face.
    // Going left (decreasing x), Y decreases by S per pixel.
    const leftFaceRect = (g, x, y, w, h, color, alpha) => {
      g.fillStyle(color, alpha ?? 1);
      g.beginPath();
      g.moveTo(x, y); g.lineTo(x-w, y - w*S); g.lineTo(x-w, y - w*S + h); g.lineTo(x, y+h);
      g.closePath(); g.fillPath();
    };

    // Helper: draw a small diamond on the top face (for items sitting on top).
    const topDiamond = (g, cx, cy, hw2, hh2, color, alpha) => {
      g.fillStyle(color, alpha ?? 1);
      g.beginPath();
      g.moveTo(cx, cy-hh2); g.lineTo(cx+hw2, cy); g.lineTo(cx, cy+hh2); g.lineTo(cx-hw2, cy);
      g.closePath(); g.fillPath();
    };

    // ═══════════════════════════════════════════════════════════
    // All furniture uses hw:hh in 4:3 ratio. baseY = canvasH - hh.
    // ═══════════════════════════════════════════════════════════

    // Desk — hw=24, hh=18, depth=10
    this._tex('furn_desk', 48, 54, g => {
      const wood = 0x5c3a1e;
      const hw=24, hh=18, depth=10, cx=24, baseY=54-hh;
      g.fillStyle(dk(wood,0.4));
      g.fillRect(cx-hw+2, baseY+2, 2, 8); g.fillRect(cx+hw-4, baseY-6, 2, 8);
      const { topY, diamondY } = isoBox(g, cx, baseY, hw, hh, depth, wood, dk(wood,0.55), dk(wood,0.75));
      // Papers on top — small diamond
      topDiamond(g, cx-2, diamondY+4, 8, 6, 0xf5f0e0, 0.9);
      topDiamond(g, cx+1, diamondY+2, 8, 6, 0xe8e0d0, 0.8);
      // Inkwell on top
      g.fillStyle(0x222233); g.fillCircle(cx+10, diamondY+4, 2);
      // Drawer — right face parallelogram, positioned below center seam
      const rFaceTop = topY + hh; // Y of right face at center (cx)
      rightFaceRect(g, cx+2, rFaceTop + 2, 14, 3, 0xc9a84c);
    });

    // Bookshelf — hw=24, hh=18, depth=24
    this._tex('furn_bookshelf', 48, 60, g => {
      const wood = 0x4a2e16;
      const hw=24, hh=18, depth=24, cx=24, baseY=60-hh;
      const { topY } = isoBox(g, cx, baseY, hw, hh, depth, wood, dk(wood,0.45), dk(wood,0.65));
      const rFaceTop = topY + hh; // right face top at center seam
      const lFaceTop = topY + hh; // left face top at center seam
      // Shelf lines on right face
      for (let i = 1; i <= 2; i++) {
        rightFaceRect(g, cx+2, rFaceTop + i*7, hw-4, 1, dk(wood,0.3));
      }
      // Shelf lines on left face
      for (let i = 1; i <= 2; i++) {
        leftFaceRect(g, cx-2, lFaceTop + i*7, hw-4, 1, dk(wood,0.3));
      }
      // Books on right face — start from center seam going right
      const cols = [0x8B0000,0x00008B,0x006400,0x8B8000,0x4B0082,0x800020,0xDAA520];
      for (let row = 0; row < 3; row++) {
        for (let i = 0; i < 3; i++) {
          rightFaceRect(g, cx+2+i*6, rFaceTop+1+row*7, 5, 5, cols[(row*3+i) % cols.length]);
        }
      }
      // Books on left face
      for (let row = 0; row < 3; row++) {
        for (let i = 0; i < 3; i++) {
          leftFaceRect(g, cx-2-i*6, lFaceTop+1+row*7, 5, 5, cols[(row*3+i+3) % cols.length]);
        }
      }
    });

    // Table — hw=20, hh=15, depth=4
    this._tex('furn_table', 40, 44, g => {
      const wood = 0x6b4423;
      const hw=20, hh=15, depth=4, cx=20, baseY=44-hh;
      g.fillStyle(dk(wood,0.45));
      g.fillRect(cx-hw+4, baseY-2, 2, 12); g.fillRect(cx+hw-6, baseY-8, 2, 12);
      g.fillRect(cx-4, baseY+2, 2, 8); g.fillRect(cx+4, baseY, 2, 8);
      isoBox(g, cx, baseY, hw, hh, depth, wood, dk(wood,0.55), dk(wood,0.75));
    });

    // Fireplace — hw=24, hh=18, depth=22
    this._tex('furn_fireplace', 48, 64, g => {
      const stone = 0x666666;
      const hw=24, hh=18, depth=22, cx=24, baseY=64-hh;
      const { topY } = isoBox(g, cx, baseY, hw, hh, depth, stone, dk(stone,0.45), dk(stone,0.65));
      // Mantelpiece cap
      isoBox(g, cx, topY-2, 20, 15, 3, dk(stone,1.05), dk(stone,0.5), dk(stone,0.7));
      const rFaceTop = topY + hh; // right face Y at center seam
      // Fire opening — right face parallelogram
      rightFaceRect(g, cx+3, rFaceTop+2, 16, 12, 0x1a0500, 0.9);
      // Flames on right face
      rightFaceRect(g, cx+5, rFaceTop+8, 8, 5, 0xff6600, 0.7);
      rightFaceRect(g, cx+7, rFaceTop+6, 6, 4, 0xffaa00, 0.5);
      // Fire opening — left face parallelogram
      leftFaceRect(g, cx-3, rFaceTop+2, 16, 12, 0x1a0500, 0.9);
      // Flames on left face
      leftFaceRect(g, cx-5, rFaceTop+8, 8, 5, 0xff6600, 0.5);
    });

    // Plant — hw=8, hh=6, depth=8
    this._tex('furn_plant', 16, 36, g => {
      const terra = 0x8B4513;
      const hw=8, hh=6, depth=8, cx=8, baseY=36-hh;
      isoBox(g, cx, baseY, hw, hh, depth, terra, dk(terra,0.6), dk(terra,0.8));
      g.fillStyle(0x1a6a1a); g.fillCircle(cx, 12, 8);
      g.fillStyle(0x228B22); g.fillCircle(cx-3, 9, 5);
      g.fillStyle(0x2a9a2a); g.fillCircle(cx+3, 8, 4);
      g.fillStyle(0x1e7a1e); g.fillCircle(cx, 5, 4);
    });

    // Bed — hw=28, hh=21, depth=10
    this._tex('furn_bed', 56, 60, g => {
      const frame = 0x5c3a1e;
      const hw=28, hh=21, depth=10, cx=28, baseY=60-hh;
      isoBox(g, cx, baseY, hw, hh, depth, frame, dk(frame,0.5), dk(frame,0.7));
      const topY = baseY - depth;
      // Blanket (overrides top face)
      topDiamond(g, cx, topY, hw, hh, 0x4a1a2a);
      // Pillow
      topDiamond(g, cx, topY-2, hw*0.5, hh*0.5, 0xf0f0f0);
      // Headboard — left face extension
      leftFaceRect(g, cx, topY-hh, 0, 8, dk(frame,0.35)); // zero-width won't draw
      g.fillStyle(dk(frame,0.35));
      g.beginPath(); g.moveTo(cx-hw, topY-8); g.lineTo(cx, topY-hh-8); g.lineTo(cx, topY-hh); g.lineTo(cx-hw, topY);
      g.closePath(); g.fillPath();
    });

    // Stove — hw=20, hh=15, depth=14
    this._tex('furn_stove', 40, 44, g => {
      const metal = 0x555555;
      const hw=20, hh=15, depth=14, cx=20, baseY=44-hh;
      const { topY, diamondY } = isoBox(g, cx, baseY, hw, hh, depth, metal, dk(metal,0.45), dk(metal,0.7));
      // Burners on top — small circles (ok, they're round)
      g.fillStyle(0x333333);
      g.fillCircle(cx-5, diamondY+3, 3); g.fillCircle(cx+7, diamondY+5, 3);
      g.lineStyle(1, 0x222222); g.strokeCircle(cx-5, diamondY+3, 4); g.strokeCircle(cx+7, diamondY+5, 4);
      // Oven door — right face parallelogram, starting from center seam
      const rFaceTop2 = topY + hh;
      rightFaceRect(g, cx+3, rFaceTop2+2, 14, 8, dk(metal,0.5));
      // Handle on oven door
      rightFaceRect(g, cx+8, rFaceTop2+4, 6, 2, 0x888888);
      // Knobs — left face
      g.fillStyle(0xaaaaaa); g.fillCircle(cx-hw+6, topY+4, 2); g.fillCircle(cx-hw+6, topY+8, 2);
    });
  }

  _genPrompts() {
    this._tex('prompt_talk', 64, 24, g => {
      g.fillStyle(0x000000, 0.7); g.fillRect(0,0,64,24);
      g.lineStyle(1, 0xc9a84c); g.strokeRect(0,0,64,24);
    });
    this._tex('prompt_examine', 80, 24, g => {
      g.fillStyle(0x000000, 0.7); g.fillRect(0,0,80,24);
      g.lineStyle(1, 0xc9a84c); g.strokeRect(0,0,80,24);
    });
  }

  _genStairs() {
    const TW = 64, TH = 48, hw = TW/2, hh = TH/2;

    // Stairs going UP — flat treads ascending from front-right to back-left inside a diamond tile
    this._tex('tile_stairs', TW, TH, g => {
      // Base diamond fill (dark wood)
      g.fillStyle(0x3a2510);
      g.beginPath();
      g.moveTo(hw, 0); g.lineTo(TW, hh); g.lineTo(hw, TH); g.lineTo(0, hh);
      g.closePath(); g.fillPath();

      // Draw 6 step treads ascending from bottom toward top
      // Each tread is a horizontal stripe clipped to the diamond
      const numSteps = 6;
      const stepH = TH / numSteps; // ~8px per step band
      const treadColors = [0x6b4c2a, 0x7a5a35, 0x8b6b42, 0x7a5a35, 0x6b4c2a, 0x8b6b42];
      const riserColor = 0x4a2e16;

      for (let i = 0; i < numSteps; i++) {
        const y0 = TH - (i + 1) * stepH; // top of this step band
        const y1 = TH - i * stepH;       // bottom of this step band
        const riserH = 2; // thin riser line at bottom of each tread

        // Clip step tread to diamond — calculate left/right x at each y
        const xAtY = (y) => {
          // Diamond edges: top-left (hw,0)→(0,hh), top-right (hw,0)→(TW,hh)
          //                bot-left (0,hh)→(hw,TH), bot-right (TW,hh)→(hw,TH)
          let left, right;
          if (y <= hh) {
            left = hw - (y / hh) * hw;
            right = hw + (y / hh) * hw;
          } else {
            const t = (y - hh) / hh;
            left = t * hw;
            right = TW - t * hw;
          }
          return { left, right };
        };

        const top = xAtY(y0);
        const bot = xAtY(y1);

        // Tread surface (lighter wood)
        g.fillStyle(treadColors[i % treadColors.length]);
        g.beginPath();
        g.moveTo(top.left, y0);
        g.lineTo(top.right, y0);
        g.lineTo(bot.right, y1);
        g.lineTo(bot.left, y1);
        g.closePath(); g.fillPath();

        // Riser edge (dark line at the bottom of each step)
        g.fillStyle(riserColor);
        g.beginPath();
        g.moveTo(bot.left, y1 - riserH);
        g.lineTo(bot.right, y1 - riserH);
        g.lineTo(bot.right, y1);
        g.lineTo(bot.left, y1);
        g.closePath(); g.fillPath();

        // Step edge highlight (thin light line at top of each tread)
        g.lineStyle(1, 0xaa8855, 0.6);
        g.lineBetween(top.left + 1, y0, top.right - 1, y0);
      }

      // Diamond outline
      g.lineStyle(1, 0x2a1a0a, 0.5);
      g.beginPath();
      g.moveTo(hw, 0); g.lineTo(TW, hh); g.lineTo(hw, TH); g.lineTo(0, hh);
      g.closePath(); g.strokePath();

      // Up arrow indicator
      g.fillStyle(0xc9a84c, 0.55);
      g.fillTriangle(hw, 6, hw - 5, 14, hw + 5, 14);
    });

    // Stairs going DOWN — same treads but descending (darker, reversed highlight)
    this._tex('tile_stairs_down', TW, TH, g => {
      // Base diamond fill
      g.fillStyle(0x302010);
      g.beginPath();
      g.moveTo(hw, 0); g.lineTo(TW, hh); g.lineTo(hw, TH); g.lineTo(0, hh);
      g.closePath(); g.fillPath();

      const numSteps = 6;
      const stepH = TH / numSteps;
      const treadColors = [0x8b6b42, 0x6b4c2a, 0x7a5a35, 0x8b6b42, 0x6b4c2a, 0x7a5a35];
      const riserColor = 0x4a2e16;

      for (let i = 0; i < numSteps; i++) {
        const y0 = i * stepH;           // top of this step band (from top)
        const y1 = (i + 1) * stepH;     // bottom of this step band
        const riserH = 2;

        const xAtY = (y) => {
          let left, right;
          if (y <= hh) {
            left = hw - (y / hh) * hw;
            right = hw + (y / hh) * hw;
          } else {
            const t = (y - hh) / hh;
            left = t * hw;
            right = TW - t * hw;
          }
          return { left, right };
        };

        const top = xAtY(y0);
        const bot = xAtY(y1);

        // Tread surface (slightly darker for "going down" feel)
        g.fillStyle(treadColors[i % treadColors.length]);
        g.beginPath();
        g.moveTo(top.left, y0);
        g.lineTo(top.right, y0);
        g.lineTo(bot.right, y1);
        g.lineTo(bot.left, y1);
        g.closePath(); g.fillPath();

        // Riser edge
        g.fillStyle(riserColor);
        g.beginPath();
        g.moveTo(top.left, y0);
        g.lineTo(top.right, y0);
        g.lineTo(top.right, y0 + riserH);
        g.lineTo(top.left, y0 + riserH);
        g.closePath(); g.fillPath();

        // Step edge highlight
        g.lineStyle(1, 0xaa8855, 0.4);
        g.lineBetween(bot.left + 1, y1, bot.right - 1, y1);
      }

      // Diamond outline
      g.lineStyle(1, 0x2a1a0a, 0.5);
      g.beginPath();
      g.moveTo(hw, 0); g.lineTo(TW, hh); g.lineTo(hw, TH); g.lineTo(0, hh);
      g.closePath(); g.strokePath();

      // Down arrow indicator
      g.fillStyle(0xc9a84c, 0.55);
      g.fillTriangle(hw, 42, hw - 5, 34, hw + 5, 34);
    });

    // Elevated stair tiles — same art shifted up on a taller canvas to look raised
    const ELEV = 12; // pixels to raise the upper step
    this._tex('tile_stairs_upper', TW, TH + ELEV, g => {
      // Base diamond fill (dark wood) — shifted up by ELEV
      g.fillStyle(0x3a2510);
      g.beginPath();
      g.moveTo(hw, 0); g.lineTo(TW, hh); g.lineTo(hw, TH); g.lineTo(0, hh);
      g.closePath(); g.fillPath();

      const numSteps = 6;
      const stepH = TH / numSteps;
      const treadColors = [0x6b4c2a, 0x7a5a35, 0x8b6b42, 0x7a5a35, 0x6b4c2a, 0x8b6b42];
      const riserColor = 0x4a2e16;

      for (let i = 0; i < numSteps; i++) {
        const y0 = TH - (i + 1) * stepH;
        const y1 = TH - i * stepH;
        const xAtY = (y) => {
          let left, right;
          if (y <= hh) { left = hw - (y / hh) * hw; right = hw + (y / hh) * hw; }
          else { const t = (y - hh) / hh; left = t * hw; right = TW - t * hw; }
          return { left, right };
        };
        const top = xAtY(y0);
        const bot = xAtY(y1);
        g.fillStyle(treadColors[i % treadColors.length]);
        g.beginPath();
        g.moveTo(top.left, y0); g.lineTo(top.right, y0);
        g.lineTo(bot.right, y1); g.lineTo(bot.left, y1);
        g.closePath(); g.fillPath();
        g.fillStyle(riserColor);
        g.beginPath();
        g.moveTo(bot.left, y1 - 2); g.lineTo(bot.right, y1 - 2);
        g.lineTo(bot.right, y1); g.lineTo(bot.left, y1);
        g.closePath(); g.fillPath();
        g.lineStyle(1, 0xaa8855, 0.6);
        g.lineBetween(top.left + 1, y0, top.right - 1, y0);
      }

      // Side depth wall to show elevation (dark shadow)
      g.fillStyle(0x0e0806);
      g.beginPath();
      g.moveTo(0, hh); g.lineTo(hw, TH); g.lineTo(hw, TH + ELEV); g.lineTo(0, hh + ELEV);
      g.closePath(); g.fillPath();
      g.fillStyle(0x1a1008);
      g.beginPath();
      g.moveTo(hw, TH); g.lineTo(TW, hh); g.lineTo(TW, hh + ELEV); g.lineTo(hw, TH + ELEV);
      g.closePath(); g.fillPath();

      // Diamond outline
      g.lineStyle(1, 0x0a0604, 0.8);
      g.beginPath();
      g.moveTo(hw, 0); g.lineTo(TW, hh); g.lineTo(hw, TH); g.lineTo(0, hh);
      g.closePath(); g.strokePath();
      // Side edges
      g.lineStyle(1, 0x0a0604, 0.6);
      g.lineBetween(0, hh, 0, hh + ELEV);
      g.lineBetween(TW, hh, TW, hh + ELEV);
      g.lineBetween(0, hh + ELEV, hw, TH + ELEV);
      g.lineBetween(TW, hh + ELEV, hw, TH + ELEV);

      // Up arrow
      g.fillStyle(0xc9a84c, 0.55);
      g.fillTriangle(hw, 6, hw - 5, 14, hw + 5, 14);
    });

    this._tex('tile_stairs_down_upper', TW, TH + ELEV, g => {
      g.fillStyle(0x302010);
      g.beginPath();
      g.moveTo(hw, 0); g.lineTo(TW, hh); g.lineTo(hw, TH); g.lineTo(0, hh);
      g.closePath(); g.fillPath();

      const numSteps = 6;
      const stepH = TH / numSteps;
      const treadColors = [0x8b6b42, 0x6b4c2a, 0x7a5a35, 0x8b6b42, 0x6b4c2a, 0x7a5a35];
      const riserColor = 0x4a2e16;

      for (let i = 0; i < numSteps; i++) {
        const y0 = i * stepH;
        const y1 = (i + 1) * stepH;
        const xAtY = (y) => {
          let left, right;
          if (y <= hh) { left = hw - (y / hh) * hw; right = hw + (y / hh) * hw; }
          else { const t = (y - hh) / hh; left = t * hw; right = TW - t * hw; }
          return { left, right };
        };
        const top = xAtY(y0);
        const bot = xAtY(y1);
        g.fillStyle(treadColors[i % treadColors.length]);
        g.beginPath();
        g.moveTo(top.left, y0); g.lineTo(top.right, y0);
        g.lineTo(bot.right, y1); g.lineTo(bot.left, y1);
        g.closePath(); g.fillPath();
        g.fillStyle(riserColor);
        g.beginPath();
        g.moveTo(top.left, y0); g.lineTo(top.right, y0);
        g.lineTo(top.right, y0 + 2); g.lineTo(top.left, y0 + 2);
        g.closePath(); g.fillPath();
        g.lineStyle(1, 0xaa8855, 0.4);
        g.lineBetween(bot.left + 1, y1, bot.right - 1, y1);
      }

      // Side depth wall below (dark shadow)
      g.fillStyle(0x0e0806);
      g.beginPath();
      g.moveTo(0, hh); g.lineTo(hw, TH); g.lineTo(hw, TH + ELEV); g.lineTo(0, hh + ELEV);
      g.closePath(); g.fillPath();
      g.fillStyle(0x1a1008);
      g.beginPath();
      g.moveTo(hw, TH); g.lineTo(TW, hh); g.lineTo(TW, hh + ELEV); g.lineTo(hw, TH + ELEV);
      g.closePath(); g.fillPath();

      // Diamond outline
      g.lineStyle(1, 0x0a0604, 0.8);
      g.beginPath();
      g.moveTo(hw, 0); g.lineTo(TW, hh); g.lineTo(hw, TH); g.lineTo(0, hh);
      g.closePath(); g.strokePath();
      // Side edges
      g.lineStyle(1, 0x0a0604, 0.6);
      g.lineBetween(0, hh, 0, hh + ELEV);
      g.lineBetween(TW, hh, TW, hh + ELEV);
      g.lineBetween(0, hh + ELEV, hw, TH + ELEV);
      g.lineBetween(TW, hh + ELEV, hw, TH + ELEV);

      // Down arrow
      g.fillStyle(0xc9a84c, 0.55);
      g.fillTriangle(hw, 42, hw - 5, 34, hw + 5, 34);
    });

    // Dropped stair tiles — for upper floor view looking down: shadow walls on TOP of the diamond
    // The diamond is drawn at the bottom of the canvas, with a dark step face above it
    this._tex('tile_stairs_dropped', TW, TH + ELEV, g => {
      // Stair diamond (going up art) drawn shifted down by ELEV
      g.fillStyle(0x3a2510);
      g.beginPath();
      g.moveTo(hw, ELEV); g.lineTo(TW, hh + ELEV); g.lineTo(hw, TH + ELEV); g.lineTo(0, hh + ELEV);
      g.closePath(); g.fillPath();

      const numSteps = 6;
      const stepH = TH / numSteps;
      const treadColors = [0x6b4c2a, 0x7a5a35, 0x8b6b42, 0x7a5a35, 0x6b4c2a, 0x8b6b42];
      const riserColor = 0x4a2e16;
      for (let i = 0; i < numSteps; i++) {
        const y0 = TH - (i + 1) * stepH + ELEV;
        const y1 = TH - i * stepH + ELEV;
        const xAtY = (y) => {
          const ly = y - ELEV;
          let left, right;
          if (ly <= hh) { left = hw - (ly / hh) * hw; right = hw + (ly / hh) * hw; }
          else { const t = (ly - hh) / hh; left = t * hw; right = TW - t * hw; }
          return { left, right };
        };
        const top = xAtY(y0);
        const bot = xAtY(y1);
        g.fillStyle(treadColors[i % treadColors.length]);
        g.beginPath();
        g.moveTo(top.left, y0); g.lineTo(top.right, y0);
        g.lineTo(bot.right, y1); g.lineTo(bot.left, y1);
        g.closePath(); g.fillPath();
        g.fillStyle(riserColor);
        g.beginPath();
        g.moveTo(bot.left, y1 - 2); g.lineTo(bot.right, y1 - 2);
        g.lineTo(bot.right, y1); g.lineTo(bot.left, y1);
        g.closePath(); g.fillPath();
        g.lineStyle(1, 0xaa8855, 0.6);
        g.lineBetween(top.left + 1, y0, top.right - 1, y0);
      }

      // Diamond outline
      g.lineStyle(1, 0x0a0604, 0.6);
      g.beginPath();
      g.moveTo(hw, ELEV); g.lineTo(TW, hh + ELEV); g.lineTo(hw, TH + ELEV); g.lineTo(0, hh + ELEV);
      g.closePath(); g.strokePath();

      // Up arrow
      g.fillStyle(0xc9a84c, 0.55);
      g.fillTriangle(hw, 6 + ELEV, hw - 5, 14 + ELEV, hw + 5, 14 + ELEV);
    });

    this._tex('tile_stairs_down_dropped', TW, TH + ELEV, g => {
      // Stair diamond (going down art) drawn shifted down by ELEV
      g.fillStyle(0x302010);
      g.beginPath();
      g.moveTo(hw, ELEV); g.lineTo(TW, hh + ELEV); g.lineTo(hw, TH + ELEV); g.lineTo(0, hh + ELEV);
      g.closePath(); g.fillPath();

      const numSteps = 6;
      const stepH = TH / numSteps;
      const treadColors = [0x8b6b42, 0x6b4c2a, 0x7a5a35, 0x8b6b42, 0x6b4c2a, 0x7a5a35];
      const riserColor = 0x4a2e16;
      for (let i = 0; i < numSteps; i++) {
        const y0 = i * stepH + ELEV;
        const y1 = (i + 1) * stepH + ELEV;
        const xAtY = (y) => {
          const ly = y - ELEV;
          let left, right;
          if (ly <= hh) { left = hw - (ly / hh) * hw; right = hw + (ly / hh) * hw; }
          else { const t = (ly - hh) / hh; left = t * hw; right = TW - t * hw; }
          return { left, right };
        };
        const top = xAtY(y0);
        const bot = xAtY(y1);
        g.fillStyle(treadColors[i % treadColors.length]);
        g.beginPath();
        g.moveTo(top.left, y0); g.lineTo(top.right, y0);
        g.lineTo(bot.right, y1); g.lineTo(bot.left, y1);
        g.closePath(); g.fillPath();
        g.fillStyle(riserColor);
        g.beginPath();
        g.moveTo(top.left, y0); g.lineTo(top.right, y0);
        g.lineTo(top.right, y0 + 2); g.lineTo(top.left, y0 + 2);
        g.closePath(); g.fillPath();
        g.lineStyle(1, 0xaa8855, 0.4);
        g.lineBetween(bot.left + 1, y1, bot.right - 1, y1);
      }

      // Diamond outline
      g.lineStyle(1, 0x0a0604, 0.6);
      g.beginPath();
      g.moveTo(hw, ELEV); g.lineTo(TW, hh + ELEV); g.lineTo(hw, TH + ELEV); g.lineTo(0, hh + ELEV);
      g.closePath(); g.strokePath();

      // Down arrow
      g.fillStyle(0xc9a84c, 0.55);
      g.fillTriangle(hw, 42 + ELEV, hw - 5, 34 + ELEV, hw + 5, 34 + ELEV);
    });

    // Upper floor tile
    this._tex('tile_upper_floor', TW, TH, g => {
      g.fillStyle(0x3a2e22);
      g.beginPath();
      g.moveTo(hw, 0); g.lineTo(TW, hh); g.lineTo(hw, TH); g.lineTo(0, hh);
      g.closePath(); g.fillPath();
      g.lineStyle(1, 0x302518, 0.5);
      g.beginPath();
      g.moveTo(hw, 0); g.lineTo(TW, hh); g.lineTo(hw, TH); g.lineTo(0, hh);
      g.closePath(); g.strokePath();
    });
  }

  _genCrimeScene() {
    // Chalk body outline — simplified silhouette
    this._tex('crime_body_outline', 48, 64, g => {
      g.lineStyle(2, 0xcccccc, 0.8);
      // Head
      g.strokeCircle(24, 8, 6);
      // Neck
      g.lineBetween(24, 14, 24, 18);
      // Torso
      g.strokeRect(14, 18, 20, 20);
      // Left arm
      g.lineBetween(14, 20, 4, 32);
      g.lineBetween(4, 32, 2, 38);
      // Right arm
      g.lineBetween(34, 20, 44, 32);
      g.lineBetween(44, 32, 46, 38);
      // Left leg
      g.lineBetween(18, 38, 12, 52);
      g.lineBetween(12, 52, 8, 62);
      // Right leg
      g.lineBetween(30, 38, 36, 52);
      g.lineBetween(36, 52, 40, 62);
      // Faint chalk dust near outline
      g.fillStyle(0xaaaaaa, 0.15);
      g.fillCircle(24, 30, 18);
    });

    // Small blood splatter
    this._tex('crime_blood_1', 16, 16, g => {
      g.fillStyle(0x4a0000, 0.7);
      g.fillCircle(8, 8, 5);
      g.fillStyle(0x3a0000, 0.5);
      g.fillCircle(5, 6, 3);
      g.fillCircle(11, 10, 2);
      g.fillRect(3, 8, 3, 2);
    });

    // Larger blood pool
    this._tex('crime_blood_2', 24, 24, g => {
      g.fillStyle(0x3a0000, 0.6);
      g.fillCircle(12, 12, 10);
      g.fillStyle(0x4a0000, 0.5);
      g.fillCircle(12, 12, 7);
      g.fillStyle(0x2a0000, 0.4);
      g.fillCircle(10, 14, 4);
      g.fillCircle(16, 10, 3);
    });

    // Crime tape strip — yellow/black X pattern
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
