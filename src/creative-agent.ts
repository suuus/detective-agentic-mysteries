/**
 * Creative Agency — AI agent that autonomously designs visual assets for
 * procedurally rendered game worlds.  The agent decides WHAT to create based
 * on the setting (wine barrels for a winery, telescopes for an observatory,
 * etc.) and outputs low-level drawing instructions that the client renders.
 *
 * Drawing primitives map directly to Phaser's Graphics API:
 *   fill      → g.fillStyle(color, alpha); g.fillRect(x, y, w, h)
 *   circle    → g.fillStyle(color, alpha); g.fillCircle(x, y, r)
 *   line      → g.lineStyle(width, color, alpha); g.lineBetween(x1, y1, x2, y2)
 *   tri       → g.fillStyle(color, alpha); g.fillTriangle(x1,y1, x2,y2, x3,y3)
 *   stroke    → g.lineStyle(width, color, alpha); g.strokeRect(x, y, w, h)
 *   ellipse   → g.fillStyle(color, alpha); g.fillEllipse(x, y, w, h)
 *   arc       → g.lineStyle(width, color, alpha); g.arc(x, y, r, startAngle, endAngle); g.strokePath()
 *   roundRect → g.fillStyle(color, alpha); g.fillRoundedRect(x, y, w, h, r)
 */

// ── Drawing DSL ──────────────────────────────────────────────────

export type DrawOp =
  | { op: 'fill';      color: string; x: number; y: number; w: number; h: number; alpha?: number }
  | { op: 'circle';    color: string; x: number; y: number; r: number; alpha?: number }
  | { op: 'line';      color: string; x1: number; y1: number; x2: number; y2: number; width: number; alpha?: number }
  | { op: 'tri';       color: string; x1: number; y1: number; x2: number; y2: number; x3: number; y3: number; alpha?: number }
  | { op: 'stroke';    color: string; x: number; y: number; w: number; h: number; width: number; alpha?: number }
  | { op: 'ellipse';   color: string; x: number; y: number; w: number; h: number; alpha?: number }
  | { op: 'arc';       color: string; x: number; y: number; r: number; start: number; end: number; width: number; alpha?: number }
  | { op: 'roundRect'; color: string; x: number; y: number; w: number; h: number; r: number; alpha?: number }
  | { op: 'diamond';   color: string; cx: number; cy: number; hw: number; hh: number; alpha?: number }
  | { op: 'poly';      color: string; points: number[]; alpha?: number }
  | { op: 'pixels';    color: string; pts: number[]; alpha?: number }
  | { op: 'dither';    color: string; color2: string; x: number; y: number; w: number; h: number; density?: number; alpha?: number }
  | { op: 'shade';     color: string; x: number; y: number; w: number; h: number; dir: 'down'|'up'|'left'|'right'; from: number; to: number };

// ── Asset interfaces ─────────────────────────────────────────────

/** A single decoration the AI invented for a specific room. */
export interface Decoration {
  name: string;         // e.g. "Wine Barrel", "Broken Telescope"
  width: number;        // texture width  (16-64)
  height: number;       // texture height (16-64)
  draw: DrawOp[];       // procedural drawing instructions
}

/** An ambient prop scattered randomly across the map. */
export interface AmbientProp {
  name: string;         // e.g. "Cork", "Spilled Ink"
  width: number;
  height: number;
  count: number;        // how many to scatter (1-8)
  draw: DrawOp[];
}

/** DrawOp-based sprite for evidence items. */
export interface EvidenceSprite {
  evidenceId: string;   // must match evidence id from skeleton
  width: number;        // 16
  height: number;       // 16
  draw: DrawOp[];
}

/** NPC costume overlay drawn on top of the base body template. */
export interface NPCCostume {
  characterId: string;  // must match character id from skeleton
  draw: DrawOp[];       // drawn on a 32×32 canvas AFTER the base body
}

/** Setting-specific furniture piece. */
export interface FurnitureDesign {
  name: string;         // e.g. "Wine Rack", "Lab Centrifuge"
  width: number;        // 32-80
  height: number;       // 32-90
  draw: DrawOp[];
}

/** Crime scene visual elements. */
export interface CrimeSceneDesign {
  /** Custom body outline (48×64). If omitted, uses default chalk outline. */
  bodyOutline?: { draw: DrawOp[] };
  /** Scene markers — blood, chemical spills, scorch marks, etc (16×16 each). */
  markers: { name: string; draw: DrawOp[] }[];
  /** Scene barrier — crime tape, rope, hologram, etc (64×8). */
  barrier?: { draw: DrawOp[] };
}

/** Larger character portrait for dialog panel (64×64). */
export interface CharacterPortrait {
  characterId: string;
  draw: DrawOp[];       // drawn on a 64×64 canvas
}

/** Custom weather particle configuration. */
export interface WeatherDesign {
  /** Texture for the primary weather particle. */
  particle: { width: number; height: number; draw: DrawOp[] };
  /** Particle emitter config overrides. */
  config: {
    speedX?: { min: number; max: number };
    speedY?: { min: number; max: number };
    alpha?: { start: number; end: number };
    scale?: { start: number; end: number };
    frequency?: number;
    lifespan?: number;
    rotate?: { min: number; max: number };
    blendMode?: 'ADD' | 'NORMAL';
  };
}

/** Full creative asset package produced by the agent. */
export interface CreativeAssets {
  /** Per-room decoration objects (2-4 per room). */
  decorations: {
    roomId: string;
    items: Decoration[];
  }[];

  /** Setting-specific ambient props scattered in random rooms. */
  ambientProps: AmbientProp[];

  /** Atmospheric particle configuration. */
  particles: {
    color: string;    // hex — particle color
    size: number;     // pixel radius (1-4)
    speed: { min: number; max: number };
    alpha: { start: number; end: number };
    frequency: number; // ms between emits (100-800)
    lifespan: number;  // ms (2000-8000)
    blendMode: 'ADD' | 'NORMAL';
  };

  /** Per-room atmosphere tint overlays. */
  roomAmbiance: Record<string, {
    tintColor: string;  // hex
    tintAlpha: number;  // 0.0-0.15
  }>;

  /** Custom wall tile drawing (64×72 px isometric block). */
  wallTile: {
    draw: DrawOp[];   // 64×72 iso wall block instructions
  };

  /** Unique sprite per evidence item (16×16 each). */
  evidenceSprites?: EvidenceSprite[];

  /** NPC costume overlays (hats, uniforms, accessories). */
  npcCostumes?: NPCCostume[];

  /** Setting-specific furniture designs. */
  furniture?: FurnitureDesign[];

  /** Crime scene visual elements. */
  crimeScene?: CrimeSceneDesign;

  /** Character portraits for dialog (64×64). */
  portraits?: CharacterPortrait[];

  /** Custom weather particle design. */
  weather?: WeatherDesign;
}

// ── Prompt builders ──────────────────────────────────────────────

interface CreativePromptInput {
  title: string;
  setting: string;
  settingTheme: string;
  rooms: { id: string; name: string }[];
  characters: { id: string; name: string; role: string }[];
  evidence: { id: string; name: string; description: string }[];
  crime: string;
  weather?: string;
  visual?: { wallColor: string; wallAccent: string; accentColor: string; furnitureStyle: string };
}

const PRIMITIVES_HELP = `=== DRAWING PRIMITIVES ===
You have 14 drawing primitives on a pixel canvas. Coordinates are (0,0) at TOP-LEFT.
  fill      — filled rect     {"op":"fill","color":"#hex","x":0,"y":0,"w":10,"h":10}
  circle    — filled circle   {"op":"circle","color":"#hex","x":5,"y":5,"r":4}
  line      — line segment    {"op":"line","color":"#hex","x1":0,"y1":0,"x2":10,"y2":10,"width":1}
  tri       — filled triangle {"op":"tri","color":"#hex","x1":0,"y1":8,"x2":4,"y2":0,"x3":8,"y3":8}
  stroke    — stroked rect    {"op":"stroke","color":"#hex","x":0,"y":0,"w":10,"h":10,"width":1}
  ellipse   — filled ellipse  {"op":"ellipse","color":"#hex","x":16,"y":16,"w":20,"h":12}
  arc       — stroked arc     {"op":"arc","color":"#hex","x":16,"y":16,"r":10,"start":0,"end":3.14,"width":2}
  roundRect — rounded rect    {"op":"roundRect","color":"#hex","x":2,"y":2,"w":28,"h":28,"r":4}
  diamond   — iso diamond     {"op":"diamond","color":"#hex","cx":24,"cy":12,"hw":20,"hh":15}
  poly      — filled polygon  {"op":"poly","color":"#hex","points":[x1,y1,x2,y2,...]}
  pixels    — batch pixels    {"op":"pixels","color":"#hex","pts":[x1,y1,x2,y2,...]} (individual 1×1 dots)
  dither    — checkerboard    {"op":"dither","color":"#c1","color2":"#c2","x":0,"y":0,"w":10,"h":10,"density":2}
  shade     — gradient fill   {"op":"shade","color":"#hex","x":0,"y":0,"w":10,"h":10,"dir":"down","from":0.0,"to":0.5}
All ops accept optional "alpha" (0.0-1.0). Arc angles in radians.

TEXTURING TECHNIQUES (use these to add crafted pixel-art detail):
- "dither" blends two colors in a checkerboard — great for wood grain, fabric, stone texture, shadows
- "shade" draws a gradient (row by row) — use for lighting falloff, glass shine, metallic sheen
- "pixels" plots individual dots — use for rivets, screws, specks, scattered detail, dithered edges
- Layer multiple poly/tri with slightly different shades to create depth
- Use lines at alpha 0.2-0.4 for wood grain, scratches, mortar lines
- Use small circles at low alpha for wear marks, reflections, knobs

=== ISOMETRIC DESIGN RULES (CRITICAL — READ CAREFULLY) ===
This game renders in ISOMETRIC 2.5D. Objects must look like 3D shapes viewed from above-right.
1px dark outlines are automatically added around all shapes — you don't need to draw outlines.

GOLDEN RULE: hw:hh ratio is ALWAYS 4:3 (e.g. hw=32,hh=24 or hw=20,hh=15 or hw=12,hh=9 or hw=8,hh=6).

THE ISO BOX — every piece of furniture/decoration is built from this pattern:
  Given: canvas width W, canvas height H, half-widths hw/hh, vertical depth d.
  cx = W/2 (horizontal center of canvas)
  baseY = H - hh (bottom of the box — diamond bottom vertex near canvas bottom)

  Step 1 — LEFT FACE (darkest, shadow side):
    {"op":"poly","color":"DARK","points":[cx-hw,baseY-d, cx,baseY-d+hh, cx,baseY+hh, cx-hw,baseY]}
  Step 2 — RIGHT FACE (medium, lit side):
    {"op":"poly","color":"MED","points":[cx+hw,baseY-d, cx,baseY-d+hh, cx,baseY+hh, cx+hw,baseY]}
  Step 3 — TOP FACE (lightest, flat surface):
    {"op":"diamond","color":"LIGHT","cx":cx,"cy":baseY-d,"hw":hw,"hh":hh}
  Step 4+ — DETAILS drawn ON the faces:
    Face details: poly/tri/fill/dither/shade on the visible faces
    Top details: smaller diamond/circle/ellipse within the top face bounds
    Texture: dither or shade for wood grain, fabric, metal, etc.
    Accents: pixels/line for rivets, scratches, wear marks

STYLE GOAL: Charming, detailed pixel-art diorama. Think cozy isometric rooms with personality.
Each piece should feel hand-crafted with texture, shading, and small details that reward close inspection.

=== WORKED EXAMPLE: A DETAILED 64×72 DESK (hw=32, hh=24, depth=14) ===
  Canvas: width=64, height=72. cx=32, baseY=72-24=48.
  [
    {"op":"poly","color":"#3a2510","points":[0,34, 32,58, 32,72, 0,48]},
    {"op":"poly","color":"#4a3218","points":[64,34, 32,58, 32,72, 64,48]},
    {"op":"diamond","color":"#6b4423","cx":32,"cy":34,"hw":32,"hh":24},
    {"op":"dither","color":"#6b4423","color2":"#5a3818","x":12,"y":28,"w":40,"h":6,"density":2},
    {"op":"shade","color":"#000000","x":1,"y":48,"w":30,"h":10,"dir":"down","from":0.0,"to":0.15},
    {"op":"poly","color":"#5a3a20","points":[34,58, 56,44, 56,52, 34,66]},
    {"op":"line","color":"#7a5a30","x1":35,"y1":60,"x2":54,"y2":48,"width":1,"alpha":0.3},
    {"op":"diamond","color":"#f5f0e0","cx":20,"cy":38,"hw":10,"hh":7,"alpha":0.9},
    {"op":"line","color":"#aaa088","x1":14,"y1":39,"x2":24,"y2":39,"width":1,"alpha":0.5},
    {"op":"line","color":"#aaa088","x1":15,"y1":41,"x2":22,"y2":41,"width":1,"alpha":0.5},
    {"op":"circle","color":"#1a1a1a","x":40,"y":36,"r":2},
    {"op":"circle","color":"#333333","x":40,"y":35,"r":1,"alpha":0.8},
    {"op":"pixels","color":"#8a6a3a","pts":[10,36, 50,32, 52,34, 14,40]}
  ]

=== WORKED EXAMPLE: A DETAILED 64×80 BOOKSHELF (hw=32, hh=24, depth=30) ===
  Canvas: width=64, height=80. cx=32, baseY=80-24=56.
  [
    {"op":"poly","color":"#2a1a0a","points":[0,26, 32,50, 32,80, 0,56]},
    {"op":"poly","color":"#3a2a15","points":[64,26, 32,50, 32,80, 64,56]},
    {"op":"diamond","color":"#4a3018","cx":32,"cy":26,"hw":32,"hh":24},
    {"op":"dither","color":"#2a1a0a","color2":"#221508","x":2,"y":50,"w":28,"h":16,"density":3},
    {"op":"poly","color":"#8B0000","points":[34,54, 42,50, 42,56, 34,60]},
    {"op":"poly","color":"#00008B","points":[43,49, 50,46, 50,52, 43,55]},
    {"op":"poly","color":"#006400","points":[51,45, 58,42, 58,48, 51,51]},
    {"op":"poly","color":"#4B0082","points":[34,61, 44,56, 44,62, 34,67]},
    {"op":"poly","color":"#DAA520","points":[45,55, 54,51, 54,57, 45,61]},
    {"op":"poly","color":"#800020","points":[55,50, 62,47, 62,53, 55,56]},
    {"op":"line","color":"#3a2a15","x1":34,"y1":54,"x2":62,"y2":40,"width":1,"alpha":0.4},
    {"op":"line","color":"#3a2a15","x1":34,"y1":62,"x2":62,"y2":48,"width":1,"alpha":0.4},
    {"op":"poly","color":"#8B4513","points":[2,52, 28,52, 28,54, 2,54]},
    {"op":"poly","color":"#00008B","points":[4,54, 10,54, 10,62, 4,62]},
    {"op":"poly","color":"#8B0000","points":[11,54, 18,54, 18,60, 11,60]},
    {"op":"poly","color":"#006400","points":[19,54, 26,54, 26,63, 19,63]},
    {"op":"shade","color":"#000000","x":1,"y":56,"w":30,"h":12,"dir":"down","from":0.0,"to":0.2}
  ]

=== WORKED EXAMPLE: A 24×30 CRATE (hw=12, hh=9, depth=10) ===
  Canvas: width=24, height=30. cx=12, baseY=30-9=21.
  [
    {"op":"poly","color":"#2a1a0a","points":[0,11, 12,20, 12,30, 0,21]},
    {"op":"poly","color":"#3a2a15","points":[24,11, 12,20, 12,30, 24,21]},
    {"op":"diamond","color":"#5a3a1a","cx":12,"cy":11,"hw":12,"hh":9},
    {"op":"dither","color":"#5a3a1a","color2":"#4a2e12","x":4,"y":8,"w":16,"h":5,"density":2},
    {"op":"line","color":"#7a5a2a","x1":13,"y1":23,"x2":21,"y2":18,"width":1},
    {"op":"line","color":"#7a5a2a","x1":13,"y1":27,"x2":21,"y2":22,"width":1},
    {"op":"pixels","color":"#8a6a3a","pts":[14,20, 18,17, 16,25, 20,22]}
  ]

=== WORKED EXAMPLE: A 16×16 EVIDENCE SPRITE (a vial/bottle) ===
  Evidence is SMALL (16×16). Use recognisable silhouettes with BRIGHT colors.
  [
    {"op":"roundRect","color":"#88ccff","x":5,"y":2,"w":6,"h":10,"r":2},
    {"op":"fill","color":"#44aadd","x":6,"y":6,"w":4,"h":5},
    {"op":"fill","color":"#cccccc","x":6,"y":1,"w":4,"h":3},
    {"op":"circle","color":"#ffffff","x":7,"y":5,"r":1,"alpha":0.6}
  ]

=== WORKED EXAMPLE: A 16×16 EVIDENCE SPRITE (a letter/document) ===
  [
    {"op":"fill","color":"#f5f0d0","x":2,"y":1,"w":12,"h":14},
    {"op":"fill","color":"#e0d8b0","x":2,"y":1,"w":12,"h":2},
    {"op":"line","color":"#555555","x1":4,"y1":5,"x2":12,"y2":5,"width":1},
    {"op":"line","color":"#555555","x1":4,"y1":8,"x2":11,"y2":8,"width":1},
    {"op":"line","color":"#555555","x1":4,"y1":11,"x2":9,"y2":11,"width":1}
  ]

=== QUICK-REFERENCE ISO BOX SIZES ===
  Small item:  W=24, H=30,  hw=12, hh=9,  depth=8-12.  cx=12, baseY=21
  Medium item: W=48, H=54,  hw=24, hh=18, depth=4-14.  cx=24, baseY=36
  Large item:  W=64, H=72,  hw=32, hh=24, depth=10-20. cx=32, baseY=48
  Tall item:   W=64, H=80,  hw=32, hh=24, depth=26-34. cx=32, baseY=56
  XL item:     W=80, H=90,  hw=40, hh=30, depth=12-24. cx=40, baseY=60

=== COLOR RULES ===
- LEFT face: darkest shade (shadow). RIGHT face: mid shade. TOP face: lightest (highlight).
- Use 3-4 shades per material: base, dark, darker, and a highlight for edges/worn spots.
- Darken: lower hex digits (e.g. #6b4423 → left #3a2510, right #4a3218).
- Use "dither" to blend adjacent shades for a hand-crafted texture feel.
- Use "shade" for subtle lighting gradients on large flat surfaces.
- Evidence: use BRIGHT, saturated colors — items must pop against dark floors.
- All colors MUST be 6-digit hex (#RRGGBB). Never 3-digit or named colors.

=== COMMON MISTAKES TO AVOID ===
- DO NOT use flat "fill" rects for furniture/decoration bodies — they look wrong. ALWAYS use poly+diamond.
- DO NOT draw outside canvas bounds — canvas W×H defines the coordinate space.
- DO NOT forget alpha on glass/liquid objects — use 0.3-0.7 for translucency.
- DO NOT make evidence sprites too dark — they must be visible on dark floors.
- DO NOT use hw:hh ratios other than 4:3 — it breaks isometric alignment.
- ALWAYS draw faces in order: left poly, right poly, top diamond, then details.
- ALWAYS add texture details (dither, lines, pixels) to make surfaces interesting — plain flat fills look lifeless.`;

/**
 * Prompt 1 of 3: Environment atmosphere (wall tile, particles, room ambiance, weather).
 */
export function buildEnvironmentPrompt(skeleton: CreativePromptInput): string {
  const roomList = skeleton.rooms.map(r => `- ${r.id}: "${r.name}"`).join('\n');

  return `You are a VISUAL ARTIST for an ISOMETRIC 2.5D pixel-art mystery game.
Setting: "${skeleton.setting}" | Theme: ${skeleton.settingTheme} | Weather: ${skeleton.weather || 'clear'}
Palette — wall: ${skeleton.visual?.wallColor || '#2d1117'}, accent: ${skeleton.visual?.accentColor || '#c9a84c'}

ROOMS:
${roomList}

${PRIMITIVES_HELP}

Output MINIFIED JSON (no extra whitespace) with ALL 4 sections:
{
  "wallTile":{"draw":[...]},
  "particles":{"color":"#hex","size":2,"speed":{"min":3,"max":10},"alpha":{"start":0,"end":0.2},"frequency":400,"lifespan":6000,"blendMode":"ADD"},
  "roomAmbiance":{"room_id":{"tintColor":"#hex","tintAlpha":0.06}},
  "weather":{"particle":{"width":4,"height":8,"draw":[...]},"config":{"speedX":{"min":-60,"max":-30},"speedY":{"min":280,"max":360},"alpha":{"start":0.5,"end":0.15},"frequency":18,"lifespan":1200,"blendMode":"ADD"}}
}

CRITICAL — Your wallTile MUST follow this exact structure (change colors to match the setting):
{"draw":[{"op":"poly","color":"#1a0a0e","points":[0,24,32,48,32,72,0,48]},{"op":"poly","color":"#250f14","points":[64,24,32,48,32,72,64,48]},{"op":"diamond","color":"#2d1117","cx":32,"cy":24,"hw":32,"hh":24},{"op":"line","color":"#1a0808","x1":4,"y1":32,"x2":28,"y2":44,"width":1,"alpha":0.3},{"op":"line","color":"#1a0808","x1":4,"y1":40,"x2":28,"y2":52,"width":1,"alpha":0.3}]}
Replace the 5 hex colors with colors that match "${skeleton.setting}" (keep the same coordinate structure).

RULES:
- Wall tile: 64×72 ISOMETRIC BLOCK. cx=32, the top diamond is at cy=24 with hw=32, hh=24. Left+right side faces extend 24px down from the diamond edges to the bottom. Draw order: left poly, right poly, top diamond, then texture details ON the faces. Example structure:
    Left:  {"op":"poly","color":"DARK","points":[0,24, 32,48, 32,72, 0,48]}
    Right: {"op":"poly","color":"MED","points":[64,24, 32,48, 32,72, 64,48]}
    Top:   {"op":"diamond","color":"LIGHT","cx":32,"cy":24,"hw":32,"hh":24}
    Then add 2-4 detail ops (mortar lines, grain, weathering) ON the faces using line/tri/poly.
- Particles: Atmospheric effect matching setting. Choose thoughtfully.
- Room ambiance: EVERY room gets a unique tint. tintAlpha 0.03-0.12.
- Weather: particle texture ≤16×16 matching "${skeleton.weather || 'clear'}". Config should feel natural.
- All colors: 6-digit hex. Output ONLY minified JSON.`;
}

/**
 * Prompt 2 of 3: Props Department — decorations, furniture, ambient props.
 * Dedicated agent with full token budget for rich, detailed immersive items.
 */
export function buildPropsPrompt(skeleton: CreativePromptInput): string {
  const roomList = skeleton.rooms.map(r => `- ${r.id}: "${r.name}"`).join('\n');
  const roomCount = skeleton.rooms.length;

  return `You are the PROPS DEPARTMENT for an ISOMETRIC 2.5D pixel-art mystery game. Your job is to make EVERY ROOM feel alive and immersive with setting-specific objects that look like 3D isometric shapes — NOT flat top-down sprites.
Setting: "${skeleton.setting}" | Theme: ${skeleton.settingTheme}
Palette — wall: ${skeleton.visual?.wallColor || '#2d1117'}, accent: ${skeleton.visual?.accentColor || '#c9a84c'}, furniture style: ${skeleton.visual?.furnitureStyle || 'wooden'}

ROOMS (${roomCount} total):
${roomList}

${PRIMITIVES_HELP}

Output MINIFIED JSON (no extra whitespace) with ALL 3 sections:
{
  "decorations":[{"roomId":"id","items":[{"name":"N","width":64,"height":72,"draw":[...]}]}],
  "furniture":[{"name":"N","width":64,"height":72,"draw":[...]}],
  "ambientProps":[{"name":"N","width":12,"height":12,"count":4,"draw":[...]}]
}

CRITICAL — YOUR FIRST FURNITURE ITEM MUST BE EXACTLY THIS (copy it verbatim to prove you understand the draw format, then generate your own unique items after it):
{"name":"Table","width":64,"height":72,"draw":[{"op":"poly","color":"#3a2510","points":[0,34,32,58,32,72,0,48]},{"op":"poly","color":"#4a3218","points":[64,34,32,58,32,72,64,48]},{"op":"diamond","color":"#6b4423","cx":32,"cy":34,"hw":32,"hh":24},{"op":"dither","color":"#6b4423","color2":"#5a3818","x":12,"y":28,"w":40,"h":6,"density":2},{"op":"diamond","color":"#f5f0e0","cx":24,"cy":38,"hw":8,"hh":6,"alpha":0.9}]}

RULES:
- ALL decorations and furniture MUST be drawn as ISOMETRIC 3D BOXES — follow the iso box pattern from the design rules above.
  MANDATORY DRAW ORDER: 1) left poly (darkest), 2) right poly (medium), 3) top diamond (lightest), 4) texture ops (dither/shade), 5) detail ops.
  Use the QUICK-REFERENCE SIZES — prefer LARGE (64×72) and MEDIUM (48×54) for rich detail:
    Small:  width=24, height=30,  hw=12, hh=9,  cx=12, baseY=21
    Medium: width=48, height=54,  hw=24, hh=18, cx=24, baseY=36
    Large:  width=64, height=72,  hw=32, hh=24, cx=32, baseY=48
    Tall:   width=64, height=80,  hw=32, hh=24, cx=32, baseY=56

- Decorations: 3-5 per room (for ALL ${roomCount} rooms). Use medium or large size. 12-25 draw ops each:
  * Think about what SPECIFIC objects belong in each room based on purpose AND setting
  * A winery cellar gets barrel iso-boxes, a ship bridge gets console iso-boxes
  * Include both large statement pieces AND smaller accent items per room
  * ADD TEXTURE: use dither for wood/stone/metal surfaces, shade for lighting, pixels for wear/details
  * Add wall-mounted or ceiling items (lamps, signs, clocks) as smaller sprites
  * Each item must look like a recognisable 3D object with rich pixel-art detail
  * roomId MUST exactly match the room IDs listed above
  * EVERY room must have decorations — no empty rooms!

- Furniture: 10-15 setting-specific pieces. Use large (64×72) or tall (64×80) size. 15-30 draw ops each:
  * EVERY piece starts with the 3 iso box ops (left poly, right poly, top diamond)
  * THEN add texture: dither on faces for wood grain/fabric/metal, shade for light falloff
  * THEN add details: smaller poly/diamond/circle for drawers, knobs, items on top, cushions
  * THEN add accents: pixels for rivets/screws, lines for scratches/seams at low alpha
  * Include at least 3 seating items, 3 surface/storage items, AND 2 unique statement pieces
  * Think about the SETTING: what furniture would ACTUALLY be in this place?
  * Make each piece feel like a miniature hand-crafted pixel-art model

- Ambient props: 6-10 types. 8-16px each. 2-6 draw ops. count 2-8 each. Small scattered details (flat is fine):
  * Floor debris matching the setting (sawdust, broken glass, flower petals, coffee rings)
  * Stains or marks (scorch marks, water puddles, oil drips, chalk marks)
  * Tiny objects (keys, coins, matchbooks, bottle caps, pens, cigarette butts)
  * Make them varied and setting-specific — they bring the world to life

- All colors: 6-digit hex. Use alpha (0.0-1.0) for glass, liquids, shadows. Output ONLY minified JSON.`;
}

/**
 * Prompt 1 of 2 (legacy): World/environment assets.
 * @deprecated Use buildEnvironmentPrompt + buildPropsPrompt instead
 */
export function buildWorldPrompt(skeleton: CreativePromptInput): string {
  return buildEnvironmentPrompt(skeleton);
}

/**
 * Prompt 2 of 2: Character/item assets (evidence, costumes, portraits, crime scene).
 */
export function buildCharacterAssetsPrompt(skeleton: CreativePromptInput): string {
  const charList = skeleton.characters.map(c => `- ${c.id}: "${c.name}" (${c.role})`).join('\n');
  const evList = skeleton.evidence.map(e => `- ${e.id}: "${e.name}" — ${e.description}`).join('\n');

  return `You are a VISUAL ARTIST for an ISOMETRIC 2.5D pixel-art mystery game.
Setting: "${skeleton.setting}" | Crime: ${skeleton.crime}

CHARACTERS (${skeleton.characters.length}):
${charList}

EVIDENCE (${skeleton.evidence.length} items — EVERY ONE needs a sprite):
${evList}

${PRIMITIVES_HELP}

Output MINIFIED JSON (no extra whitespace) with these sections:
{
  "evidenceSprites":[{"evidenceId":"id","width":16,"height":16,"draw":[...]}],
  "npcCostumes":[{"characterId":"id","draw":[...]}],
  "portraits":[{"characterId":"id","draw":[...]}],
  "crimeScene":{"bodyOutline":{"draw":[...]},"markers":[{"name":"N","draw":[...]}],"barrier":{"draw":[...]}}
}

CRITICAL — Your FIRST evidenceSprite must use this exact pattern (adapt colors/shape to the actual first evidence item, but keep the same structure):
{"evidenceId":"FIRST_ID","width":16,"height":16,"draw":[{"op":"roundRect","color":"#88ccff","x":3,"y":1,"w":10,"h":13,"r":2},{"op":"fill","color":"#44aadd","x":4,"y":5,"w":8,"h":8},{"op":"fill","color":"#cccccc","x":5,"y":1,"w":6,"h":3},{"op":"circle","color":"#ffffff","x":7,"y":7,"r":1,"alpha":0.6}]}
Replace FIRST_ID with the actual first evidence ID from the list above and adapt colors to match that item. Then generate unique sprites for all remaining evidence.

RULES:
- Evidence sprites: A UNIQUE 16×16 sprite for ALL ${skeleton.evidence.length} items. This is CRITICAL — every evidence ID above MUST have a matching sprite.
  * See the 3 WORKED EXAMPLES in the design rules for exactly how to draw a vial, letter, and knife.
  * Evidence is FLAT (not isometric) — it's small enough that fill/roundRect/tri/circle work fine.
  * Use BRIGHT, saturated colors (#88ccff, #ff6666, #f5f0d0, #66ff66) so items pop against dark floors.
  * Create recognisable silhouettes: vial shape, folded letter, knife blade, syringe, torn photo, key, ring, etc.
  * 3-6 draw ops per item. All coords must be within 0-16. evidenceId MUST exactly match IDs above.
- NPC costumes: overlay on 32×32 body (body at cx=16 cy=16, rect (10,14)→(22,28), head (11,6)→(21,15)). Add hats, badges, scarves, aprons, glasses, jewelry, uniforms — make each character visually unique and memorable. 3-8 draw ops. characterId MUST match.
- Portraits: 64×64 head+shoulders for EVERY character. Include face shape (ellipse), eyes (circles), hair, distinguishing features (glasses, beard, scar, hat, earrings), clothing neckline. Use the character's role to inform their appearance. Use dither for skin texture, shade for lighting. 10-20 draw ops each for rich detail. characterId MUST match.
- Crime scene: body outline 48×64 (use lines for limbs + circle for head), 1-2 scene markers 16×16 (blood, chemical spill, scorch marks — whatever fits the specific crime), barrier 64×8. Make them visceral and setting-appropriate.
- All colors: 6-digit hex. Use alpha for layered translucent effects. Output ONLY minified JSON.`;
}

/** @deprecated Use buildEnvironmentPrompt + buildPropsPrompt + buildCharacterAssetsPrompt instead */
export function buildCreativePrompt(skeleton: CreativePromptInput): string {
  return buildEnvironmentPrompt(skeleton);
}

// ── Fallback defaults ────────────────────────────────────────────

export function getDefaultCreativeAssets(rooms: { id: string; name: string }[], characters?: { id: string; name: string }[], evidence?: { id: string; name: string }[]): CreativeAssets {
  return {
    decorations: rooms.slice(0, 4).map(r => ({
      roomId: r.id,
      items: [{
        name: 'Wall Lamp',
        width: 16, height: 24,
        draw: [
          { op: 'fill' as const, color: '#3a2a1a', x: 5, y: 12, w: 6, h: 12 },
          { op: 'circle' as const, color: '#c9a84c', x: 8, y: 8, r: 5 },
          { op: 'circle' as const, color: '#ffe066', x: 8, y: 8, r: 3 },
        ],
      }],
    })),
    ambientProps: [{
      name: 'Dust Patch',
      width: 8, height: 8, count: 4,
      draw: [
        { op: 'circle' as const, color: '#aaaaaa', x: 4, y: 4, r: 3 },
        { op: 'circle' as const, color: '#999999', x: 3, y: 5, r: 1 },
      ],
    }],
    particles: {
      color: '#e8dcc8', size: 2,
      speed: { min: 3, max: 10 },
      alpha: { start: 0, end: 0.2 },
      frequency: 400, lifespan: 6000, blendMode: 'ADD',
    },
    roomAmbiance: Object.fromEntries(rooms.map(r => [
      r.id, { tintColor: '#1a0a00', tintAlpha: 0.05 },
    ])),
    wallTile: {
      draw: [
        { op: 'poly' as const, color: '#1a0a0e', points: [0, 24, 32, 48, 32, 72, 0, 48] },
        { op: 'poly' as const, color: '#250f14', points: [64, 24, 32, 48, 32, 72, 64, 48] },
        { op: 'diamond' as const, color: '#2d1117', cx: 32, cy: 24, hw: 32, hh: 24 },
      ],
    },
    furniture: [{
      name: 'Generic Table',
      width: 64, height: 72,
      draw: [
        { op: 'poly' as const, color: '#3a2510', points: [0, 34, 32, 58, 32, 72, 0, 48] },
        { op: 'poly' as const, color: '#4a3218', points: [64, 34, 32, 58, 32, 72, 64, 48] },
        { op: 'diamond' as const, color: '#6b4423', cx: 32, cy: 34, hw: 32, hh: 24 },
        { op: 'dither' as const, color: '#6b4423', color2: '#5a3818', x: 12, y: 28, w: 40, h: 6, density: 2 },
        { op: 'diamond' as const, color: '#f5f0e0', cx: 24, cy: 38, hw: 8, hh: 6, alpha: 0.9 },
      ],
    }],
    evidenceSprites: (evidence || []).map(e => ({
      evidenceId: e.id,
      width: 16, height: 16,
      draw: [
        { op: 'fill' as const, color: '#f5f0e0', x: 3, y: 2, w: 10, h: 12 },
        { op: 'fill' as const, color: '#333333', x: 5, y: 9, w: 5, h: 1 },
      ],
    })),
    npcCostumes: (characters || []).map(c => ({
      characterId: c.id,
      draw: [
        // Default: small collar accent
        { op: 'fill' as const, color: '#c9a84c', x: 10, y: 13, w: 12, h: 2 },
      ],
    })),
    crimeScene: {
      markers: [{
        name: 'Blood Pool',
        draw: [
          { op: 'circle' as const, color: '#4a0000', x: 8, y: 8, r: 5, alpha: 0.7 },
          { op: 'circle' as const, color: '#3a0000', x: 5, y: 6, r: 3, alpha: 0.5 },
        ],
      }],
    },
    portraits: (characters || []).map(c => ({
      characterId: c.id,
      draw: [
        { op: 'fill' as const, color: '#1a1a2e', x: 0, y: 0, w: 64, h: 64 },
        { op: 'ellipse' as const, color: '#e8c99b', x: 32, y: 28, w: 30, h: 36 },
        { op: 'circle' as const, color: '#222222', x: 24, y: 24, r: 2 },
        { op: 'circle' as const, color: '#222222', x: 40, y: 24, r: 2 },
      ],
    })),
  };
}
