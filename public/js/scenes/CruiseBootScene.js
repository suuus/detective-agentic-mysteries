/**
 * CruiseBootScene — generates all cruise ship sprites procedurally.
 */
export default class CruiseBootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CruiseBootScene' });
  }

  preload() {
    const { width, height } = this.cameras.main;
    this.add.text(width/2, height/2 - 30, 'Death on the Meridian', {
      fontFamily: '"Playfair Display", Georgia, serif', fontSize: '24px', color: '#c9a84c'
    }).setOrigin(0.5);
    this.loadingText = this.add.text(width/2, height/2 + 10, 'Generating ship…', {
      fontFamily: '"Lora", serif', fontSize: '14px', color: '#e8dcc8'
    }).setOrigin(0.5);
  }

  create() {
    try {
      this._genTiles();
      this._genFurniture();
      this._genNPCs();
      this._genEvidence();
      this._genPlayer();
      this._genPrompts();
      this._genCrimeScene();
      console.log('CruiseBootScene: all textures generated, starting CruiseManorScene');
      this.scene.start('CruiseManorScene');
    } catch(err) {
      console.error('CruiseBootScene failed:', err);
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
          const wb = f === 1 ? -1 : f === 2 ? 1 : 0;
          const dir = dirNames[d];
          const coat = 0x5c4a32;

          // Trenchcoat (body)
          g.fillStyle(coat);
          g.fillRect(cx-7, cy-2+wb, 14, 16);
          g.fillRect(cx-9, cy-1+wb, 18, 4);
          g.fillStyle(0x6b5a3e);
          g.fillTriangle(cx-2, cy-2+wb, cx, cy+4+wb, cx+2, cy-2+wb);

          // Neck
          g.fillStyle(0xe0c8a0); g.fillRect(cx-3, cy-5+wb, 6, 5);
          // Head
          g.fillStyle(0xe0c8a0); g.fillCircle(cx, cy-12+wb, 9);

          // Hair
          g.fillStyle(0x4a3a2a);
          g.fillRect(cx-8, cy-20+wb, 16, 6);
          g.fillRect(cx-9, cy-17+wb, 18, 3);
          if (dir === 'left' || dir === 'down') g.fillRect(cx-9, cy-15+wb, 4, 5);
          if (dir === 'right' || dir === 'down') g.fillRect(cx+5, cy-15+wb, 4, 5);

          // Detective hat
          g.fillStyle(0x3a2f24);
          g.fillRect(cx-10, cy-22+wb, 20, 4);
          g.fillRect(cx-7, cy-26+wb, 14, 5);
          g.fillStyle(0x5c4a32);
          g.fillRect(cx-6, cy-22+wb, 12, 2);

          // Face features
          const eyeY = cy - 12 + wb;
          if (dir === 'up') {
            g.fillStyle(0x4a3a2a); g.fillRect(cx-7, eyeY-2, 14, 7);
          } else if (dir === 'left') {
            g.fillStyle(0xffffff); g.fillRect(cx-5, eyeY-1, 3, 3);
            g.fillStyle(0x333333); g.fillRect(cx-5, eyeY, 2, 2);
            g.fillStyle(0xd0b090); g.fillRect(cx-7, eyeY+3, 2, 3);
            g.fillStyle(0xaa7766); g.fillRect(cx-5, eyeY+7, 3, 1);
          } else if (dir === 'right') {
            g.fillStyle(0xffffff); g.fillRect(cx+2, eyeY-1, 3, 3);
            g.fillStyle(0x333333); g.fillRect(cx+3, eyeY, 2, 2);
            g.fillStyle(0xd0b090); g.fillRect(cx+5, eyeY+3, 2, 3);
            g.fillStyle(0xaa7766); g.fillRect(cx+2, eyeY+7, 3, 1);
          } else {
            g.fillStyle(0xffffff);
            g.fillRect(cx-5, eyeY-1, 4, 3); g.fillRect(cx+1, eyeY-1, 4, 3);
            g.fillStyle(0x333333);
            g.fillRect(cx-4, eyeY, 2, 2); g.fillRect(cx+2, eyeY, 2, 2);
            g.fillStyle(0x4a3a2a, 0.7);
            g.fillRect(cx-5, eyeY-3, 4, 1); g.fillRect(cx+1, eyeY-3, 4, 1);
            g.fillStyle(0xd0b090); g.fillRect(cx-1, eyeY+3, 2, 3);
            g.fillStyle(0xaa7766); g.fillRect(cx-2, eyeY+7, 4, 1);
          }

          // Arms
          g.fillStyle(coat, 0.9);
          g.fillRect(cx-10, cy+wb, 3, 12); g.fillRect(cx+7, cy+wb, 3, 12);
          g.fillStyle(0xe0c8a0);
          g.fillRect(cx-10, cy+11+wb, 3, 3); g.fillRect(cx+7, cy+11+wb, 3, 3);

          // Legs
          g.fillStyle(0x2a2a2a);
          if (f === 1) { g.fillRect(cx-5, cy+14, 4, 6); g.fillRect(cx+2, cy+13, 4, 7); }
          else if (f === 2) { g.fillRect(cx-5, cy+13, 4, 7); g.fillRect(cx+2, cy+14, 4, 6); }
          else { g.fillRect(cx-5, cy+14, 4, 6); g.fillRect(cx+1, cy+14, 4, 6); }
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
    const npcs = [
      { id:'vasquez',    key:'npc_vasquez',    skin:0xf0d0b0, body:0xf0f0f0, hair:0x1a1a1a, accent:0xcc3333,
        hairStyle:'long', build:'slim', accessory:'stethoscope' },
      { id:'harrington', key:'npc_harrington', skin:0xe8c99b, body:0x1a1a4e, hair:0xcccccc, accent:0xc9a84c,
        hairStyle:'receding', build:'broad', accessory:'epaulettes' },
      { id:'isabelle',   key:'npc_isabelle',   skin:0xf5d5c0, body:0xcc2244, hair:0xdaa520, accent:0xc9a84c,
        hairStyle:'updo', build:'slim', accessory:'pearls' },
      { id:'volkov',     key:'npc_volkov',     skin:0xe0c090, body:0x111111, hair:0x888888, accent:0xcccccc,
        hairStyle:'slicked', build:'broad', accessory:'tie_pin' },
      { id:'diego',      key:'npc_diego',      skin:0xc9a070, body:0x2a4a2a, hair:0x1a1a1a, accent:null,
        hairStyle:'short', build:'broad', accessory:null },
      { id:'lydia',      key:'npc_lydia',      skin:0xf0d8b0, body:0x4a2a6a, hair:0x0a0a0a, accent:0xc9a84c,
        hairStyle:'long', build:'slim', accessory:'pearls' },
      { id:'wells',      key:'npc_wells',      skin:0xe8c99b, body:0x4a4a4a, hair:0x6b4423, accent:0xcc0000,
        hairStyle:'receding', build:'broad', accessory:'tie_pin' },
      { id:'sofia',      key:'npc_sofia',      skin:0xf5e0d0, body:0x2a2a5a, hair:0xdaa520, accent:0xffffff,
        hairStyle:'bun', build:'slim', accessory:'apron' },
      { id:'romano',     key:'npc_romano',     skin:0xe0c090, body:0xf5f5f5, hair:0x333333, accent:0xcc0000,
        hairStyle:'short', build:'stout', accessory:'apron' },
      { id:'okafor',     key:'npc_okafor',     skin:0x8b6340, body:0x1a1a1a, hair:0x0a0a0a, accent:0xc9a84c,
        hairStyle:'short', build:'broad', accessory:'badge' },
      { id:'yuki',       key:'npc_yuki',       skin:0xf0d8b0, body:0xdd6622, hair:0x0a0a0a, accent:null,
        hairStyle:'short', build:'slim', accessory:null },
    ];

    const moods = ['neutral','angry','nervous','friendly'];
    const dirs = ['down','left','right','up'];
    const S = 48;

    for (const n of npcs) {
      for (const mood of moods) {
        for (const dir of dirs) {
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

  _drawNPCSprite(g, S, npc, mood, facing) {
    const cx = S / 2, cy = S / 2;
    const isSlim = npc.build === 'slim';
    const isBroad = npc.build === 'broad';
    const dir = facing || 'down';

    const postureY = mood === 'nervous' ? 1 : mood === 'angry' ? -1 : 0;
    const shoulderOff = mood === 'nervous' ? 1 : mood === 'angry' ? -1 : 0;

    // Body
    const bw = isSlim ? 14 : isBroad ? 18 : 16;
    const bh = 16;
    const bx = cx - bw / 2;
    const by = cy - 2 + postureY;
    g.fillStyle(npc.body);
    g.fillRect(bx, by, bw, bh);
    g.fillRect(bx - 2, by + shoulderOff, bw + 4, 4);

    // Accent / collar
    g.fillStyle(npc.accent || npc.body);
    if (npc.accessory === 'apron') {
      g.fillStyle(0xf5f5f5);
      g.fillRect(cx - 5, by + 4, 10, bh - 4);
    } else if (npc.accent) {
      g.fillTriangle(cx - 2, by, cx, by + 5, cx + 2, by);
    }

    // Neck
    g.fillStyle(npc.skin);
    g.fillRect(cx - 4, cy - 4 + postureY, 8, 6);
    // Head
    g.fillStyle(npc.skin);
    g.fillCircle(cx, cy - 12 + postureY, 9);

    // Hair
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
      default: // short
        g.fillRect(cx - 8, cy - 20 + postureY, 16, 5);
        g.fillRect(cx - 8, cy - 17 + postureY, 16, 2);
    }

    // Eyes
    const eyeY = cy - 12 + postureY;
    const eyeSpacing = 4;
    if (dir === 'up') {
      g.fillStyle(npc.hair); g.fillRect(cx - 6, eyeY - 2, 12, 6);
    } else if (dir === 'left') {
      g.fillStyle(0xffffff); g.fillRect(cx - eyeSpacing - 3, eyeY - 1, 4, 3);
      g.fillStyle(0x222222); g.fillRect(cx - eyeSpacing - 3, eyeY, 2, 2);
    } else if (dir === 'right') {
      g.fillStyle(0xffffff); g.fillRect(cx + eyeSpacing - 1, eyeY - 1, 4, 3);
      g.fillStyle(0x222222); g.fillRect(cx + eyeSpacing + 1, eyeY, 2, 2);
    } else {
      g.fillStyle(0xffffff);
      g.fillRect(cx - eyeSpacing - 2, eyeY - 1, 4, 3);
      g.fillRect(cx + eyeSpacing - 2, eyeY - 1, 4, 3);
      g.fillStyle(0x222222);
      g.fillRect(cx - eyeSpacing - 1, eyeY, 2, 2);
      g.fillRect(cx + eyeSpacing - 1, eyeY, 2, 2);
    }

    // Eyebrows
    if (dir !== 'up') {
      g.fillStyle(npc.hair, 0.8);
      if (mood === 'angry') {
        g.fillRect(cx - eyeSpacing - 2, eyeY - 4, 4, 1);
        g.fillRect(cx + eyeSpacing - 2, eyeY - 4, 4, 1);
      } else if (mood === 'nervous') {
        g.fillRect(cx - eyeSpacing - 2, eyeY - 5, 4, 1);
        g.fillRect(cx + eyeSpacing - 2, eyeY - 4, 4, 1);
      } else {
        g.fillRect(cx - eyeSpacing - 2, eyeY - 3, 4, 1);
        g.fillRect(cx + eyeSpacing - 2, eyeY - 3, 4, 1);
      }
    }

    // Mouth
    if (dir !== 'up') {
      const mouthY = cy - 7 + postureY;
      const mouthX = dir === 'left' ? cx - 3 : dir === 'right' ? cx + 1 : cx - 2;
      const mouthW = dir === 'down' ? 4 : 3;
      g.fillStyle(0x993333);
      if (mood === 'angry') g.fillRect(mouthX, mouthY + 1, mouthW, 1);
      else if (mood === 'nervous') g.fillRect(mouthX, mouthY, mouthW, 2);
      else if (mood === 'friendly') { g.fillRect(mouthX - 1, mouthY, mouthW + 2, 1); g.fillRect(mouthX, mouthY + 1, mouthW, 1); }
      else g.fillRect(mouthX, mouthY, mouthW, 1);
    }

    // Accessories
    if (npc.accessory === 'pearls') {
      g.fillStyle(0xf5f5f0);
      for (let i = 0; i < 5; i++) g.fillCircle(cx - 4 + i * 2, by - 1, 1);
    } else if (npc.accessory === 'stethoscope') {
      g.lineStyle(1, 0x888888);
      g.lineBetween(cx - 2, by + 2, cx - 4, by + 8);
      g.fillStyle(0xaaaaaa); g.fillCircle(cx - 4, by + 9, 2);
    } else if (npc.accessory === 'epaulettes') {
      g.fillStyle(0xc9a84c);
      g.fillRect(bx - 2, by + shoulderOff, 4, 3);
      g.fillRect(bx + bw - 2, by + shoulderOff, 4, 3);
    } else if (npc.accessory === 'tie_pin') {
      g.fillStyle(0xc9a84c); g.fillCircle(cx, by + 6, 2);
    } else if (npc.accessory === 'badge') {
      g.fillStyle(0xc9a84c); g.fillRect(bx + 2, by + 3, 4, 4);
      g.fillStyle(0xffffff); g.fillRect(bx + 3, by + 4, 2, 2);
    }

    // Arms
    g.fillStyle(npc.body, 0.9);
    if (mood === 'angry') {
      g.fillRect(bx - 3, by + 6, 3, 8); g.fillRect(bx + bw, by + 6, 3, 8);
      g.fillStyle(npc.skin); g.fillRect(bx + 1, by + 8, bw - 2, 2);
    } else if (mood === 'nervous') {
      g.fillRect(bx - 3, by + 3, 3, 10); g.fillRect(bx + bw, by + 3, 3, 10);
      g.fillStyle(npc.skin); g.fillRect(cx - 2, by + bh, 4, 3);
    } else {
      g.fillRect(bx - 3, by + 2, 3, 12); g.fillRect(bx + bw, by + 2, 3, 12);
    }

    // Legs
    g.fillStyle(0x2a2a2a);
    g.fillRect(cx - 5, cy + 14 + postureY, 4, 6); g.fillRect(cx + 1, cy + 14 + postureY, 4, 6);
    g.fillStyle(0x1a1a1a);
    g.fillRect(cx - 6, cy + 19 + postureY, 5, 2); g.fillRect(cx + 1, cy + 19 + postureY, 5, 2);
  }

  _genEvidence() {
    const items = {
      insulin_pen: (g,cx,cy) => {
        g.fillStyle(0xaaaaaa); g.fillRect(cx-1,cy-6,2,10);
        g.fillStyle(0x666666); g.fillRect(cx-2,cy-7,4,2);
        g.fillStyle(0xcc3333); g.fillRect(cx-1,cy+3,2,3);
      },
      potassium_vial: (g,cx,cy) => {
        g.fillStyle(0xaaddaa); g.fillRect(cx-2,cy-5,4,9);
        g.fillStyle(0x88bb88); g.fillRect(cx-2,cy-1,4,5);
        g.fillStyle(0x666666); g.fillRect(cx-2,cy-6,4,2);
      },
      fake_credentials: (g,cx,cy) => {
        g.fillStyle(0xf5f5dc); g.fillRect(cx-5,cy-5,10,10);
        g.fillStyle(0x333333); g.fillRect(cx-3,cy-3,6,1); g.fillRect(cx-3,cy-1,5,1);
        g.fillStyle(0xcc3333); g.fillRect(cx-2,cy+1,4,4);
        g.lineStyle(1,0xcc3333); g.beginPath(); g.moveTo(cx-2,cy+1); g.lineTo(cx+2,cy+5); g.strokePath();
        g.beginPath(); g.moveTo(cx+2,cy+1); g.lineTo(cx-2,cy+5); g.strokePath();
      },
      deck7_footage: (g,cx,cy) => {
        g.fillStyle(0x333333); g.fillRect(cx-4,cy-3,8,6);
        g.fillStyle(0x666666); g.fillRect(cx-3,cy-2,6,4);
        g.fillStyle(0xaaaaaa); g.fillRect(cx-1,cy-5,2,3);
      },
      medical_bag: (g,cx,cy) => {
        g.fillStyle(0x3a2a1a); g.fillRect(cx-5,cy-3,10,7);
        g.fillStyle(0x4a3a2a); g.fillRect(cx-4,cy-4,8,2);
        g.fillStyle(0xcc3333); g.fillRect(cx-1,cy-1,2,3); g.fillRect(cx-2,cy,4,1);
      },
      prenup_document: (g,cx,cy) => {
        g.fillStyle(0xf5f0e0); g.fillRect(cx-5,cy-6,10,12);
        g.fillStyle(0x333333); g.fillRect(cx-3,cy-4,6,1); g.fillRect(cx-3,cy-2,5,1);
        g.fillStyle(0xc9a84c); g.fillCircle(cx,cy+3,2);
      },
      love_notes: (g,cx,cy) => {
        g.fillStyle(0xffe4e1); g.fillRect(cx-4,cy-4,8,8);
        g.fillStyle(0xf5e0d0); g.fillRect(cx-3,cy-3,6,6);
        g.fillStyle(0xcc3366); g.fillRect(cx-1,cy-2,2,3); g.fillRect(cx-2,cy-1,4,1);
      },
      volkov_ledger: (g,cx,cy) => {
        g.fillStyle(0x2a1a0a); g.fillRect(cx-4,cy-5,8,10);
        g.fillStyle(0xf5f0e0); g.fillRect(cx-3,cy-4,6,8);
        g.fillStyle(0x333333); g.fillRect(cx-2,cy-3,4,1); g.fillRect(cx-2,cy-1,3,1);
        g.fillRect(cx-2,cy+1,4,1);
      },
      wells_meeting_note: (g,cx,cy) => {
        g.fillStyle(0xf5f0d0); g.fillRect(cx-4,cy-5,7,10);
        g.fillStyle(0x333333); g.fillRect(cx-2,cy-3,4,1); g.fillRect(cx-2,cy-1,3,1);
        g.fillStyle(0x8B4513); g.fillRect(cx+2,cy+2,2,3);
      },
      master_keycard_log: (g,cx,cy) => {
        g.fillStyle(0xf5f5f5); g.fillRect(cx-5,cy-5,10,10);
        g.fillStyle(0x333333); g.fillRect(cx-3,cy-3,6,1); g.fillRect(cx-3,cy-1,5,1);
        g.fillRect(cx-3,cy+1,6,1); g.fillRect(cx-3,cy+3,4,1);
      },
      harassment_complaint: (g,cx,cy) => {
        g.fillStyle(0xf5f0e0); g.fillRect(cx-5,cy-6,10,12);
        g.fillStyle(0x333333); g.fillRect(cx-3,cy-4,6,1); g.fillRect(cx-3,cy-2,5,1);
        g.fillStyle(0xcc3333); g.fillRect(cx-4,cy+2,8,2);
        g.fillStyle(0x333333); g.fillRect(cx-3,cy+2,6,1);
      },
      yukis_photos: (g,cx,cy) => {
        g.fillStyle(0x444444); g.fillRect(cx-4,cy-4,8,7);
        g.fillStyle(0x222222); g.fillCircle(cx,cy-1,2);
        g.fillStyle(0x666666); g.fillRect(cx+1,cy-4,2,2);
      },
      broken_camera_report: (g,cx,cy) => {
        g.fillStyle(0xf5f5dc); g.fillRect(cx-5,cy-5,10,10);
        g.fillStyle(0x444444); g.fillRect(cx-3,cy-3,5,4);
        g.fillStyle(0x222222); g.fillCircle(cx-1,cy-1,1);
        g.fillStyle(0xcc3333); g.fillRect(cx+2,cy+1,3,3);
      },
      romano_herb_list: (g,cx,cy) => {
        g.fillStyle(0xf5f0d0); g.fillRect(cx-4,cy-6,8,12);
        g.fillStyle(0x228B22); g.fillRect(cx-2,cy-4,1,1); g.fillRect(cx-2,cy-2,1,1);
        g.fillRect(cx-2,cy,1,1); g.fillRect(cx-2,cy+2,1,1);
        g.fillStyle(0x333333); g.fillRect(cx,cy-4,3,1); g.fillRect(cx,cy-2,3,1);
        g.fillRect(cx,cy,3,1); g.fillRect(cx,cy+2,3,1);
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
    // Isometric tile dimensions (same as manor)
    const TW = 64, TH = 48, TD = 24;
    const hw = TW / 2, hh = TH / 2;

    const diamond = (g, cx, cy, color, alpha = 1) => {
      g.fillStyle(color, alpha);
      g.beginPath();
      g.moveTo(cx, cy - hh); g.lineTo(cx + hw, cy); g.lineTo(cx, cy + hh); g.lineTo(cx - hw, cy);
      g.closePath(); g.fillPath();
    };
    const diamondStroke = (g, cx, cy, color, width = 1, alpha = 1) => {
      g.lineStyle(width, color, alpha);
      g.beginPath();
      g.moveTo(cx, cy - hh); g.lineTo(cx + hw, cy); g.lineTo(cx, cy + hh); g.lineTo(cx - hw, cy);
      g.closePath(); g.strokePath();
    };
    const dk = (c, f) => {
      const r = Math.floor(((c>>16)&0xff)*f);
      const gv = Math.floor(((c>>8)&0xff)*f);
      const b = Math.floor((c&0xff)*f);
      return (r<<16)|(gv<<8)|b;
    };

    // Dark steel gray with rivet dots (ship corridors)
    this._tex('tile_metal', TW, TH, g => {
      diamond(g, hw, hh, 0x3a3a40);
      diamondStroke(g, hw, hh, 0x2e2e34, 1, 0.5);
      g.fillStyle(0x4a4a50);
      g.fillCircle(hw-12, hh-6, 1); g.fillCircle(hw+12, hh-6, 1);
      g.fillCircle(hw-12, hh+6, 1); g.fillCircle(hw+12, hh+6, 1);
      g.fillCircle(hw, hh, 1);
    });
    // Warm wood planking for decks
    this._tex('tile_wood_deck', TW, TH, g => {
      diamond(g, hw, hh, 0x6b5030);
      diamondStroke(g, hw, hh, 0x5a4028, 1, 0.5);
      g.lineStyle(1, 0x5a4028, 0.4);
      for (let i = -2; i <= 2; i++) {
        const oy = i * 8;
        g.lineBetween(hw - 20 + Math.abs(i)*4, hh + oy, hw + 20 - Math.abs(i)*4, hh + oy);
      }
    });
    // Navy carpet for luxury rooms
    this._tex('tile_carpet_blue', TW, TH, g => {
      diamond(g, hw, hh, 0x1a2a4a);
      g.lineStyle(1, 0xc9a84c, 0.15);
      g.beginPath();
      g.moveTo(hw, hh-16); g.lineTo(hw+22, hh); g.lineTo(hw, hh+16); g.lineTo(hw-22, hh);
      g.closePath(); g.strokePath();
      g.beginPath();
      g.moveTo(hw, hh-10); g.lineTo(hw+14, hh); g.lineTo(hw, hh+10); g.lineTo(hw-14, hh);
      g.closePath(); g.strokePath();
    });
    // White tile for medical/kitchen
    this._tex('tile_tile_white', TW, TH, g => {
      diamond(g, hw, hh, 0xd8d8d0);
      // Checkerboard inner diamond
      g.fillStyle(0xe4e4dc, 0.6);
      g.beginPath();
      g.moveTo(hw, hh-12); g.lineTo(hw+16, hh); g.lineTo(hw, hh+12); g.lineTo(hw-16, hh);
      g.closePath(); g.fillPath();
      diamondStroke(g, hw, hh, 0xc0c0b8, 1, 0.5);
    });
    // Red carpet for casino/restaurant
    this._tex('tile_carpet_red', TW, TH, g => {
      diamond(g, hw, hh, 0x4a1a1a);
      g.lineStyle(1, 0xc9a84c, 0.15);
      g.beginPath();
      g.moveTo(hw, hh-16); g.lineTo(hw+22, hh); g.lineTo(hw, hh+16); g.lineTo(hw-22, hh);
      g.closePath(); g.strokePath();
      g.beginPath();
      g.moveTo(hw, hh-10); g.lineTo(hw+14, hh); g.lineTo(hw, hh+10); g.lineTo(hw-14, hh);
      g.closePath(); g.strokePath();
    });
    // Blue-green water
    this._tex('tile_water', TW, TH, g => {
      diamond(g, hw, hh, 0x1a4a5a);
      g.fillStyle(0x2a5a6a, 0.5);
      for (let i = 0; i < 4; i++) {
        const oy = -8 + i * 5;
        g.lineBetween(hw - 14 + i*3, hh + oy, hw - 6 + i*3, hh + oy);
      }
    });
    // Wall tile (ship bulkhead) — iso block with visible sides
    this._tex('tile_wall', TW, TH + TD, g => {
      const top = 0x2a2a30, left = dk(0x333338, 0.6), right = dk(0x333338, 0.8);
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
      // Panel lines on left face
      g.lineStyle(1, dk(left, 0.7), 0.3);
      g.lineBetween(4, cy + 8, hw - 4, cy + hh + 4);
      g.lineBetween(4, cy + 16, hw - 4, cy + hh + 12);
    });
  }

  _genFurniture() {
    // Metal desk
    this._tex('furn_ship_desk', 64, 32, g => {
      g.fillStyle(0x4a4a50); g.fillRect(0,4,64,24);
      g.fillStyle(0x3a3a40); g.fillRect(2,8,60,18);
      g.fillStyle(0x666670); g.fillRect(28,12,8,6);
    });
    // Cabin bed
    this._tex('furn_ship_bed', 48, 64, g => {
      g.fillStyle(0x4a4a50); g.fillRect(0,0,48,64);
      g.fillStyle(0xf5f5f5); g.fillRect(4,8,40,48);
      g.fillStyle(0x1a2a4a); g.fillRect(4,28,40,28);
    });
    // Dining table
    this._tex('furn_ship_table', 48, 32, g => {
      g.fillStyle(0x5c3a1e); g.fillRect(4,4,40,24);
      g.fillStyle(0x6b4423); g.fillRect(6,6,36,20);
    });
    // Bar counter
    this._tex('furn_bar', 64, 32, g => {
      g.fillStyle(0x3a2010); g.fillRect(0,4,64,24);
      g.fillStyle(0x5c3a1e); g.fillRect(2,2,60,6);
      g.fillStyle(0xc9a84c); g.fillRect(10,10,6,8); g.fillRect(26,10,6,8); g.fillRect(42,10,6,8);
    });
    // Casino slot machine
    this._tex('furn_slot_machine', 24, 32, g => {
      g.fillStyle(0xcc3333); g.fillRect(2,4,20,24);
      g.fillStyle(0x222222); g.fillRect(5,8,14,10);
      g.fillStyle(0xf5f5f5); g.fillRect(6,9,4,8); g.fillRect(11,9,4,8); g.fillRect(16,9,4,8);
      g.fillStyle(0xc9a84c); g.fillCircle(12,24,3);
    });
    // Medical examination bed
    this._tex('furn_medical_bed', 48, 64, g => {
      g.fillStyle(0xcccccc); g.fillRect(0,0,48,64);
      g.fillStyle(0xf5f5f5); g.fillRect(4,4,40,56);
      g.fillStyle(0xaaddaa); g.fillRect(4,4,40,12);
    });
    // Kitchen stove (reuse pattern)
    this._tex('furn_stove', 48, 32, g => {
      g.fillStyle(0x444444); g.fillRect(0,0,48,32);
      g.fillStyle(0x222222); g.fillCircle(16,12,6); g.fillCircle(34,12,6);
    });
    // Bridge console/computers
    this._tex('furn_console', 64, 32, g => {
      g.fillStyle(0x333338); g.fillRect(0,4,64,24);
      g.fillStyle(0x1a3a2a); g.fillRect(4,6,26,16);
      g.fillStyle(0x1a2a3a); g.fillRect(34,6,26,16);
      g.fillStyle(0x44cc66); g.fillRect(8,10,4,2); g.fillRect(14,10,4,2);
      g.fillStyle(0x44aacc); g.fillRect(38,10,4,2); g.fillRect(44,10,4,2);
    });
    // Pool (blue rectangle)
    this._tex('furn_pool', 64, 32, g => {
      g.fillStyle(0xcccccc); g.fillRect(0,0,64,32);
      g.fillStyle(0x2a6a8a); g.fillRect(3,3,58,26);
      g.fillStyle(0x3a8aaa); g.fillRect(6,6,52,20);
    });
    // Bookshelf (reuse pattern)
    this._tex('furn_bookshelf', 64, 32, g => {
      g.fillStyle(0x4a2e16); g.fillRect(0,0,64,32);
      const colors=[0x8B0000,0x00008B,0x006400,0x8B8000,0x4B0082,0x800020];
      for(let i=0;i<10;i++){ g.fillStyle(colors[i%6]); g.fillRect(4+i*6,4,5,12); }
      for(let i=0;i<10;i++){ g.fillStyle(colors[(i+3)%6]); g.fillRect(4+i*6,18,5,12); }
    });
    // Crew locker
    this._tex('furn_locker', 24, 32, g => {
      g.fillStyle(0x4a4a50); g.fillRect(0,0,24,32);
      g.fillStyle(0x3a3a40); g.fillRect(2,2,9,28); g.fillRect(13,2,9,28);
      g.fillStyle(0xc9a84c); g.fillRect(9,14,2,4); g.fillRect(20,14,2,4);
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

  _genCrimeScene() {
    this._tex('crime_body_outline', 48, 64, g => {
      g.lineStyle(2, 0xcccccc, 0.8);
      g.strokeCircle(24, 8, 6);
      g.lineBetween(24, 14, 24, 18);
      g.strokeRect(14, 18, 20, 20);
      g.lineBetween(14, 20, 4, 32);
      g.lineBetween(4, 32, 2, 38);
      g.lineBetween(34, 20, 44, 32);
      g.lineBetween(44, 32, 46, 38);
      g.lineBetween(18, 38, 12, 52);
      g.lineBetween(12, 52, 8, 62);
      g.lineBetween(30, 38, 36, 52);
      g.lineBetween(36, 52, 40, 62);
      g.fillStyle(0xaaaaaa, 0.15);
      g.fillCircle(24, 30, 18);
    });

    this._tex('crime_blood_1', 16, 16, g => {
      g.fillStyle(0x4a0000, 0.7);
      g.fillCircle(8, 8, 5);
      g.fillStyle(0x3a0000, 0.5);
      g.fillCircle(5, 6, 3);
      g.fillCircle(11, 10, 2);
      g.fillRect(3, 8, 3, 2);
    });

    this._tex('crime_blood_2', 24, 24, g => {
      g.fillStyle(0x3a0000, 0.6);
      g.fillCircle(12, 12, 10);
      g.fillStyle(0x4a0000, 0.5);
      g.fillCircle(12, 12, 7);
      g.fillStyle(0x2a0000, 0.4);
      g.fillCircle(10, 14, 4);
      g.fillCircle(16, 10, 3);
    });

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
