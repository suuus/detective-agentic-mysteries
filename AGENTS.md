# Detective Agentic Mysteries — Developer Instructions

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
│   │   ├── agnes.ts             # Mrs. Whitfield (housekeeper, observant)
│   │   └── cruise/              # Level 2: Cruise ship characters (12 NPCs)
│   ├── levels/                  # Level-specific config (cruise ship, etc.)
│   │   ├── index.ts             # Level registry
│   │   ├── cruise.ts            # Cruise ship level definition
│   │   └── cruise-director.ts   # Cruise Director system prompt
│   ├── creative-agent.ts        # Creative Agency — AI-designed visual assets (3 sub-agents)
│   ├── mystery-generator.ts     # Skeleton Key — procedural mystery generation
│   ├── director.ts              # AI Director agent (orchestrates nights)
│   ├── narrator.ts              # Narrator agent (atmospheric prose + hints)
│   ├── profiler.ts              # Profiler agent (detective behavior analysis)
│   ├── psychologist.ts          # Psychologist agent (NPC emotional dynamics)
│   ├── gameState.ts             # Game state, evidence, day/night, sentiments, accusation logic
│   └── tools.ts                 # Copilot SDK tools available to NPC agents
├── public/
│   ├── index.html               # Game page with all UI panels
│   ├── css/style.css            # Noir theme (CSS variables for easy re-theming)
│   └── js/
│       ├── main.js              # Phaser init, HUD wiring, accusation modal, end-day popup
│       ├── api.js               # GameAPI class (all backend calls)
│       ├── dialog.js            # DialogManager (chat UI, streaming, evidence presentation)
│       ├── inventory.js         # InventoryManager (evidence list, notebook, accusation checkboxes)
│       ├── reconstruction.js    # Crime replay — chapter-based with "Next" navigation
│       ├── npcEmotions.js       # Floating emotion icons, sprite tints, breathing speed
│       ├── npcMovement.js       # NPC autonomous room-pacing AI
│       ├── npcApproach.js       # NPCs approach player to initiate conversation
│       ├── npcTTS.js            # NPC text-to-speech (gender/personality matched)
│       ├── narratorTTS.js       # Narrator text-to-speech
│       ├── voiceInput.js        # Push-to-talk speech input (Web Speech API)
│       ├── timedEvents.js       # Dramatic countdown pressure events
│       ├── chase.js             # NPC chase sequences (flee + catch)
│       ├── ambientMusic.js      # Procedural noir music (Web Audio API)
│       ├── weather.js           # Weather particles (rain, fog, snow, storm)
│       ├── lighting.js          # Flashlight / fog-of-war (GeometryMask)
│       └── scenes/
│           ├── BootScene.js     # Procedural sprite generation (manor level)
│           ├── CruiseBootScene.js # Sprite generation (cruise level)
│           ├── RandomBootScene.js # Sprite generation (AI-generated levels)
│           ├── ManorScene.js    # Manor game world (rooms, NPCs, day/night cycle)
│           ├── CruiseManorScene.js # Cruise ship game world
│           ├── RandomManorScene.js # AI-generated game world
│           └── UIScene.js       # HUD overlay scene (minimal)
└── docs/
    ├── npc-design-guide.md      # NPC architecture: prompts, sentiment, tools, Director
    ├── game-architecture.md     # Full game mechanics, UI, map system, building new levels
    └── level2-cruise-ship.md    # Cruise ship level design document
```

## Architecture Overview

### 14+ AI Agents Running Simultaneously

| Agent | Session ID | Role | Model |
|-------|-----------|------|---------|
| Victoria | blackwood-victoria | NPC suspect | gpt-4.1 |
| Hartwell | blackwood-hartwell | NPC suspect (killer) | gpt-4.1 |
| Clara | blackwood-clara | NPC suspect | gpt-4.1 |
| Price | blackwood-price | NPC suspect | gpt-4.1 |
| Agnes | blackwood-agnes | NPC suspect | gpt-4.1 |
| Director | blackwood-director | Night orchestrator + crime replay | gpt-4.1 |
| Forensics | blackwood-forensics | Evidence analysis (streaming) | gpt-4.1 |
| Narrator | blackwood-narrator | Atmospheric prose generation | gpt-4.1 |
| Profiler | blackwood-profiler | Detective behavior analysis | gpt-4.1 |
| Psychologist | blackwood-psychologist | NPC emotional dynamics expert | gpt-4.1 |
| Red Herring | blackwood-{dynamic} | Dynamically spawned misleading NPC | gpt-4.1 |
| Skeleton Key | blackwood-architect | Procedural mystery generation | gpt-4.1 |
| Creative Agency | blackwood-creative-{env,props,chars} | 3 parallel agents for visual asset generation | gpt-4.1 |

Each NPC session has:
- `systemMessage: { mode: "replace" }` — full character prompt
- `tools` — 11 tools (check_evidence_shown, investigation_progress, reveal_clue, day_info, update_sentiment, get_my_sentiment, create_evidence, show_body_language, get_detective_profile, get_overheard_info, gossip_about_detective)
- `streaming: true` for real-time response display
- `infiniteSessions: { enabled: false }` — no workspace persistence

### Agent-Agent Communication

Agents communicate through **server-mediated patterns**, not direct connections:

1. **Tool-mediated state** — NPCs call tools that modify shared game state; other agents read it through their own tools
2. **Orchestrated conversations** — Server routes NPC A's response as context into NPC B's prompt (night phase, 4 exchanges per pair)
3. **Fire-and-forget broadcasting** — After interrogation: gossip spreading, player profiling, psychologist analysis, contradiction detection run async
4. **`onPostToolUse` hooks** — SDK lifecycle hooks fire after every NPC tool call, propagating side effects (emotional shifts, clue reveals, body language) to nearby NPCs automatically — during both interrogations and night conversations
5. **Psychologist → Director briefing** — Before night planning, the Psychologist produces a psychological briefing that the Director uses to plan emotionally-informed night conversations
6. **Detective profile injection** — Every interrogation and night conversation prompt includes the detective's profiled style, so NPCs adapt their behavior to the player's approach

### Key Flows

**Player interrogates NPC:** `POST /api/talk/:characterId` → emotional context + detective profile injected → SSE stream → dialog UI → psychologist analysis + gossip + profiling + contradiction detection (fire-and-forget)

**Night falls (every 5 real minutes, or via End Day button):**
1. Psychologist produces psychological briefing (who's volatile, strained relationships, predicted escalations)
2. Director receives briefing + analyzes game state via tools (with auto-retry on stale sessions)
3. Director calls `submit_night_plan` (conversation pairs, NPC positions, evidence changes)
4. If Director fails, fallback conversation pairs are generated from active characters
5. NPC-to-NPC conversations execute (4 exchanges per pair) — prompts include detective profile + reputation
6. Player sees conversations displayed with click-to-advance
7. Next morning: NPCs get conversation memories injected, positions/evidence updated

**Player accuses:** `POST /api/accuse` → validates suspect + motive + evidence → on success: accusation modal transforms into crime replay with chapter-by-chapter "Next" navigation, including AI-generated detective performance assessment

**Mystery generation (random levels):** `POST /api/mystery/generate` → SSE stream:
1. Skeleton Key architect generates mystery skeleton (setting, characters, evidence, rooms)
2. Architect generates full character system prompts
3. Architect generates Director system prompt
4. Creative Agency deploys 3 parallel agents (Environment + Props Department + Character Art)
5. Follow-up repair for any missing visual sections
6. World layout computed, NPC positions assigned

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

### When changing the emotional system:
- `src/psychologist.ts` — Psychologist agent (AI-powered emotion analysis)
- `src/tools.ts` — `update_sentiment` and `get_my_sentiment` tools
- `server.ts` — `analyzeEmotions()` (psychologist after interrogation), `analyzeEvidenceReaction()` (evidence shown), emotional + detective profile context injection in `/api/talk`, psychologist night briefing in `planNight()`
- `public/js/npcEmotions.js` — Floating icons, tints, breathing speed
- `public/js/dialog.js` — Mood indicator in dialog panel

### When changing mystery generation:
- `src/mystery-generator.ts` — Skeleton Key prompts
- `src/creative-agent.ts` — Creative Agency prompts (3 agents: environment, props, characters)
- `public/js/scenes/RandomBootScene.js` — Sprite generation from AI assets
- `public/js/scenes/RandomManorScene.js` — World building from generated data

### When changing the crime replay:
- `public/js/reconstruction.js` — Chapter-based replay with Next navigation
- `server.ts` — `/api/reconstruct` endpoint (Director prompt + detective assessment)
- `public/index.html` — `#accusation-replay` section inside accusation modal

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/talk/:characterId` | SSE streaming interrogation |
| GET | `/api/evidence` | All evidence with collected status |
| GET | `/api/evidence/positions` | Tile positions of uncollected evidence |
| POST | `/api/evidence/:id/collect` | Collect evidence item |
| POST | `/api/evidence/:id/show/:characterId` | Show evidence to NPC (triggers emotion) |
| GET | `/api/state` | Full game state |
| GET | `/api/sentiments` | All NPC sentiments |
| GET | `/api/sentiments/:characterId` | Single NPC sentiment |
| POST | `/api/sentiments/:characterId/adjust` | Admin sentiment adjustment |
| POST | `/api/accuse` | Submit accusation |
| POST | `/api/reconstruct` | AI crime reconstruction + detective assessment |
| GET | `/api/day` | Current day/time + config |
| POST | `/api/day/advance` | Trigger night/dawn transition |
| GET | `/api/profile` | Detective behavior profile |
| GET | `/api/reputation` | Detective reputation among NPCs |
| GET | `/api/contradictions` | Detected NPC contradictions |
| GET | `/api/notebook` | Notebook clues |
| POST | `/api/forensics/analyze` | SSE forensic evidence analysis |
| GET | `/api/health` | Session health + stuck detection |
| GET | `/api/hidden-room/check` | Auto-reveal check (Day 3+, 6+ evidence) |
| POST | `/api/hidden-room/reveal` | Manually reveal hidden room |
| GET | `/api/red-herring/check` | Probabilistic auto-activation check |
| POST | `/api/red-herring/activate` | Manually activate red herring NPC |
| POST | `/api/mystery/generate` | SSE procedural mystery generation |
| GET | `/api/mystery/generate/status` | Generation progress check |
| GET | `/api/mystery/world` | Fetch generated world data |
| GET | `/api/version` | Version + auto-generated changelog |
| POST | `/api/reset` | Reset game, disconnect all sessions |

## NPC Session Health System

- **Healthcheck interval:** 30 seconds
- **Stuck threshold:** 50 seconds (abort + recreate)
- **Active request tracking:** Every `sendAndWait` is tracked with timestamp
- **Retry logic:** 2 attempts with `session.abort()` between failures
- **Auto-recovery:** Dead or stuck sessions are recreated transparently
- **Director resilience:** `directorSendAndWait()` wrapper auto-detects stale sessions ("Session not found"), recreates, and retries
- **Night fallback:** If Director fails completely, fallback conversation pairs are generated from active characters so players always see night conversations
- **Creative Agency:** Uses `Promise.allSettled` so one failed agent doesn't discard the others; follow-up repair calls regenerate missing sections

## Documentation Index

| Document | What It Covers |
|----------|---------------|
| `docs/npc-design-guide.md` | Character prompt templates, 12 game rules, sentiment system, tool architecture, Director agent, NPC interaction flows, step-by-step new level guide |
| `docs/game-architecture.md` | HTML/CSS/JS structure, Phaser scenes, map system, physics, day/night cycle, accusation system, full API reference, building different settings (hotel, boat, etc.) |
| `docs/level2-cruise-ship.md` | Cruise ship level design document |
| This file (AGENTS.md) | Quick reference for starting a coding session |
