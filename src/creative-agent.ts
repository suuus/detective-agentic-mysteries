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
  | { op: 'poly';      color: string; points: number[]; alpha?: number };

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
  width: number;        // 32-64
  height: number;       // 32-64
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

const PRIMITIVES_HELP = `You have 10 drawing primitives on a pixel canvas:
  fill — filled rect  {"op":"fill","color":"#hex","x":0,"y":0,"w":10,"h":10}
  circle — filled circle {"op":"circle","color":"#hex","x":5,"y":5,"r":4}
  line — segment {"op":"line","color":"#hex","x1":0,"y1":0,"x2":10,"y2":10,"width":1}
  tri — filled triangle {"op":"tri","color":"#hex","x1":0,"y1":8,"x2":4,"y2":0,"x3":8,"y3":8}
  stroke — stroked rect {"op":"stroke","color":"#hex","x":0,"y":0,"w":10,"h":10,"width":1}
  ellipse — filled ellipse {"op":"ellipse","color":"#hex","x":16,"y":16,"w":20,"h":12}
  arc — stroked arc {"op":"arc","color":"#hex","x":16,"y":16,"r":10,"start":0,"end":3.14,"width":2}
  roundRect — rounded rect {"op":"roundRect","color":"#hex","x":2,"y":2,"w":28,"h":28,"r":4}
  diamond — isometric diamond {"op":"diamond","color":"#hex","cx":24,"cy":12,"hw":20,"hh":15}
  poly — filled polygon {"op":"poly","color":"#hex","points":[x1,y1,x2,y2,x3,y3,x4,y4]}
All ops accept optional "alpha" (0.0-1.0). Arc angles in radians.

IMPORTANT — ISOMETRIC STYLE:
This game uses isometric 2.5D rendering. ALL objects must look like 3D isometric shapes:
- Top face = diamond (flat surface seen from above)
- Left face = darker parallelogram (shadow side)
- Right face = slightly lighter parallelogram
- Standard iso slope: for every pixel right, go UP 0.75 pixels (hh/hw ratio = 3:4)
- Use "diamond" op for top surfaces, "poly" op for left/right side faces
- Use "tri" for iso-aligned triangular details

ISOMETRIC BOX pattern (the fundamental building block):
Given center cx, base Y at baseY, half-widths hw/hh (4:3 ratio), depth d:
  Top diamond: {"op":"diamond","color":"LIGHTEST","cx":cx,"cy":baseY-d-hh,"hw":hw,"hh":hh}
  Left face:   {"op":"poly","color":"DARKEST","points":[cx-hw,baseY-d, cx,baseY-d+hh, cx,baseY+hh, cx-hw,baseY]}
  Right face:  {"op":"poly","color":"MEDIUM","points":[cx+hw,baseY-d, cx,baseY-d+hh, cx,baseY+hh, cx+hw,baseY]}

NEVER use flat rectangles for furniture/decorations. Always use diamond+poly for the iso look.`;

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

RULES:
- Wall tile: 64×72 ISOMETRIC BLOCK. The wall is a 3D block with a diamond top face at (32, 24) with hw=32/hh=24 and left+right side faces extending 24px down. Use poly for side faces (darker shading) and diamond for the top. Add texture detail (mortar lines, grain, weathering) using tri/line ON the iso faces. 5-10 draw ops.
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

  return `You are the PROPS DEPARTMENT for an ISOMETRIC 2.5D pixel-art mystery game. Your job is to fill every room with immersive, setting-specific objects that look like 3D isometric shapes — NOT flat top-down sprites.
Setting: "${skeleton.setting}" | Theme: ${skeleton.settingTheme}
Palette — wall: ${skeleton.visual?.wallColor || '#2d1117'}, accent: ${skeleton.visual?.accentColor || '#c9a84c'}, furniture style: ${skeleton.visual?.furnitureStyle || 'wooden'}

ROOMS:
${roomList}

${PRIMITIVES_HELP}

Output MINIFIED JSON (no extra whitespace) with ALL 3 sections:
{
  "decorations":[{"roomId":"id","items":[{"name":"N","width":48,"height":54,"draw":[...]}]}],
  "furniture":[{"name":"N","width":48,"height":54,"draw":[...]}],
  "ambientProps":[{"name":"N","width":12,"height":12,"count":4,"draw":[...]}]
}

RULES:
- ALL decorations and furniture MUST be drawn as ISOMETRIC 3D BOXES using the iso box pattern:
  1. Draw left face (darkest color) as a "poly" with 4 points
  2. Draw right face (medium color) as a "poly" with 4 points
  3. Draw top face (lightest color) as a "diamond" centered above the box
  4. Add details ON the iso faces using poly/tri/line (NOT flat fill rects)
  * hw:hh ratio must be 4:3 (e.g. hw=20,hh=15 or hw=24,hh=18)
  * Canvas height = 2*hh + depth + margin. Canvas width = 2*hw.
  * The base diamond bottom vertex should be near the canvas bottom edge.

- Decorations: 2-3 per room. Canvas 32-48px wide, height varies. 6-12 draw ops each:
  * Think about what SPECIFIC objects belong in each room based on purpose AND setting
  * A winery cellar gets barrel iso-boxes, a ship bridge gets console iso-boxes
  * Each item must look like a recognisable 3D object from the isometric viewpoint
  * roomId MUST exactly match the room IDs listed above.

- Furniture: 5-8 setting-specific pieces. Canvas 40-56px wide. 8-14 draw ops each:
  * Build each piece as an iso box base + details. E.g. a desk = iso box body + diamond paper on top + poly drawer on right face
  * Include at least 2 seating items and 2 surface/storage items appropriate to the setting
  * Vary sizes: some compact (hw=12), some large (hw=24)

- Ambient props: 3-5 types. 8-16px each. 2-5 draw ops. Small scattered details (can be flat — they're tiny)

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

CHARACTERS:
${charList}

EVIDENCE:
${evList}

${PRIMITIVES_HELP}

Output MINIFIED JSON (no extra whitespace) with these sections:
{
  "evidenceSprites":[{"evidenceId":"id","width":16,"height":16,"draw":[...]}],
  "npcCostumes":[{"characterId":"id","draw":[...]}],
  "portraits":[{"characterId":"id","draw":[...]}],
  "crimeScene":{"bodyOutline":{"draw":[...]},"markers":[{"name":"N","draw":[...]}],"barrier":{"draw":[...]}}
}

RULES:
- Evidence sprites: UNIQUE 16×16 for EVERY item. Visually represent what the item IS (a vial shape, folded letter, knife blade, etc). 3-6 draw ops per item. evidenceId MUST exactly match IDs above.
- NPC costumes: overlay on 32×32 body (body at cx=16 cy=16, rect (10,14)→(22,28), head (11,6)→(21,15)). Add hats, badges, scarves, aprons, glasses, jewelry, uniforms — make each character visually unique and memorable. 2-5 draw ops. characterId MUST match.
- Portraits: 64×64 head+shoulders for EVERY character. Include face shape (ellipse), eyes (circles), hair, distinguishing features (glasses, beard, scar, hat, earrings), clothing neckline. Use the character's role to inform their appearance. 6-15 draw ops each for rich detail. characterId MUST match.
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
      width: 40, height: 44,
      draw: [
        { op: 'fill' as const, color: '#3a2510', x: 6, y: 31, w: 2, h: 10 },
        { op: 'fill' as const, color: '#3a2510', x: 32, y: 27, w: 2, h: 10 },
        { op: 'poly' as const, color: '#3a2510', points: [0, 25, 20, 40, 20, 44, 0, 29] },
        { op: 'poly' as const, color: '#4a3218', points: [40, 25, 20, 40, 20, 44, 40, 29] },
        { op: 'diamond' as const, color: '#6b4423', cx: 20, cy: 25, hw: 20, hh: 15 },
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
