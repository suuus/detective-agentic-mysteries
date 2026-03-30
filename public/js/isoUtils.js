/**
 * isoUtils.js — Isometric coordinate system utilities.
 *
 * Tile dimensions: 64×48 diamond (width × visible height).
 * World coordinates are in tile units (tx, ty).
 * Screen coordinates are in pixels after isometric projection.
 *
 * The isometric diamond has:
 *   - Width = ISO_TILE_W (64)
 *   - Height = ISO_TILE_H (48) — the visible diamond top surface
 *   - Depth = ISO_TILE_DEPTH (24) — wall/block side height
 */

export const ISO_TILE_W = 64;
export const ISO_TILE_H = 48;
export const ISO_TILE_DEPTH = 24;

/**
 * Convert world tile coordinates to isometric screen position.
 * @param {number} tx - Tile X in world grid
 * @param {number} ty - Tile Y in world grid
 * @param {number} [offsetX=0] - Pixel offset to center the map
 * @param {number} [offsetY=0] - Pixel offset to center the map
 * @returns {{ x: number, y: number }}
 */
export function tileToScreen(tx, ty, offsetX = 0, offsetY = 0) {
  return {
    x: (tx - ty) * (ISO_TILE_W / 2) + offsetX,
    y: (tx + ty) * (ISO_TILE_H / 2) + offsetY,
  };
}

/**
 * Convert isometric screen position back to world tile coordinates.
 * @param {number} sx - Screen X pixel
 * @param {number} sy - Screen Y pixel
 * @param {number} [offsetX=0]
 * @param {number} [offsetY=0]
 * @returns {{ tx: number, ty: number }}
 */
export function screenToTile(sx, sy, offsetX = 0, offsetY = 0) {
  const rx = sx - offsetX;
  const ry = sy - offsetY;
  return {
    tx: (rx / (ISO_TILE_W / 2) + ry / (ISO_TILE_H / 2)) / 2,
    ty: (ry / (ISO_TILE_H / 2) - rx / (ISO_TILE_W / 2)) / 2,
  };
}

/**
 * Convert a world-space pixel position (used by physics) to screen position.
 * World pixels use the old tile size (T=32) for physics. This converts them
 * through tile coords to screen coords.
 * @param {number} wx - World pixel X (physics space)
 * @param {number} wy - World pixel Y (physics space)
 * @param {number} T - Old tile size in physics space (32)
 * @param {number} offsetX - Screen offset
 * @param {number} offsetY - Screen offset
 * @returns {{ x: number, y: number }}
 */
export function worldToScreen(wx, wy, T, offsetX, offsetY) {
  const tx = wx / T;
  const ty = wy / T;
  return tileToScreen(tx, ty, offsetX, offsetY);
}

/**
 * Convert screen position to world-space pixels (physics space).
 * @param {number} sx - Screen X
 * @param {number} sy - Screen Y
 * @param {number} T - Tile size in physics space (32)
 * @param {number} offsetX
 * @param {number} offsetY
 * @returns {{ x: number, y: number }}
 */
export function screenToWorld(sx, sy, T, offsetX, offsetY) {
  const { tx, ty } = screenToTile(sx, sy, offsetX, offsetY);
  return { x: tx * T, y: ty * T };
}

/**
 * Calculate the isometric depth value for a world position.
 * Higher depth = rendered on top (further south in iso view).
 * @param {number} tx - Tile X
 * @param {number} ty - Tile Y
 * @returns {number}
 */
export function isoDepth(tx, ty) {
  return tx + ty;
}

/**
 * Calculate the isometric depth from world-space pixel position.
 * @param {number} wx - World pixel X
 * @param {number} wy - World pixel Y
 * @param {number} T - Tile size (32)
 * @returns {number}
 */
export function isoDepthFromWorld(wx, wy, T) {
  return (wx / T) + (wy / T);
}

/**
 * Calculate the screen bounds needed for an isometric map.
 * @param {number} mapW - Map width in tiles
 * @param {number} mapH - Map height in tiles
 * @returns {{ width: number, height: number, offsetX: number, offsetY: number }}
 */
export function isoMapBounds(mapW, mapH) {
  // The iso map is a rotated diamond
  // Leftmost point: tile (0, mapH-1) → screenX = -(mapH-1) * TILE_W/2
  // Rightmost point: tile (mapW-1, 0) → screenX = (mapW-1) * TILE_W/2
  // Top point: tile (0, 0) → screenY = 0
  // Bottom point: tile (mapW-1, mapH-1) → screenY = (mapW-1 + mapH-1) * TILE_H/2
  const width = (mapW + mapH) * (ISO_TILE_W / 2);
  const height = (mapW + mapH) * (ISO_TILE_H / 2);
  // Offset so that tile (0,0) isn't at the left edge — center the map
  const offsetX = mapH * (ISO_TILE_W / 2);
  const offsetY = ISO_TILE_H / 2; // Small top margin
  return { width, height, offsetX, offsetY };
}

/**
 * Draw an isometric diamond (flat tile surface) on a Phaser Graphics object.
 * The diamond is centered at (cx, cy) in the graphics local space.
 * @param {Phaser.GameObjects.Graphics} g
 * @param {number} cx - Center X
 * @param {number} cy - Center Y
 * @param {number} color - Fill color
 * @param {number} [alpha=1] - Fill alpha
 */
export function drawIsoDiamond(g, cx, cy, color, alpha = 1) {
  const hw = ISO_TILE_W / 2; // 32
  const hh = ISO_TILE_H / 2; // 24
  g.fillStyle(color, alpha);
  g.beginPath();
  g.moveTo(cx, cy - hh);       // top
  g.lineTo(cx + hw, cy);       // right
  g.lineTo(cx, cy + hh);       // bottom
  g.lineTo(cx - hw, cy);       // left
  g.closePath();
  g.fillPath();
}

/**
 * Draw an isometric block (diamond top + left face + right face).
 * Used for walls and raised surfaces.
 * @param {Phaser.GameObjects.Graphics} g
 * @param {number} cx - Diamond center X
 * @param {number} cy - Diamond center Y
 * @param {number} topColor - Top face color
 * @param {number} leftColor - Left face color (darker)
 * @param {number} rightColor - Right face color (slightly darker)
 * @param {number} depth - Block height in pixels
 * @param {number} [alpha=1]
 */
export function drawIsoBlock(g, cx, cy, topColor, leftColor, rightColor, depth, alpha = 1) {
  const hw = ISO_TILE_W / 2;
  const hh = ISO_TILE_H / 2;

  // Left face
  g.fillStyle(leftColor, alpha);
  g.beginPath();
  g.moveTo(cx - hw, cy);           // top-left of diamond
  g.lineTo(cx, cy + hh);           // bottom of diamond
  g.lineTo(cx, cy + hh + depth);   // bottom + depth
  g.lineTo(cx - hw, cy + depth);   // left + depth
  g.closePath();
  g.fillPath();

  // Right face
  g.fillStyle(rightColor, alpha);
  g.beginPath();
  g.moveTo(cx + hw, cy);           // top-right of diamond
  g.lineTo(cx, cy + hh);           // bottom of diamond
  g.lineTo(cx, cy + hh + depth);   // bottom + depth
  g.lineTo(cx + hw, cy + depth);   // right + depth
  g.closePath();
  g.fillPath();

  // Top face (diamond)
  drawIsoDiamond(g, cx, cy, topColor, alpha);
}

/**
 * Darken a hex color by a factor (0-1, where 0.8 = 20% darker).
 * @param {number} color
 * @param {number} factor
 * @returns {number}
 */
export function darken(color, factor) {
  const r = Math.floor(((color >> 16) & 0xff) * factor);
  const gVal = Math.floor(((color >> 8) & 0xff) * factor);
  const b = Math.floor((color & 0xff) * factor);
  return (r << 16) | (gVal << 8) | b;
}
