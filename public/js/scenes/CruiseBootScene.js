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
    const S = 32;
    const dirNames = ['down','left','right','up'];

    for (let d = 0; d < 4; d++) {
      for (let f = 0; f < 3; f++) {
        const key = `player_${dirNames[d]}_${f}`;
        this._tex(key, S, S, (g) => {
          const cx = S/2, cy = S/2;
          const wb = f === 1 ? -1 : f === 2 ? 1 : 0;
          // Body
          g.fillStyle(0x5c4a32); g.fillRect(cx-6, cy-2+wb, 12, 14);
          // Head
          g.fillStyle(0xe8c99b); g.fillRect(cx-5, cy-10+wb, 10, 9);
          // Hat
          g.fillStyle(0x3a2f24);
          g.fillRect(cx-7, cy-14+wb, 14, 5);
          g.fillRect(cx-5, cy-16+wb, 10, 3);
          // Eyes
          if (dirNames[d] !== 'up') {
            g.fillStyle(0x222222);
            if (dirNames[d] === 'down') {
              g.fillRect(cx-3,cy-6+wb,2,2); g.fillRect(cx+1,cy-6+wb,2,2);
            } else if (dirNames[d] === 'left') {
              g.fillRect(cx-4,cy-6+wb,2,2);
            } else {
              g.fillRect(cx+2,cy-6+wb,2,2);
            }
          }
          // Legs
          g.fillStyle(0x2a2a2a); g.fillRect(cx-4, cy+12, 3, 4); g.fillRect(cx+1, cy+12, 3, 4);
          // Shoes
          g.fillStyle(0x1a1a1a); g.fillRect(cx-5, cy+15, 4, 2); g.fillRect(cx+1, cy+15, 4, 2);
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
      { key:'npc_vasquez',    body:0xf0f0f0, hair:0x1a1a1a, accent:0xcc3333 },
      { key:'npc_harrington', body:0x1a1a4e, hair:0xcccccc, accent:0xc9a84c },
      { key:'npc_isabelle',   body:0xcc2244, hair:0xdaa520, accent:0xc9a84c },
      { key:'npc_volkov',     body:0x111111, hair:0x888888, accent:0xcccccc },
      { key:'npc_diego',      body:0x2a4a2a, hair:0x1a1a1a, accent:null },
      { key:'npc_lydia',      body:0x4a2a6a, hair:0x0a0a0a, accent:0xc9a84c },
      { key:'npc_wells',      body:0x4a4a4a, hair:0x6b4423, accent:0xcc0000 },
      { key:'npc_sofia',      body:0x2a2a5a, hair:0xdaa520, accent:0xffffff },
      { key:'npc_romano',     body:0xf5f5f5, hair:0x333333, accent:0xcc0000 },
      { key:'npc_okafor',     body:0x1a1a1a, hair:0x0a0a0a, accent:0xc9a84c },
      { key:'npc_yuki',       body:0xdd6622, hair:0x0a0a0a, accent:null },
    ];
    npcs.forEach(n => {
      this._tex(n.key, 32, 32, g => {
        const cx=16, cy=16;
        g.fillStyle(n.body);    g.fillRect(cx-6,cy-2,12,14);
        g.fillStyle(0xe8c99b);  g.fillRect(cx-5,cy-10,10,9);
        g.fillStyle(n.hair);    g.fillRect(cx-5,cy-13,10,5);
        g.fillStyle(0x222222);  g.fillRect(cx-3,cy-6,2,2); g.fillRect(cx+1,cy-6,2,2);
        if (n.accent !== null) {
          g.fillStyle(n.accent); g.fillRect(cx-1,cy-2,2,3);
        }
        g.fillStyle(0x2a2a2a);  g.fillRect(cx-4,cy+12,3,4); g.fillRect(cx+1,cy+12,3,4);
      });
    });
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
    // Dark steel gray with rivet dots (ship corridors)
    this._tex('tile_metal', 32, 32, g => {
      g.fillStyle(0x3a3a40); g.fillRect(0,0,32,32);
      g.lineStyle(1, 0x2e2e34); g.strokeRect(0,0,32,32);
      g.fillStyle(0x4a4a50);
      g.fillCircle(4,4,1); g.fillCircle(28,4,1);
      g.fillCircle(4,28,1); g.fillCircle(28,28,1);
      g.fillCircle(16,16,1);
    });
    // Warm wood planking for decks
    this._tex('tile_wood_deck', 32, 32, g => {
      g.fillStyle(0x6b5030); g.fillRect(0,0,32,32);
      g.lineStyle(1, 0x5a4028);
      for(let i=0;i<5;i++){ g.beginPath(); g.moveTo(0,6+i*6); g.lineTo(32,6+i*6); g.strokePath(); }
      g.fillStyle(0x7a5a38); g.fillRect(8,0,2,32); g.fillRect(24,0,2,32);
    });
    // Navy carpet for luxury rooms
    this._tex('tile_carpet_blue', 32, 32, g => {
      g.fillStyle(0x1a2a4a); g.fillRect(0,0,32,32);
      g.lineStyle(1, 0xc9a84c, 0.15); g.strokeRect(4,4,24,24); g.strokeRect(8,8,16,16);
    });
    // White tile for medical/kitchen
    this._tex('tile_tile_white', 32, 32, g => {
      g.fillStyle(0xd8d8d0); g.fillRect(0,0,32,32);
      g.fillStyle(0xe4e4dc); g.fillRect(0,0,16,16); g.fillRect(16,16,16,16);
      g.lineStyle(1, 0xc0c0b8); g.strokeRect(0,0,16,16); g.strokeRect(16,0,16,16);
      g.strokeRect(0,16,16,16); g.strokeRect(16,16,16,16);
    });
    // Red carpet for casino/restaurant
    this._tex('tile_carpet_red', 32, 32, g => {
      g.fillStyle(0x4a1a1a); g.fillRect(0,0,32,32);
      g.lineStyle(1, 0xc9a84c, 0.15); g.strokeRect(4,4,24,24); g.strokeRect(8,8,16,16);
    });
    // Blue-green water
    this._tex('tile_water', 32, 32, g => {
      g.fillStyle(0x1a4a5a); g.fillRect(0,0,32,32);
      g.fillStyle(0x2a5a6a);
      for(let i=0;i<4;i++) g.fillRect(2+i*8, 8+((i%2)*6), 6, 2);
    });
    // Wall tile (ship bulkhead)
    this._tex('tile_wall', 32, 32, g => {
      g.fillStyle(0x2a2a30); g.fillRect(0,0,32,32);
      g.fillStyle(0x333338); g.fillRect(2,2,28,12); g.fillRect(2,18,28,12);
      g.lineStyle(1, 0x1e1e24); g.strokeRect(2,2,28,12); g.strokeRect(2,18,28,12);
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
