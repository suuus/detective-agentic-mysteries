/**
 * Director of Photography (DP) — Visual QA agent.
 *
 * Uses Playwright to screenshot the rendered texture grid, then sends
 * the image to a vision-capable model via the Copilot SDK. The model
 * evaluates visual quality and returns structured feedback. Bad assets
 * are flagged for re-generation by the Creative Agency.
 *
 * Flow:
 *   1. captureTextureGrid() — Playwright opens /review.html, takes screenshot
 *   2. evaluateScreenshot() — Vision model analyses the image
 *   3. Returns DPReview with per-category scores and specific issues
 */

import { chromium, type Browser, type Page } from "playwright";

// ── Types ────────────────────────────────────────────────────────

export interface DPIssue {
  category: 'furniture' | 'evidence' | 'decorations' | 'wall' | 'npcs' | 'portraits' | 'ambient';
  item?: string;       // specific item name/id if applicable
  severity: 'critical' | 'major' | 'minor';
  description: string; // what's wrong
  suggestion: string;  // how to fix it
}

export interface DPReview {
  overallScore: number;      // 1-10
  overallNotes: string;      // brief summary
  categories: {
    name: string;
    score: number;           // 1-10
    count: number;
    notes: string;
  }[];
  issues: DPIssue[];
  passesQuality: boolean;    // true if overallScore >= 5
  screenshotBase64?: string; // the captured screenshot (for logging/debug)
}

// ── System prompt ────────────────────────────────────────────────

export const DP_SYSTEM_PROMPT = `You are the DIRECTOR OF PHOTOGRAPHY for an isometric 2.5D pixel-art detective game.

You are reviewing a grid of procedurally generated textures. Each texture was created by AI agents using a draw-op DSL (filled rectangles, polygons, diamonds, circles, lines, triangles).

The game uses an ISOMETRIC perspective where:
- Furniture and decorations should look like 3D iso boxes: diamond top face + two parallelogram side faces
- Left face = darkest (shadow), Right face = medium, Top face = lightest
- The hw:hh ratio of iso shapes should be 4:3
- Evidence items are small (16×16) flat sprites with bright colors

EVALUATE the screenshot and respond with ONLY a JSON object (no markdown, no explanation):
{
  "overallScore": 7,
  "overallNotes": "Brief 1-2 sentence summary",
  "categories": [
    { "name": "FURNITURE", "score": 7, "count": 10, "notes": "Most pieces have proper iso shape" },
    { "name": "EVIDENCE", "score": 5, "count": 8, "notes": "Some items too dark" }
  ],
  "issues": [
    {
      "category": "furniture",
      "item": "Chair",
      "severity": "major",
      "description": "Looks like a flat rectangle instead of an iso box",
      "suggestion": "Needs left poly + right poly + top diamond structure"
    }
  ]
}

SCORING GUIDE:
- 9-10: Professional quality, distinctive, all shapes correct
- 7-8: Good quality, mostly correct iso shapes, some minor issues
- 5-6: Acceptable, noticeable problems but playable
- 3-4: Poor, many flat/broken shapes, lacks visual coherence
- 1-2: Unusable, mostly blank/invisible/corrupt textures

WHAT TO LOOK FOR:
- Furniture: Does each piece have 3 visible iso faces (left dark, right medium, top light)?
- Evidence: Are items bright and recognisable? Can you tell what each item is?
- Decorations: Do they match the setting? Are they varied per room?
- Wall: Does it have proper iso-block 3D appearance?
- NPCs: Do characters have distinct appearances? Hair/clothes/accessories visible?
- Portraits: Do faces have eyes, features, distinct look per character?
- Ambient props: Are they visible and varied?

COMMON ISSUES TO FLAG:
- "flat" — uses rectangles instead of iso polygons (severity: major)
- "invisible" — texture rendered blank or transparent (severity: critical)
- "monochrome" — all same color, no shading contrast (severity: major)
- "oversized" — draws outside canvas bounds (severity: minor)
- "dark_evidence" — evidence too dark to see on floor (severity: major)
- "identical" — multiple items look the same (severity: minor)`;

export interface TextureMetric {
  category: string;
  name: string;
  width: number;
  height: number;
  filledPixelPercent: number;  // 0-100: how much of canvas has non-transparent pixels
  uniqueColors: number;        // number of distinct colors used
  drawOpCount: number;         // how many draw ops were provided
  issues: string[];            // auto-detected problems
}

// ── Playwright capture ───────────────────────────────────────────

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({ headless: true });
  }
  return browser;
}

/**
 * Opens the texture review page, waits for all textures to render,
 * captures a full-page screenshot, and extracts per-texture quality metrics.
 */
export async function captureTextureGrid(serverPort: number = 3000): Promise<{
  screenshot: Buffer;
  sections: { label: string; count: number }[];
  metrics: TextureMetric[];
}> {
  const b = await getBrowser();
  const page: Page = await b.newPage({ viewport: { width: 960, height: 1200 } });

  try {
    await page.goto(`http://localhost:${serverPort}/review.html`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });

    // Wait for Phaser to finish rendering all textures
    await page.waitForFunction(() => (window as any).__DP_READY === true, {
      timeout: 60_000,
      polling: 500,
    });

    // Small delay for Phaser to fully render the grid
    await page.waitForTimeout(1500);

    // Get section metadata
    const sections = await page.evaluate(() => (window as any).__DP_SECTIONS || []);

    // Extract per-texture quality metrics from the Phaser canvas
    const metrics: TextureMetric[] = await page.evaluate(() => {
      const game = (window as any).Phaser?.GAMES?.[0];
      if (!game) return [];
      const texManager = game.textures;
      if (!texManager) return [];
      const world = (window as any)._generatedWorld;
      if (!world) return [];
      const ca = world.creativeAssets || {};
      const results: any[] = [];

      function analyzeTexture(key: string, category: string, name: string, drawOpCount: number) {
        if (!texManager.exists(key)) return;
        try {
          const source = texManager.get(key).getSourceImage();
          if (!source || !(source instanceof HTMLCanvasElement || source instanceof HTMLImageElement)) return;

          // Draw to temp canvas to read pixels
          const canvas = document.createElement('canvas');
          const w = source.width || 32;
          const h = source.height || 32;
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          ctx.drawImage(source as any, 0, 0);
          const data = ctx.getImageData(0, 0, w, h).data;

          let filledPixels = 0;
          const colorSet = new Set<string>();
          for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] > 10) { // non-transparent
              filledPixels++;
              colorSet.add(`${data[i]},${data[i+1]},${data[i+2]}`);
            }
          }
          const totalPixels = w * h;
          const filledPercent = Math.round((filledPixels / totalPixels) * 100);
          const uniqueColors = colorSet.size;

          const issues: string[] = [];
          if (filledPercent < 10) issues.push('mostly_empty');
          if (filledPercent < 3) issues.push('invisible');
          if (uniqueColors < 3 && category !== 'ambient') issues.push('monochrome');
          if (uniqueColors === 1) issues.push('single_color');
          if (category === 'evidence' && filledPercent < 15) issues.push('dark_evidence');

          results.push({ category, name, width: w, height: h, filledPixelPercent: filledPercent, uniqueColors, drawOpCount, issues });
        } catch {}
      }

      // Furniture
      ['furn_table','furn_desk','furn_bookshelf','furn_plant','furn_crate','furn_cabinet'].forEach(k => {
        analyzeTexture(k, 'furniture', k.replace('furn_',''), 5);
      });
      if (Array.isArray(ca.furniture)) {
        ca.furniture.forEach((f: any, i: number) => {
          analyzeTexture(f._texKey || `furn_custom_${i}`, 'furniture', f.name || `custom_${i}`, f.draw?.length || 0);
        });
      }

      // Evidence
      for (const ev of (world.evidence || [])) {
        const sprite = ca.evidenceSprites?.find((s: any) => s.evidenceId === ev.id);
        analyzeTexture('ev_' + ev.id, 'evidence', ev.name || ev.id, sprite?.draw?.length || 0);
      }

      // Decorations
      if (Array.isArray(ca.decorations)) {
        for (const rd of ca.decorations) {
          for (const item of (rd.items || [])) {
            if (item._texKey) analyzeTexture(item._texKey, 'decorations', item.name || item._texKey, item.draw?.length || 0);
          }
        }
      }

      // Wall
      analyzeTexture('tile_wall', 'wall', 'wall', ca.wallTile?.draw?.length || 3);

      // NPCs
      for (const ch of (world.characters || [])) {
        analyzeTexture('npc_' + ch.id, 'npcs', ch.name || ch.id, 0);
      }

      // Portraits
      for (const ch of (world.characters || [])) {
        const portrait = ca.portraits?.find((p: any) => p.characterId === ch.id);
        analyzeTexture('portrait_' + ch.id, 'portraits', ch.name || ch.id, portrait?.draw?.length || 0);
      }

      // Ambient props
      if (Array.isArray(ca.ambientProps)) {
        ca.ambientProps.forEach((p: any, i: number) => {
          analyzeTexture(p._texKey || `prop_${i}`, 'ambient', p.name || `prop_${i}`, p.draw?.length || 0);
        });
      }

      return results;
    });

    // Take full page screenshot
    const screenshot = await page.screenshot({ fullPage: true, type: 'png' });

    return { screenshot, sections, metrics };
  } finally {
    await page.close();
  }
}

/**
 * Clean up the browser instance.
 */
export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

// ── Review evaluation ────────────────────────────────────────────

/**
 * Build the repairPrompt from DP issues for the Creative Agency to fix specific assets.
 */
export function buildRepairPrompt(review: DPReview, setting: string): string {
  const criticalIssues = review.issues.filter(i => i.severity === 'critical');
  const majorIssues = review.issues.filter(i => i.severity === 'major');

  if (criticalIssues.length === 0 && majorIssues.length === 0) {
    return ''; // nothing to repair
  }

  const issueList = [...criticalIssues, ...majorIssues].map(i =>
    `- [${i.severity.toUpperCase()}] ${i.category}${i.item ? ` "${i.item}"` : ''}: ${i.description}. Fix: ${i.suggestion}`
  ).join('\n');

  return `The Director of Photography reviewed the rendered textures and found ${criticalIssues.length} critical + ${majorIssues.length} major issues.

Setting: "${setting}"
Overall score: ${review.overallScore}/10

ISSUES TO FIX:
${issueList}

Re-generate ONLY the items listed above. Use the same JSON format as before. Follow the isometric design rules strictly:
- Furniture MUST use: left poly (darkest) + right poly (medium) + top diamond (lightest) + detail ops
- Evidence MUST use bright colors (#88ccff, #ff6666, #f5f0d0) on 16×16 canvas
- All coordinates must be within canvas bounds

Output ONLY minified JSON with the fixed items.`;
}
