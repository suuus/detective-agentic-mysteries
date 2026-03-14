# Shadows of Blackwood Manor — Developer Instructions

## What This Is

A 2D web-based detective game powered by AI. Players explore a manor, collect evidence, interrogate AI-powered suspects, and solve a murder mystery. Each NPC is an independent AI agent (Copilot SDK session) with unique personality, secrets, and emotional state. An invisible "Director" agent orchestrates the game world between days.

## Quick Start

```bash
npm run dev          # Start server (spawns Copilot CLI automatically)
# Open http://localhost:3000
```

The server runs on port 3000. It serves static files from `public/` and provides API endpoints for the game.

## Project Structure

```
├── server.ts                    # Express server + Copilot SDK session management
├── src/
│   ├── characters/              # NPC definitions (one file per character)
│   │   ├── types.ts             # CharacterDefinition interface
│   │   ├── index.ts             # Exports characters array + getCharacter()
│   │   ├── victoria.ts          # Lady Victoria (wife, affair with Price)
│   │   ├── hartwell.ts          # Dr. Hartwell (THE KILLER)
│   │   ├── clara.ts             # Clara (daughter, overheard argument)
│   │   ├── price.ts             # Mr. Price (business partner, affair with Victoria)
│   │   └── agnes.ts             # Mrs. Whitfield (housekeeper, observant)
│   ├── director.ts              # AI Director agent (orchestrates nights)
│   ├── gameState.ts             # Game state, evidence, day/night, sentiments, accusation logic
│   └── tools.ts                 # Copilot SDK tools available to NPC agents
├── public/
│   ├── index.html               # Game page with all UI panels
│   ├── css/style.css            # Noir theme (CSS variables for easy re-theming)
│   └── js/
│       ├── main.js              # Phaser init, HUD wiring, accusation modal
│       ├── api.js               # GameAPI class (all backend calls)
│       ├── dialog.js            # DialogManager (chat UI, streaming, evidence presentation)
│       ├── inventory.js         # InventoryManager (evidence list, notebook, accusation checkboxes)
│       └── scenes/
│           ├── BootScene.js     # Procedural sprite generation (tiles, NPCs, evidence, furniture)
│           ├── ManorScene.js    # Game world (rooms, physics, NPCs, interaction, day/night cycle)
│           └── UIScene.js       # HUD overlay scene (minimal)
└── docs/
    ├── npc-design-guide.md      # NPC architecture: prompts, sentiment, tools, Director
    └── game-architecture.md     # Full game mechanics, UI, map system, building new levels
```

## Architecture Overview

### 9+ AI Agents Running Simultaneously

| Agent | Session ID | Role | Model |
|-------|-----------|------|-------|
| Victoria | blackwood-victoria | NPC suspect | gpt-4.1 |
| Hartwell | blackwood-hartwell | NPC suspect (killer) | gpt-4.1 |
| Clara | blackwood-clara | NPC suspect | gpt-4.1 |
| Price | blackwood-price | NPC suspect | gpt-4.1 |
| Agnes | blackwood-agnes | NPC suspect | gpt-4.1 |
| Director | blackwood-director | Night orchestrator | gpt-4.1 |
| Forensics | blackwood-forensics | Evidence analysis (streaming) | gpt-4.1 |
| Narrator | blackwood-narrator | Atmospheric prose generation | gpt-4.1 |
| Profiler | blackwood-profiler | Detective behavior analysis | gpt-4.1 |
| Red Herring | blackwood-{dynamic} | Dynamically spawned misleading NPC (random archetype per game) | gpt-4.1 |
| Skeleton Key | *(on-demand)* | Procedural mystery generation | gpt-4.1 |

Each NPC session has:
- `systemMessage: { mode: "replace" }` — full character prompt
- `tools` — 11 tools (check_evidence_shown, investigation_progress, reveal_clue, day_info, update_sentiment, get_my_sentiment, create_evidence, show_body_language, get_detective_profile, get_overheard_info, gossip_about_detective)
- `streaming: true` for real-time response display
- `infiniteSessions: { enabled: false }` — no workspace persistence

### Agent-Agent Communication

Agents communicate through **server-mediated patterns**, not direct connections:

1. **Tool-mediated state** — NPCs call tools that modify shared game state; other agents read it through their own tools
2. **Orchestrated conversations** — Server routes NPC A's response as context into NPC B's prompt (night phase, 4 exchanges per pair)
3. **Fire-and-forget broadcasting** — After interrogation: gossip spreading, player profiling, contradiction detection run async
4. **`onPostToolUse` hooks** — SDK lifecycle hooks fire after every NPC tool call, propagating side effects (emotional shifts, clue reveals, body language) to nearby NPCs automatically — during both interrogations and night conversations

### Key Flows

**Player interrogates NPC:** `POST /api/talk/:characterId` → SSE stream → dialog UI

**Night falls (every 5 real minutes):**
1. Director analyzes game state via tools
2. Director calls `submit_night_plan` (conversation pairs, NPC positions, evidence changes)
3. NPC-to-NPC conversations execute (4 exchanges per pair)
4. Player sees conversations displayed
5. Next morning: NPCs get conversation memories injected, positions/evidence updated

**Player accuses:** `POST /api/accuse` → validates suspect + motive + evidence

## Key Files to Edit

### When changing game content (mystery, characters, evidence):
- `src/characters/*.ts` — Character system prompts
- `src/gameState.ts` — Evidence definitions, accusation validation, initial sentiments
- `src/director.ts` — Director's knowledge of the full mystery
- `public/js/scenes/BootScene.js` — Sprite generation for characters/evidence
- `public/js/scenes/ManorScene.js` — Room layout, NPC placement, evidence placement
- `public/js/main.js` — Suspects list in accusation modal

### When changing game mechanics:
- `src/tools.ts` — Tools available to NPC agents
- `server.ts` — API routes, session management, night conversation logic
- `src/gameState.ts` — State tracking, day advancement logic

### When changing visuals/UI:
- `public/css/style.css` — Theme via CSS variables at top
- `public/index.html` — Panel structure
- `public/js/scenes/BootScene.js` — Procedural sprite art

### When changing game timing:
- `public/js/scenes/ManorScene.js` — `DAY_DURATION`, `GAME_START_HOUR`, `GAME_END_HOUR`

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/talk/:characterId` | SSE streaming interrogation |
| GET | `/api/evidence` | All evidence with collected status |
| GET | `/api/evidence/positions` | Tile positions of uncollected evidence |
| POST | `/api/evidence/:id/collect` | Collect evidence item |
| POST | `/api/evidence/:id/show/:characterId` | Show evidence to NPC |
| GET | `/api/state` | Full game state |
| GET | `/api/sentiments` | All NPC sentiments |
| GET | `/api/sentiments/:characterId` | Single NPC sentiment |
| POST | `/api/accuse` | Submit accusation |
| GET | `/api/day` | Current day/time + config |
| POST | `/api/day/advance` | Trigger night/dawn transition |
| GET | `/api/health` | Session health + stuck detection |
| GET | `/api/hidden-room/check` | Auto-reveal check (Day 3+, 6+ evidence) |
| POST | `/api/hidden-room/reveal` | Manually reveal hidden room |
| GET | `/api/red-herring/check` | Probabilistic auto-activation check |
| POST | `/api/red-herring/activate` | Manually activate red herring NPC |
| POST | `/api/reset` | Reset game, disconnect all sessions |

## NPC Session Health System

- **Healthcheck interval:** 30 seconds
- **Stuck threshold:** 50 seconds (abort + recreate)
- **Active request tracking:** Every `sendAndWait` is tracked with timestamp
- **Retry logic:** 2 attempts with `session.abort()` between failures
- **Auto-recovery:** Dead or stuck sessions are recreated transparently

## Documentation Index

| Document | What It Covers |
|----------|---------------|
| `docs/npc-design-guide.md` | Character prompt templates, 12 game rules, sentiment system, tool architecture, Director agent, NPC interaction flows, step-by-step new level guide |
| `docs/game-architecture.md` | HTML/CSS/JS structure, Phaser scenes, map system, physics, day/night cycle, accusation system, full API reference, building different settings (hotel, boat, etc.) |
| This file (AGENTS.md) | Quick reference for starting a coding session |
