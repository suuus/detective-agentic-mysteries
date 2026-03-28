/**
 * Creative Agency — AI agent that autonomously designs visual assets for
 * procedurally rendered game worlds.  The agent decides WHAT to create based
 * on the setting (wine barrels for a winery, telescopes for an observatory,
 * etc.) and outputs low-level drawing instructions that the client renders.
 *
 * Drawing primitives map directly to Phaser's Graphics API:
 *   fill   → g.fillStyle(color); g.fillRect(x, y, w, h)
 *   circle → g.fillStyle(color); g.fillCircle(x, y, r)
 *   line   → g.lineStyle(width, color); g.lineBetween(x1, y1, x2, y2)
 *   tri    → g.fillStyle(color); g.fillTriangle(x1,y1, x2,y2, x3,y3)
 *   stroke → g.lineStyle(width, color); g.strokeRect(x, y, w, h)
 */

// ── Drawing DSL ──────────────────────────────────────────────────

export type DrawOp =
  | { op: 'fill';   color: string; x: number; y: number; w: number; h: number }
  | { op: 'circle'; color: string; x: number; y: number; r: number }
  | { op: 'line';   color: string; x1: number; y1: number; x2: number; y2: number; width: number }
  | { op: 'tri';    color: string; x1: number; y1: number; x2: number; y2: number; x3: number; y3: number }
  | { op: 'stroke'; color: string; x: number; y: number; w: number; h: number; width: number };

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

  /** Custom wall tile drawing (32×32 px). */
  wallTile: {
    draw: DrawOp[];   // 32×32 wall tile instructions
  };
}

// ── Prompt builder ───────────────────────────────────────────────

export function buildCreativePrompt(skeleton: {
  title: string;
  setting: string;
  settingTheme: string;
  rooms: { id: string; name: string }[];
  visual?: { wallColor: string; wallAccent: string; accentColor: string; furnitureStyle: string };
}): string {
  const roomList = skeleton.rooms.map(r => `- ${r.id}: "${r.name}"`).join('\n');

  return `You are a VISUAL ARTIST for a top-down 2D pixel-art mystery game.
The setting is: "${skeleton.setting}"
Theme: ${skeleton.settingTheme}  |  Title: "${skeleton.title}"
Palette reference — wall: ${skeleton.visual?.wallColor || '#2d1117'}, accent: ${skeleton.visual?.accentColor || '#c9a84c'}

ROOMS:
${roomList}

Your job: INVENT the decorations, props, particles, atmosphere, and wall art that make this world feel alive. You decide what objects exist — there is no predefined list. A winery gets barrels, wine stains, corkscrews. A space station gets control panels, wiring, oxygen tanks. A medieval castle gets torches, tapestries, suits of armour. Be creative and specific to the setting.

You output drawing instructions. The renderer supports 5 primitives on a pixel canvas:
  fill   — filled rectangle  { "op":"fill",   "color":"#hex", "x":0, "y":0, "w":10, "h":10 }
  circle — filled circle     { "op":"circle", "color":"#hex", "x":5, "y":5, "r":4 }
  line   — line segment      { "op":"line",   "color":"#hex", "x1":0,"y1":0,"x2":10,"y2":10, "width":1 }
  tri    — filled triangle   { "op":"tri",    "color":"#hex", "x1":0,"y1":8,"x2":4,"y2":0,"x3":8,"y3":8 }
  stroke — stroked rectangle { "op":"stroke", "color":"#hex", "x":0, "y":0, "w":10, "h":10, "width":1 }

Output a single JSON object — NO other text:

{
  "decorations": [
    {
      "roomId": "room_id_here",
      "items": [
        {
          "name": "Human-readable name",
          "width": 32,
          "height": 32,
          "draw": [
            { "op": "fill", "color": "#5c3a1e", "x": 2, "y": 4, "w": 28, "h": 24 },
            { "op": "circle", "color": "#4a2e16", "x": 16, "y": 16, "r": 8 }
          ]
        }
      ]
    }
  ],
  "ambientProps": [
    {
      "name": "Human-readable name",
      "width": 16,
      "height": 16,
      "count": 4,
      "draw": [
        { "op": "fill", "color": "#aaaaaa", "x": 2, "y": 2, "w": 12, "h": 1 },
        { "op": "line", "color": "#999999", "x1": 4, "y1": 2, "x2": 8, "y2": 10, "width": 1 }
      ]
    }
  ],
  "particles": {
    "color": "#e8dcc8",
    "size": 2,
    "speed": { "min": 3, "max": 10 },
    "alpha": { "start": 0.0, "end": 0.2 },
    "frequency": 400,
    "lifespan": 6000,
    "blendMode": "ADD"
  },
  "roomAmbiance": {
    "room_id": { "tintColor": "#1a0a00", "tintAlpha": 0.06 }
  },
  "wallTile": {
    "draw": [
      { "op": "fill", "color": "#2d1117", "x": 0, "y": 0, "w": 32, "h": 32 },
      { "op": "fill", "color": "#3a1520", "x": 2, "y": 2, "w": 28, "h": 12 },
      { "op": "fill", "color": "#3a1520", "x": 2, "y": 18, "w": 28, "h": 12 }
    ]
  }
}

RULES:
- Invent 2-4 decorations PER ROOM that are specific to that room's purpose and the overall setting. Be imaginative.
- Invent 2-3 ambient props that would be scattered around the setting (small items, debris, details).
- Decoration textures: 24-48 px wide/tall. Ambient props: 8-16 px. Wall tile is always 32×32.
- Use 3-8 draw ops per item. Keep it simple but recognisable — this is pixel art, not photorealism.
- Particle config must match the atmosphere (embers for a forge, mist for a cave, sparks for a factory, dust motes for an old library).
- Room ambiance tints: subtle (tintAlpha 0.03-0.12), varied between rooms to differentiate them.
- Wall tile must be 32×32 and should reflect the building material (stone blocks, corrugated metal, wooden panels, etc.).
- All colors must be valid 6-digit hex codes.
- Output ONLY the JSON object.`;
}

// ── Fallback defaults ────────────────────────────────────────────

export function getDefaultCreativeAssets(rooms: { id: string; name: string }[]): CreativeAssets {
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
        { op: 'fill' as const, color: '#2d1117', x: 0, y: 0, w: 32, h: 32 },
        { op: 'fill' as const, color: '#3a1520', x: 2, y: 2, w: 28, h: 12 },
        { op: 'fill' as const, color: '#3a1520', x: 2, y: 18, w: 28, h: 12 },
      ],
    },
  };
}
