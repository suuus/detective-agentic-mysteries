---
description: Rules for drawing isometric furniture, props, and NPC sprites in BootScene
applyTo: '**/BootScene.js,**/CruiseBootScene.js,**/RandomBootScene.js,**/ManorScene.js'
---

# Isometric Prop Drawing Rules

When generating procedural isometric furniture/props textures, follow these rules strictly:

## Grid Constants
- Tile diamond: 64×48 px (hw=32, hh=24)
- **ALL iso diamonds must use hw:hh = 4:3 ratio** (e.g. 24:18, 20:15, 8:6)
- Iso slope: S = 0.75 (hh/hw)

## isoBox(g, cx, baseY, hw, hh, depth, topC, leftC, rightC)
- `baseY` = where box sits on ground (base diamond center Y)
- Canvas: width=2*hw, height≥2*hh+depth, cx=width/2, baseY=height-hh
- Returns `{ topY, diamondY }` — topY = baseY-depth, diamondY = topY-hh

## Face Detail Positioning
Side face details start from **center seam** `rFaceTop = topY + hh`, NOT from `topY`:
```js
const rFaceTop = topY + hh;  // visible top of right/left face at center column
rightFaceRect(g, cx+2, rFaceTop+2, width, height, color);
```

## NEVER use fillRect for face details
Use parallelogram helpers that follow the iso slope:
- `rightFaceRect(g, x, y, w, h, color)` — slopes right at -0.75
- `leftFaceRect(g, x, y, w, h, color)` — slopes left at -0.75
- `topDiamond(g, cx, cy, hw, hh, color)` — diamond for top-surface items

## Colors
- Left face: darken(base, 0.45-0.55) — darkest
- Right face: darken(base, 0.65-0.75)  
- Top face: base color

## Placement Origin
- Furniture: `.setOrigin(0.5, 0.75)`
- NPCs: `.setOrigin(0.5, 0.85)`
- Walls: `.setOrigin(0.5, 0.67)`

## NPC Directional Sprites
Each NPC generates 4 direction × 4 mood = 16 textures via `_drawNPCSprite(g, S, npc, mood, facing)`:
- Key: `npc_{id}` (down/neutral), `npc_{id}_{dir}`, `npc_{id}_{mood}`, `npc_{id}_{dir}_{mood}`
- `down`: front face — both eyes, eyebrows, full mouth
- `up`: back of head — no eyes/mouth, just hair filling the face area
- `left`: side view — single eye on left, narrower mouth shifted left
- `right`: side view — single eye on right, narrower mouth shifted right
- ManorScene swaps texture via `isoSprite.setTexture(dirTexKey)` based on physics velocity each frame
