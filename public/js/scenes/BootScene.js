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
      this._genNPCs();
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
      { key:'npc_victoria', body:0x8B2252, hair:0xDAA520, accent:0x6b1a3f },
      { key:'npc_hartwell', body:0x2F4F4F, hair:0x696969, accent:0xffffff },
      { key:'npc_clara',    body:0x4a3280, hair:0x8B4513, accent:0xdda0dd },
      { key:'npc_price',    body:0x1a1a2e, hair:0x333333, accent:0xc9a84c },
      { key:'npc_agnes',    body:0x2d2d2d, hair:0xaaaaaa, accent:0xf5f5f5 },
    ];
    npcs.forEach(n => {
      this._tex(n.key, 32, 32, g => {
        const cx=16, cy=16;
        g.fillStyle(n.body);    g.fillRect(cx-6,cy-2,12,14);
        g.fillStyle(0xe8c99b);  g.fillRect(cx-5,cy-10,10,9);
        g.fillStyle(n.hair);    g.fillRect(cx-5,cy-13,10,5);
        g.fillStyle(0x222222);  g.fillRect(cx-3,cy-6,2,2); g.fillRect(cx+1,cy-6,2,2);
        g.fillStyle(n.accent);  g.fillRect(cx-1,cy-2,2,3);
        g.fillStyle(0x2a2a2a);  g.fillRect(cx-4,cy+12,3,4); g.fillRect(cx+1,cy+12,3,4);
      });
    });
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
    this._tex('tile_floor', 32, 32, g => {
      g.fillStyle(0x3d3225); g.fillRect(0,0,32,32);
      g.lineStyle(1, 0x342b1f); g.strokeRect(0,0,32,32);
      g.lineStyle(1, 0x352d21);
      for(let i=0;i<5;i++){ g.beginPath(); g.moveTo(0,6+i*6); g.lineTo(32,6+i*6); g.strokePath(); }
    });
    this._tex('tile_wall', 32, 32, g => {
      g.fillStyle(0x2d1117); g.fillRect(0,0,32,32);
      g.fillStyle(0x3a1520); g.fillRect(2,2,28,12); g.fillRect(2,18,28,12);
      g.lineStyle(1, 0x1f0c10); g.strokeRect(2,2,28,12); g.strokeRect(2,18,28,12);
    });
    this._tex('tile_carpet', 32, 32, g => {
      g.fillStyle(0x4a1a2a); g.fillRect(0,0,32,32);
      g.lineStyle(1, 0xc9a84c, 0.2); g.strokeRect(4,4,24,24); g.strokeRect(8,8,16,16);
    });
    this._tex('tile_grass', 32, 32, g => {
      g.fillStyle(0x1a3a1a); g.fillRect(0,0,32,32);
      g.fillStyle(0x1f441f);
      for(let i=0;i<8;i++) g.fillRect(Math.random()*28+2,Math.random()*28+2,2,3);
    });
    this._tex('tile_kitchen_floor', 32, 32, g => {
      g.fillStyle(0x3a3530); g.fillRect(0,0,32,32);
      g.fillStyle(0x454038); g.fillRect(0,0,16,16); g.fillRect(16,16,16,16);
    });
  }

  _genFurniture() {
    this._tex('furn_desk', 64, 32, g => {
      g.fillStyle(0x5c3a1e); g.fillRect(0,4,64,24);
      g.fillStyle(0x4a2e16); g.fillRect(2,8,60,18);
      g.fillStyle(0xc9a84c); g.fillRect(28,12,8,6);
    });
    this._tex('furn_bookshelf', 64, 32, g => {
      g.fillStyle(0x4a2e16); g.fillRect(0,0,64,32);
      const colors=[0x8B0000,0x00008B,0x006400,0x8B8000,0x4B0082,0x800020];
      for(let i=0;i<10;i++){ g.fillStyle(colors[i%6]); g.fillRect(4+i*6,4,5,12); }
      for(let i=0;i<10;i++){ g.fillStyle(colors[(i+3)%6]); g.fillRect(4+i*6,18,5,12); }
    });
    this._tex('furn_table', 48, 32, g => {
      g.fillStyle(0x5c3a1e); g.fillRect(4,4,40,24);
      g.fillStyle(0x6b4423); g.fillRect(6,6,36,20);
    });
    this._tex('furn_fireplace', 64, 48, g => {
      g.fillStyle(0x555555); g.fillRect(0,0,64,48);
      g.fillStyle(0x333333); g.fillRect(8,8,48,40);
      g.fillStyle(0x1a0500); g.fillRect(12,16,40,32);
      g.fillStyle(0xcc4400); g.fillRect(20,34,8,10); g.fillRect(30,36,10,8);
      g.fillStyle(0xff6600); g.fillRect(22,38,6,6); g.fillRect(32,38,6,6);
    });
    this._tex('furn_plant', 24, 32, g => {
      g.fillStyle(0x8B4513); g.fillRect(4,16,16,14); g.fillRect(2,14,20,4);
      g.fillStyle(0x228B22); g.fillRect(8,2,3,14); g.fillRect(4,0,6,6); g.fillRect(12,2,6,6);
    });
    this._tex('furn_bed', 48, 64, g => {
      g.fillStyle(0x5c3a1e); g.fillRect(0,0,48,64);
      g.fillStyle(0xf5f5f5); g.fillRect(4,8,40,48);
      g.fillStyle(0x4a1a2a); g.fillRect(4,28,40,28);
    });
    this._tex('furn_stove', 48, 32, g => {
      g.fillStyle(0x444444); g.fillRect(0,0,48,32);
      g.fillStyle(0x222222); g.fillCircle(16,12,6); g.fillCircle(34,12,6);
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
