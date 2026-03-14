# Copilot Instructions for Shadows of Blackwood Manor

## Project Context

This is a 2D AI-powered detective game built with Phaser 3 + Express + GitHub Copilot SDK. Each NPC is an independent AI agent with a unique system prompt. An AI "Director" agent orchestrates the game world between days.

## Tech Stack

- **Runtime:** Node.js with tsx (TypeScript execution)
- **Package type:** ES modules (`"type": "module"` — use `.js` extensions in imports)
- **Backend:** Express.js serving static files from `public/` and API routes
- **AI:** `@github/copilot-sdk` — CopilotClient creates sessions per NPC
- **Frontend:** Phaser 3 (CDN), vanilla JS modules, HTML/CSS overlays
- **No build step:** Frontend JS runs directly in browser as ES modules

## Important Conventions

- NPC sessions use `sessionId: "blackwood-{characterId}"` and `systemMessage: { mode: "replace" }`
- All sprites are generated procedurally in `BootScene.js` using `this.make.graphics()` + `generateTexture()` — no external image assets
- The camera zoom is 2x, so HUD elements use `cameras.main.width / 2` for viewport-aware positioning
- Phaser keyboard is disabled when HTML overlays are open (dialog, inventory, accusation) via `this.input.keyboard.enabled`
- The clock and timer bar live in the HTML HUD bar, not on the Phaser canvas
- Day cycle: 5 real minutes = 10:00 AM to 6:00 PM in-game
- NPC tools (`src/tools.ts`) extract `characterId` from `invocation.sessionId` by stripping the `blackwood-` prefix

## Key Design Documents

Read these before making changes:

- **`AGENTS.md`** — Project overview, file map, architecture, API reference
- **`docs/npc-design-guide.md`** — NPC system prompts, 12 game rules, sentiment system, Director agent, how to build new levels
- **`docs/game-architecture.md`** — Full mechanics: map system, UI panels, Phaser scenes, day/night cycle, theming, building different settings

## Session Health & Recovery

NPC sessions can get stuck or crash. The system handles this via:
- `talkWithRetry()` — 2 attempts with `session.abort()` between failures
- `activeRequests` Map — tracks every in-flight `sendAndWait` with timestamps
- 30-second healthcheck interval detects sessions stuck >50s, aborts and recreates them
- `sendAndCollect()` (night conversations) also tracks and auto-recovers

## Building a New Level

See `docs/npc-design-guide.md` section 16 "How to Build a New Level" for the full checklist. The reusable components (server, tools, dialog UI, inventory, sentiment system) don't change. Level-specific components (characters, evidence, map, sprites, Director prompt) need new content.

## Common Pitfalls

- Don't use `document.createElement('canvas')` for Phaser textures — use `this.make.graphics()` + `generateTexture(key, w, h)`
- Don't use `this.cameras.main.width` for HUD positioning — divide by zoom (2) first
- Don't reference removed Phaser objects (like `this.dayText`) — the clock is now HTML-based
- Don't use spritesheet approach for player — individual frame textures (`player_down_0`, `player_left_1`, etc.) are more reliable
- NPC system prompts must include all 12 game rules (see `docs/npc-design-guide.md` section 2)
- Evidence IDs must match between `gameState.ts` (definitions), `BootScene.js` (sprites as `ev_{id}`), and `ManorScene.js` (placement)
