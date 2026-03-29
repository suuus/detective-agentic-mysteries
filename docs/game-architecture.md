---

# 🎮 DETECTIVE GAME: COMPLETE GAME MECHANICS, UI SYSTEMS & TECHNICAL ARCHITECTURE

## EXECUTIVE SUMMARY
**Game**: Detective Agentic Mysteries — a noir detective mystery
- **Engine**: Phaser 3 (2D top-down)
- **Backend**: Express + Copilot SDK (GPT-4 for NPC AI)
- **Architecture**: Client-side UI layers (HTML/CSS/JS) + Phaser scenes + Express API

---

## 1. HTML STRUCTURE & PANEL SYSTEM

### Complete Panel Layout (`public/index.html`)

```
PANELS:
├── #game-container (Phaser canvas, z-index: 1)
├── #dialog-overlay (bottom, 52% height, z-index: 100)
│   └── .dialog-inner
│       ├── .dialog-header (portrait, name, mood indicator)
│       ├── #dialog-history (scrollable conversation log)
│       ├── #typing-indicator (animated dots when NPC responding)
│       ├── .dialog-input-row (text input + Send + Show Evidence buttons)
│       └── #dialog-evidence-panel (evidence list for presentation)
├── #inventory-panel (right side, fixed, z-index: 90)
│   └── ul#inventory-list (collected evidence)
├── #notebook-panel (left side, fixed, z-index: 90)
│   └── ul#notebook-list (clues/discovered information)
├── #accusation-modal (centered, z-index: 200)
│   ├── suspect-select dropdown
│   ├── motive-input textarea
│   ├── #evidence-checkboxes (fieldset of collected evidence)
│   └── result display (hidden, shown after submission)
├── #hud-bar (bottom, height: 56px, z-index: 80)
│   ├── #hud-clock (day display + progress bar)
│   ├── #hud-inventory button
│   ├── #hud-notebook button
│   └── #hud-accuse button (gold accent)
└── #end-screen (centered, z-index: 200)
    └── modal with win/lose message
```

**Key IDs**:
- `dialog-overlay`: Main conversation UI
- `dialog-portrait`: Character avatar (32x32 px image background)
- `dialog-character-name`: NPC name display
- `dialog-mood`: Sentiment indicator (icon + trust bar)
- `dialog-evidence-panel`: Toggleable evidence list for conversations
- `inventory-panel` / `notebook-panel`: Side sliding panels
- `hud-bar`: Always-visible bottom bar with clock and buttons

---

## 2. CSS THEMING & COMPONENT SYSTEM

### Color Palette
```css
--black:    #0a0a0a    (main bg)
--burgundy: #2d1117    (accent/panel)
--gold:     #c9a84c    (highlights/important)
--cream:    #e8dcc8    (text)
--dark-bg:  rgba(13, 13, 13, 0.92)
--panel-bg: rgba(30, 16, 18, 0.95)
--input-bg: #1a0f11
```

### Typography
```css
--font-heading: 'Playfair Display' (serif, titles)
--font-body:    'Lora' (serif, body)
--transition:   0.35s cubic-bezier(0.4, 0.2, 0.2, 1)
```

### Component Patterns

**Buttons**: `.gold-btn` + `.outline` modifier
```css
.gold-btn { background: var(--gold); color: var(--black); }
.gold-btn.outline { background: transparent; color: var(--gold); border: 1px solid var(--gold); }
```

**Panels**: Slide-in/out with transforms
```css
.side-panel.right { transform: translateX(100%); } /* off-screen */
.side-panel:not(.hidden).right { transform: translateX(0); } /* slide in */
```

**Dialog Overlay**: Slides up from bottom
```css
#dialog-overlay { transform: translateY(100%); }
#dialog-overlay:not(.hidden) { transform: translateY(0); }
```

**Messages**: Bubble style with flex alignment
```css
.msg.player { align-self: flex-end; background: rgba(201, 168, 76, 0.15); }
.msg.npc { align-self: flex-start; background: rgba(45, 17, 23, 0.8); }
```

**Animations**:
- `fadeSlideIn`: Messages slide up + fade in (0.25s)
- `bounce`: Typing indicator dots (1.4s infinite)
- `fadeIn`: Modal backdrop (0.3s)

### Responsive Behavior
```css
@media (max-width: 700px) {
  .side-panel { width: 260px; }  /* shrink from 300px */
  #dialog-overlay { height: 60%; }
  .msg { max-width: 90%; }
  .modal { padding: 20px; }
}
```

---

## 3. GAME INITIALIZATION & HUD WIRING (`main.js`)

### Phaser Config
```javascript
{
  type: Phaser.AUTO,
  width: 1024,
  height: 768,
  pixelArt: true,
  backgroundColor: '#0a0a0a',
  physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
  input: { keyboard: { capture: [] } }  // no global capture
  scene: [BootScene, ManorScene, UIScene]
}
```

### Manager Initialization
```javascript
const api = new GameAPI();
const inventory = new InventoryManager(api);
const dialog = new DialogManager(api);

// Expose globally for Phaser scenes
window.gameAPI = api;
window.dialogManager = dialog;
window.inventoryManager = inventory;
```

### HUD Button Wiring
- `#hud-inventory` → `inventory.toggle()`
- `#hud-notebook` → `inventory.toggleNotebook()`
- `#hud-accuse` → `openAccusationModal()`

### Accusation Modal Logic
**Data Structures**:
```javascript
const suspects = [
  { id: 'victoria', name: 'Lady Victoria Blackwood' },
  { id: 'hartwell', name: 'Dr. James Hartwell' },
  { id: 'clara', name: 'Clara Blackwood' },
  { id: 'price', name: 'Mr. Reginald Price' },
  { id: 'agnes', name: 'Mrs. Agnes Whitfield' },
];
```

**Accusation Flow**:
1. `openAccusationModal()` → populates dropdowns + checkboxes
2. `submitBtn` event → validates suspect + motive + evidence
3. Call `api.accuse(suspectId, motive, evidenceIds)`
4. If correct → show "Case Solved" screen after 2s delay
5. If wrong → decrement `attemptsRemaining`, show hint; when 0 → "Case Closed" (lost)

**Validation Logic** (server-side in gameState.ts):
- Suspect must be "hartwell" (CORRECT_SUSPECT)
- Motive must contain keyword: prescription, blackmail, forging, forge, forged
- Evidence must include ≥2 from: brandy_glass, prescription_pad, edmunds_letter, foxglove_cuttings

---

## 4. DIALOG SYSTEM (`dialog.js`)

### DialogManager Class

**State**:
- `currentCharacter`: NPC id or null
- `history`: `{ [characterId]: [{role: 'player'|'npc', text: string}][] }`
- `responding`: boolean (disables input while streaming)

**Public API**:

| Method | Purpose |
|--------|---------|
| `open(charId, charName)` | Show dialog overlay, load history, display mood |
| `close()` | Hide overlay, clear current character |
| `isOpen()` | Check if dialog is active |
| `sendMessage(text)` | Stream NPC response via API |
| `showEvidencePanel()` | Toggle evidence list |
| `presentEvidence(evidenceId)` | Show evidence to NPC, get reaction |

### Message Streaming
```javascript
// Uses async generator from API
for await (const chunk of this.api.talkTo(charId, text)) {
  fullResponse += chunk;
  npcBubble.textContent = fullResponse;  // stream updates
  this._scrollToBottom();
}
```

### Sentiment Indicator Display
```javascript
_updateSentimentIndicator() {
  // Fetch sentiment from /api/sentiments/:characterId
  // Display:
  // - Icon (emotionalState emoji)
  // - Label (calm, nervous, angry, etc.)
  // - Trust bar (towardDetective -10 to +10 → 0-100% width)
  //   - Color: green (>60%), gold (40-60%), red (<40%)
}
```

---

## 5. INVENTORY & NOTEBOOK SYSTEM (`inventory.js`)

### InventoryManager Class

**State**:
- `evidence`: Evidence[] (all items from server)
- `clues`: Clue[] (discovered notes)

**Methods**:

| Method | Purpose |
|--------|---------|
| `refresh()` | Fetch from `/api/evidence`, render both panels |
| `toggle()` | Show/hide inventory side panel |
| `toggleNotebook()` | Show/hide notebook side panel |
| `getCollected()` | Filter to `e.collected === true` |
| `renderInventory()` | Build UL with collected evidence |
| `renderNotebook()` | Build UL with clues |
| `renderEvidenceForDialog()` | Populate dialog's evidence sub-panel |
| `populateAccusationEvidence(container)` | Create checkboxes for modal |

### Evidence Item Rendering
```javascript
// Each evidence item shows:
<span class="item-icon">${item.icon || '🔎'}</span>
<span class="item-name">${item.name}</span>
<div class="item-desc">${item.description}</div>
```

---

## 6. API ENDPOINTS & SIGNATURES (`api.js`)

### GameAPI Class

**Conversation**:
```javascript
async *talkTo(characterId, message)
// POST /api/talk/:characterId
// Body: { message: string }
// Returns: async generator of text chunks
// Format: SSE "data: {content}" OR "data: [DONE]"
```

**Evidence**:
```javascript
async getEvidence()
// GET /api/evidence
// Returns: { evidence: Evidence[], clues: Clue[] }

async collectEvidence(id)
// POST /api/evidence/:id/collect
// Returns: { collected: bool, evidence: Evidence }

async showEvidence(evidenceId, characterId)
// POST /api/evidence/:evidenceId/show/:characterId
// Returns: { shown: bool }

async getEvidencePositions()
// GET /api/evidence/positions
// Returns: [{id, x, y}, ...]
```

**Game State**:
```javascript
async getState()
// GET /api/state
// Returns: GameState

async getDay()
// GET /api/day
// Returns: {currentDay, timeOfDay, dayConfig}

async advanceDay()
// POST /api/day/advance
// Returns: {timeOfDay, conversations, currentDay, dayConfig, removedEvidence}
```

**Accusation**:
```javascript
async accuse(suspectId, motive, evidenceIds)
// POST /api/accuse
// Body: { suspectId, motive, evidenceIds[] }
// Returns: { correct: bool, message: string }
```

**Sentiment**:
```javascript
async getSentiment(characterId)
// GET /api/sentiments/:characterId
// Returns: NPCSentiment
```

**Other**:
```javascript
async reset()
// POST /api/reset
// Clears all game state
```

---

## 7. SPRITE GENERATION SYSTEM (`BootScene.js`)

### The `_tex(key, w, h, fn)` Method
**Pattern**: Procedural texture generation
```javascript
_tex(key, w, h, fn) {
  const g = this.make.graphics({ add: false });
  fn(g, w, h);  // callback draws on graphics
  g.generateTexture(key, w, h);
  g.destroy();
}
```

### All Sprite Definitions

**Player** (4 directions × 3 frames each = 12 textures):
- Frames per direction: `_0` (idle), `_1` (left leg), `_2` (right leg)
- Textures: `player_down_0`, `player_down_1`, etc.
- Animations: `walk-down`, `walk-left`, `walk-right`, `walk-up` (4 frames, 8 fps)
- Idle animations: `idle-[dir]` (single frame)
- Body color: 0x5c4a32 (brown)
- Head: 0xe8c99b (skin)
- Hat: 0x3a2f24 (dark)

**NPCs** (5 characters, 1 texture each):
```javascript
npc_victoria:  body: 0x8B2252 (wine), hair: 0xDAA520 (gold), accent: 0x6b1a3f
npc_hartwell:  body: 0x2F4F4F (teal), hair: 0x696969 (gray), accent: 0xffffff
npc_clara:     body: 0x4a3280 (purple), hair: 0x8B4513 (brown), accent: 0xdda0dd
npc_price:     body: 0x1a1a2e (black), hair: 0x333333 (dark), accent: 0xc9a84c (gold)
npc_agnes:     body: 0x2d2d2d (gray), hair: 0xaaaaaa (light), accent: 0xf5f5f5
```

**Evidence Items** (16×16 each):
```
brandy_glass, prescription_pad, foxglove_cuttings, edmunds_letter, love_letter,
business_documents, agnes_diary, claras_manuscript, burnt_note, muddy_footprints,
digitalis_vial, victoria_telegram
```
Each drawn with specific colored rectangles; glow effect (ev_glow) is pulsing 24×24 circle.

**Tiles** (32×32 each):
- `tile_floor`: Wood grid pattern
- `tile_wall`: Burgundy with brick pattern
- `tile_carpet`: Maroon with gold borders
- `tile_grass`: Green with random grass tufts
- `tile_kitchen_floor`: Checkerboard

**Furniture** (various sizes):
- Desk (64×32), bookshelf (64×32), table (48×32), fireplace (64×48), plant (24×32), bed (48×64), stove (48×32)

**UI Prompts** (semi-transparent black with gold border):
- `prompt_talk` (64×24)
- `prompt_examine` (80×24)

---

## 8. ROOM & MAP SYSTEM (`ManorScene.js`) — CRITICAL

### Room Definitions
```javascript
this.rooms = {
  main_hall:    {x:12, y:12, w:12, h:8,  floor:'tile_carpet'},
  study:        {x:1,  y:12, w:10, h:8,  floor:'tile_carpet'},
  library:      {x:25, y:12, w:10, h:8,  floor:'tile_carpet'},
  kitchen:      {x:1,  y:1,  w:10, h:10, floor:'tile_kitchen_floor'},
  dining_room:  {x:25, y:1,  w:10, h:10, floor:'tile_floor'},
  conservatory: {x:1,  y:21, w:10, h:10, floor:'tile_floor'},
  bedroom:      {x:25, y:21, w:10, h:10, floor:'tile_carpet'},
  garden:       {x:12, y:21, w:12, h:10, floor:'tile_grass'},
  foyer:        {x:12, y:1,  w:12, h:10, floor:'tile_floor'},
};

// Total map: 36×32 tiles (1152×1024 px at 32px tile size)
```

### Doorway Definitions (tile coordinates)
```javascript
this.doors = [
  { x:17, y:10, w:2, h:4 },  // foyer ↔ main_hall (vertical)
  { x:10, y:15, w:4, h:2 },  // study ↔ main_hall
  { x:23, y:15, w:4, h:2 },  // main_hall ↔ library
  { x:10, y:5,  w:4, h:2 },  // kitchen ↔ foyer
  { x:23, y:5,  w:4, h:2 },  // foyer ↔ dining_room
  { x:17, y:19, w:2, h:4 },  // main_hall ↔ garden (vertical)
  { x:10, y:25, w:4, h:2 },  // conservatory ↔ garden
  { x:23, y:25, w:4, h:2 },  // garden ↔ bedroom
];
```

### NPC Placements (Day 1)
```javascript
victoria:  {x:6,  y:25} conservatory
hartwell:  {x:30, y:16} library
clara:     {x:30, y:26} bedroom
price:     {x:30, y:4}  dining_room
agnes:     {x:6,  y:5}  kitchen
```

### Evidence Positions (Day 1)
```javascript
brandy_glass:       {x:5,  y:15}  (study)
prescription_pad:   {x:29, y:15}  (library)
foxglove_cuttings:  {x:16, y:26}  (garden)
edmunds_letter:     {x:4,  y:15}  (study)
love_letter:        {x:6,  y:24}  (conservatory)
business_documents: {x:3,  y:14}  (study)
agnes_diary:        {x:5,  y:7}   (kitchen)
claras_manuscript:  {x:31, y:27}  (bedroom)
```

### Build Process

1. **`_buildFloors(T)`**: Creates floor tiles for each room + doorways
2. **`_buildWalls(T)`**: 
   - Creates passability grid (true = blocked, false = passable)
   - Marks room interiors + doorways as passable
   - Renders walls adjacent to passable areas
   - Creates physics bodies for collision
3. **`_placeFurniture(T)`**: 23 furniture pieces with collision bodies
4. **`_placeNPCs(T)`**: 5 NPCs with:
   - Physics sprite (immovable)
   - Label text above (gold, with outline)
   - Idle animation (scale pulse 2000ms)
5. **`_placeEvidence(T)`**: Evidence with glow + pulse animation
6. **`_setupPlayer(T)`**: Player sprite at center (18×16 tiles)
   - Body size: 14×14 (inset 9px from center)
   - Collides with walls, furniture, NPCs
7. **`_setupCamera(T)`**: Follow player with easing (0.08, 0.08), zoom 2x, bounded to map
8. **`_setupInput()`**: Cursor + WASD keys + E interact
9. **`_createAmbientParticles()`**: Dust particles with slow movement

### Player Movement
```javascript
_handleMovement() {
  const speed = 120;
  // Cursor keys OR WASD
  // Diagonal: velocity *= 0.707 (normalize)
  // Play walk-[direction] animation; idle when static
}
```

### Interaction System (`_handleInteractions`)
**Range**: 48 pixels
**Priority**: Closest NPC/evidence wins
**Display**: Prompt sprite above target (talk vs examine)
**Trigger**: E key

**NPC Interaction**:
```javascript
window.dialogManager?.open(npc.id, npc.name);
```

**Evidence Interaction**:
```javascript
this._collectEvidence(evidenceId);
// → POST /api/evidence/:id/collect
// → Animate evidence out (fade + scale down)
// → Show popup with name + detail
// → Refresh inventory
```

### Day/Night Cycle

**State Variables**:
```javascript
this.currentDay = 1;
this.dayTimer = 0;
this.DAY_DURATION = 10 * 60 * 1000;  // 10 minutes
this.isNight = false;
this.transitioning = false;
this.GAME_START_HOUR = 20;  // 8:00 PM
this.GAME_END_HOUR = 30;    // 6:00 AM next day
```

**Clock Display** (`_updateClock(progress)`):
- `progress` ∈ [0, 1] during day
- Hour: `GAME_START_HOUR + (GAME_END_HOUR - GAME_START_HOUR) * progress`
- Updates HUD: clock icon, day label, time string, progress bar fill

**Dusk Effect**:
- Last 20% of day: `nightOverlay.setAlpha(duskProgress * 0.3)`
- Gradual darkening

**Night Trigger** (`_triggerNight`):
1. Close any open dialog
2. Fade overlay to dark (2s)
3. Show "Night Falls" loading screen
4. Call `api.advanceDay()` → triggers AI-to-AI conversations
5. Display each conversation on-screen with character names + location
6. Call `api.advanceDay()` again → returns day config
7. Show dawn summary with narrative text
8. Apply day changes: reposition NPCs, update evidence, refresh inventory

**Day Changes** (`_applyDayChanges(dayConfig)`):
- Move NPCs to new positions
- Update evidence sprites based on new positions
- Remove no-longer-available evidence
- Add new evidence

### Overlay Detection Pattern
```javascript
_isOverlayOpen() {
  return window.dialogManager?.isOpen()
      || !document.getElementById('inventory-panel')?.classList.contains('hidden')
      || !document.getElementById('notebook-panel')?.classList.contains('hidden')
      || !document.getElementById('accusation-modal')?.classList.contains('hidden')
      || !document.getElementById('end-screen')?.classList.contains('hidden');
}
```

When overlay open:
- Disable Phaser keyboard input
- Stop player movement
- Hide interact prompt

---

## 9. UIScene — Minimal Overlay

```javascript
// Single hint text (fades out after 6s)
create() {
  this.hintText = this.add.text(
    width/2, 30,
    'Use WASD to move · E to interact',
    {...}
  ).setAlpha(1);
  
  this.tweens.add({
    targets: this.hintText,
    alpha: 0,
    delay: 4000,
    duration: 2000
  });
}
```

**Purpose**: Minimal canvas UI; most UI is HTML overlays

---

## 10. EXPRESS BACKEND & API ENDPOINTS (`server.ts`)

### Core Configuration
```typescript
const app = express();
app.use(cors(), express.json());
app.use(express.static("public"));

const gameState = new GameStateManager();
const client = new CopilotClient();

const sessions = new Map<string, CopilotSession>();
let directorSession: CopilotSession | null = null;
```

### Character Session Management

**Session Creation**:
```typescript
async function getOrCreateSession(characterId: string): Promise<CopilotSession> {
  // Check cache
  if (sessions.has(characterId)) return sessions.get(characterId)!;
  
  // Create new with character's systemPrompt
  const character = characters.find(c => c.id === characterId);
  const session = await client.createSession({
    sessionId: `blackwood-${characterId}`,
    model: "gpt-4.1",
    streaming: true,
    tools: gameTools,
    systemMessage: { mode: "replace", content: character.systemPrompt }
  });
  
  sessions.set(characterId, session);
  return session;
}
```

**Recovery Pattern** (stuck detection):
```typescript
// Every 30s, check for stuck requests (>50s old)
// If stuck: abort session + recreate
// If idle session fails: recreate

async function talkWithRetry(characterId, message, onDelta) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    let session = attempt === 1 
      ? await getOrCreateSession(characterId)
      : await recreateSession(characterId);
    
    try {
      await session.sendAndWait({ prompt: message }, 45_000);
      return;
    } catch (err) {
      if (attempt === 2) throw err;
    }
  }
}
```

### Director Agent

**System Prompt**: `DIRECTOR_SYSTEM_PROMPT` (orchestrates night plans)

**Night Planning Flow** (`planNight`):
```typescript
async function planNight(): Promise<void> {
  const director = await getDirectorSession();
  
  const prompt = `Night has fallen at Blackwood Manor after Day ${gameState.getCurrentDay()}.
  
  Analyze the current game state by calling get_full_game_state, then review key interrogation details with get_conversation_history...
  
  Based on what happened today, submit your night plan using submit_night_plan. Consider:
  - What the detective discovered and how characters would react
  - Who would naturally seek each other out tonight
  - How the killer (Hartwell) would behave given investigation pressure
  - What dramatic developments would make tomorrow interesting
  - Where characters would position themselves for the next day
  
  Make 2-3 conversation pairs. Place all 5 NPCs for tomorrow. Add new evidence only if dramatically justified.`;
  
  await director.sendAndWait({ prompt }, 120_000);
}
```

### Conversation Streaming

**Endpoint**: `POST /api/talk/:characterId`
```typescript
// SSE format
res.setHeader("Content-Type", "text/event-stream");
res.setHeader("Cache-Control", "no-cache");
res.setHeader("Connection", "keep-alive");

// Stream each delta
session.on("assistant.message_delta", event => {
  res.write(`data: ${JSON.stringify({ content: event.data.deltaContent })}\n\n`);
});

// Signal end
res.write("data: [DONE]\n\n");
```

### Evidence Endpoints

```typescript
GET /api/evidence
// Returns all evidence with collected flags

POST /api/evidence/:id/collect
// Mark as collected, return evidence details

POST /api/evidence/:id/show/:characterId
// Register that character saw evidence (for tools/sentiment)

GET /api/evidence/positions
// Return current {id, x, y} for uncollected evidence
```

### Day/Night Cycle Endpoints

```typescript
GET /api/day
// Returns: {currentDay, timeOfDay, dayConfig}

POST /api/day/advance
// If day → night:
//   - Call planNight() (Director)
//   - Call conductNightConversations() (AI-to-AI)
//   - Return conversations list
// If night → day:
//   - Feed each NPC their night conversations (for memory)
//   - Advance day counter
//   - Return dayConfig + removedEvidence
```

### Night Conversation Orchestration

```typescript
async function conductNightConversations(): Promise<NightConversation[]> {
  const pairs = gameState.getNightConversationPairs();
  
  for (const pair of pairs) {
    const [idA, idB] = pair.ids;
    
    // Round 1: A initiates
    const promptA1 = `[NIGHT SCENE — stay in character, this is NOT the detective talking]
    It is late at night at Blackwood Manor. You've encountered ${nameB} in ${pair.location}. ${pair.scenario}
    Here's what happened during the day's investigation: ${investigationSummary}
    Speak to ${nameB} in character. What do you say? Keep it to 2-3 sentences...`;
    
    const responseA1 = await sendAndCollect(idA, promptA1);
    exchanges.push({speaker: idA, speakerName: nameA, text: responseA1});
    
    // Round 1: B responds
    const promptB1 = `...${nameA} just said to you: "${responseA1}"...`;
    const responseB1 = await sendAndCollect(idB, promptB1);
    
    // Round 2: A reacts
    // Round 2: B final word
    
    conversations.push({
      participants: [idA, idB],
      participantNames: [nameA, nameB],
      location: pair.location,
      exchanges
    });
  }
  
  gameState.storeNightConversations(conversations);
  return conversations;
}
```

### Accusation Endpoint

```typescript
POST /api/accuse
// Body: {suspectId, motive, evidenceIds[]}
// Validation:
// - suspectId === "hartwell"
// - motive contains keyword (prescription, blackmail, forging, etc.)
// - ≥2 of evidenceIds in [brandy_glass, prescription_pad, edmunds_letter, foxglove_cuttings]
// Returns: {correct: bool, message: string}
```

### Reset Endpoint

```typescript
POST /api/reset
// Disconnect all sessions
// Clear game state
// Clear director session
```

### Health Check Endpoint

```typescript
GET /api/health
// Check Copilot client + each session
// Detect stuck requests, recover if needed
// Returns: {healthy: bool, sessions: {[charId]: {status, error?, elapsed?}}}
```

---

## 11. GAME STATE MANAGEMENT (`gameState.ts`)

### Interfaces

```typescript
interface NPCSentiment {
  towardDetective: number;        // -10 to +10
  towardOthers: Record<string, number>;
  emotionalState: string;
  recentEmotions: string[];
}

interface GameState {
  evidenceCollected: string[];
  evidenceShownTo: Record<string, string[]>;
  charactersInterrogated: string[];
  accusationsMade: number;          // 0-3
  gameWon: boolean;
  gameLost: boolean;
  currentDay: number;
  timeOfDay: 'day' | 'night';
  npcSentiments: Record<string, NPCSentiment>;
}

interface DayConfig {
  npcPositions: NPCSchedule[];
  newEvidence: Evidence[];
  movedEvidence: {id, newLocation, x, y}[];
  removedEvidence: string[];
  overnightNarrative: string;
  npcNightContext: Record<string, string>;
}
```

### Evidence Definition

```typescript
const EVIDENCE: Evidence[] = [
  {
    id: "brandy_glass",
    name: "Brandy Glass",
    description: "A crystal brandy glass found in the study",
    location: "study",
    detail: "A crystal brandy glass. It's been wiped, but you notice a faint residue and an unusual bitter smell."
  },
  // ... 7 more
];
```

### Accusation Validation

```typescript
const CORRECT_SUSPECT = "hartwell";
const KEY_EVIDENCE = ["brandy_glass", "prescription_pad", "edmunds_letter", "foxglove_cuttings"];
const MOTIVE_KEYWORDS = ["prescription", "blackmail", "forging", "forge", "forged"];

makeAccusation(suspectId, motive, evidenceIds) {
  const correctSuspect = suspectId.toLowerCase() === CORRECT_SUSPECT;
  const correctMotive = MOTIVE_KEYWORDS.some(kw => motive.toLowerCase().includes(kw));
  const matchingEvidence = evidenceIds.filter(id => KEY_EVIDENCE.includes(id)).length >= 2;
  
  if (correctSuspect && correctMotive && matchingEvidence) {
    gameWon = true;
    return {correct: true, message: "...Case closed!"};
  }
  
  accusationsMade++;
  if (3 - accusationsMade <= 0) {
    gameLost = true;
    return {correct: false, message: "...The killer walks free..."};
  }
  
  return {correct: false, message: `Incorrect...${hints.join(' ')}`};
}
```

### Day Configuration

**3 Hardcoded Days**:
- **Day 1**: Initial positions (game start)
- **Day 2**: New evidence + moved evidence + NPC repositioning
  - New: burnt_note, muddy_footprints
  - Moved: foxglove_cuttings from garden to study
  - Narrative: "The night was restless. Arguing voices..."
- **Day 3**: Additional evidence
  - New: digitalis_vial, victoria_telegram
  - Removed: prescription_pad (Hartwell hid it)
  - Narrative: "A scream pierced the night..."

### Evidence Positions

```typescript
export const EVIDENCE_POSITIONS: Record<string, {x, y}> = {
  brandy_glass: {x: 5, y: 15},
  prescription_pad: {x: 29, y: 15},
  // ... 10 more
};
```

### NPC Night Context

Each day config includes prompts fed to NPCs at day-start:
```javascript
npcNightContext: {
  victoria: "Last night you met Price in the garden again. You argued about whether to tell the detective...",
  hartwell: "Last night you panicked. You went to the garden fire pit and burned some notes...",
  // ... 3 more
}
```

### Active Evidence Computation

```typescript
getActiveEvidence(): Evidence[] {
  const all = [...EVIDENCE];
  
  // Add new evidence from days 0 to currentDay
  for (let d = 0; d < currentDay && d < DAY_CONFIGS.length; d++) {
    for (const ev of DAY_CONFIGS[d].newEvidence) {
      if (!all.find(e => e.id === ev.id)) all.push(ev);
    }
  }
  
  // Filter out removed
  return all.filter(e => !removedEvidence.includes(e.id));
}
```

### Director Plan Integration

```typescript
getDayConfig(): DayConfig {
  const idx = Math.min(currentDay, DAY_CONFIGS.length) - 1;
  const base = DAY_CONFIGS[idx];
  
  // Prefer Director's plan
  if (directorPlan && directorPlan.npcPositions.length > 0) {
    return {
      ...base,
      npcPositions: directorPlan.npcPositions,
      overnightNarrative: directorPlan.overnightNarrative || base.overnightNarrative
    };
  }
  
  return base;
}
```

---

## 12. DEPENDENCIES (`package.json`)

```json
{
  "name": "shadows-of-blackwood-manor",
  "type": "module",
  "scripts": {
    "dev": "tsx watch server.ts",
    "start": "tsx server.ts"
  },
  "dependencies": {
    "@github/copilot-sdk": "^0.1.32",
    "cors": "^2.8.5",
    "express": "^4.21.0",
    "tsx": "^4.21.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.0",
    "typescript": "^5.9.3"
  }
}
```

**Client** (loaded via CDN):
- Phaser 3.80.1 (game engine)
- Playfair Display + Lora fonts (Google Fonts)

---

## 13. ARCHITECTURAL PATTERNS & REUSABILITY

### Configurable Patterns for Other Games

**1. Room/Map System** (Tile-based, Phaser)
- **Pattern**: Grid-based rooms with doors, passability grid, collision system
- **Reusable for**: Any top-down tile game (mansion, dungeon, school, etc.)
- **Configuration**:
  ```javascript
  this.rooms = { [roomId]: {x, y, w, h, floor: textureKey} }
  this.doors = [{x, y, w, h}]
  ```
- **Scalability**: Adjust `MAP_W`, `MAP_H`, room definitions

**2. Day/Night Cycle**
- **Pattern**: Timer-based progression with visual effects + AI-to-AI conversations
- **Reusable for**: Mystery, RPG, Simulation games
- **Configuration**:
  ```javascript
  DAY_DURATION = time in ms
  GAME_START_HOUR / GAME_END_HOUR = time range
  ```

**3. Evidence/Inventory System**
- **Pattern**: Collectible items, filterable lists, modal presentation
- **Reusable for**: Quest logs, inventory systems, galleries
- **Configuration**:
  ```typescript
  const items = [{id, name, description, location, detail, icon?}]
  const positions = {[id]: {x, y}}
  ```

**4. Sentiment Tracking**
- **Pattern**: Numeric relationships (-10 to +10), emotional states, emotion history
- **Reusable for**: Social simulations, RPGs with reputation
- **Configuration**:
  ```typescript
  npcSentiments: {[charId]: {towardDetective, towardOthers, emotionalState, recentEmotions}}
  ```

**5. Dialog System (Dialog Manager + API Streaming)**
- **Pattern**: Persistent per-character conversation history, SSE streaming, evidence presentation
- **Reusable for**: Dialogue games, visual novels, chatbots
- **Configuration**:
  ```javascript
  history[charId] = [{role: 'player'|'npc', text}]
  ```

**6. Modal Accusation/Choice System**
- **Pattern**: Multi-field form with validation, attempts tracking, result feedback
- **Reusable for**: Quiz games, decision points, puzzles
- **Configuration**:
  ```javascript
  const suspects = [{id, name}]
  const validation = (suspectId, motive, evidence) => bool
  const attempts = 3
  ```

**7. API Architecture (Node.js + Copilot SDK)**
- **Pattern**: Session-based AI agents with tools, stuck detection, recovery
- **Reusable for**: Multi-agent systems, chatbot platforms
- **Configuration**:
  - Session creation with custom system prompts
  - Tool definitions for agent capabilities
  - Health checks + auto-recovery

**8. Procedural Sprite Generation**
- **Pattern**: Graphics context → texture caching
- **Reusable for**: Procedural art, dynamic UI, sprite atlases
- **Configuration**:
  ```javascript
  _tex(key, w, h, drawFn) // stores as texture once
  ```

**9. CSS Theming System**
- **Pattern**: CSS variables + modal/panel/button component classes
- **Reusable for**: Rapid UI reskinning
- **Variables**: colors, fonts, transitions, shadows

**10. Phaser Scene Pattern**
- **Pattern**: BootScene (async setup) → ManorScene (main) → UIScene (overlay)
- **Reusable for**: Scene-based games

---

## 14. KEY HARDCODED VALUES FOR CUSTOMIZATION

| Item | Location | Value | Adjustable |
|------|----------|-------|-----------|
| Game duration | ManorScene | 10 min (600s) | DAY_DURATION |
| Player speed | ManorScene | 120 px/s | speed var |
| Interaction range | ManorScene | 48 px | range var |
| Max accusations | main.js | 3 | attemptsRemaining |
| Phaser resolution | main.js | 1024×768 | config.width/height |
| Tile size | ManorScene | 32 px | T = 32 |
| Camera zoom | ManorScene | 2x | setBounds()/setZoom() |
| Map size | ManorScene | 36×32 tiles | MAP_W, MAP_H |
| Correct suspect | gameState.ts | "hartwell" | CORRECT_SUSPECT |
| Key evidence count | gameState.ts | ≥2 items | KEY_EVIDENCE.length |

---

## 15. DYNAMIC SYSTEMS: HIDDEN ROOMS, RED HERRINGS & SDK HOOKS

### Hidden Room System

Hidden rooms expand the map at runtime with new evidence. They appear late-game (Day 3+, 6+ evidence collected).

**Server API:**
- `GET /api/hidden-room/check` — polled every 30s; auto-reveals when conditions met
- `POST /api/hidden-room/reveal` — manual reveal with custom room data
- `GET /api/hidden-room` — get revealed room data

**Doorway geometry:** Doorways are 4 tiles wide to clear both the existing room's wall and the hidden room's wall. The frontend destroys both wall physics bodies AND visible `tile_wall` images in the doorway area.

**Per-level defaults:** Manor → Secret Study (off Library), Cruise → Smuggler's Hold (off Pool Deck), Random → Hidden Chamber (off rightmost room).

### Red Herring NPC System

A dynamically spawned NPC designed to mislead the investigation. Appears unpredictably.

**Activation probability (checked every 30s):**
- Day 1: ~15% per check + evidence bonus
- Day 2: ~35% per check + evidence bonus
- Day 3+: ~60% per check + evidence bonus

**Random level archetype pool (one chosen per game):**
1. Madame Zelenska — theatrical psychic con artist
2. Rex Calloway — washed-up tabloid journalist
3. Sergeant Kowalski — bitter retired homicide detective
4. Pippa Chen — true crime podcast host
5. Old Man Thatch — paranoid nearly-blind neighbor

Red herring NPCs use the same tools and hooks as real NPCs.

### `onPostToolUse` SDK Hooks

NPC sessions use Copilot SDK `SessionHooks` to fire reactive side effects after every tool call:

```typescript
hooks: {
  onPostToolUse: async (input, { sessionId }) => {
    // Fires after ANY NPC tool call — interrogation or night conversation
    switch (input.toolName) {
      case "update_sentiment":  // emotional shifts noticed by nearby NPCs
      case "reveal_clue":       // clues overheard by nearby NPCs
      case "show_body_language": // actions observed by nearby NPCs
    }
  }
}
```

This replaces manual eavesdropping wiring and ensures side effects fire consistently during both player interrogations and NPC night conversations.

---

## SUMMARY TABLE

| System | File(s) | Purpose | Patterns |
|--------|---------|---------|----------|
| HTML Structure | index.html | Panel layout, IDs | Semantic divs, z-index hierarchy |
| Styling | style.css | Theme, animations, responsive | CSS vars, flex/grid, transitions |
| HUD/Game Init | main.js | Phaser setup, button wiring, End Day popup | Global manager exposure, event handlers |
| Dialog | dialog.js | NPC conversations | Streaming, per-character history, sentiment |
| Inventory | inventory.js | Evidence/notebook UI | Filtering, dynamic rendering |
| API Client | api.js | HTTP/SSE communication | Async generators, error handling |
| Sprites (Manor) | BootScene.js | Procedural generation | Graphics → texture caching |
| Sprites (Cruise) | CruiseBootScene.js | Cruise ship sprites | Same pattern, ship-themed |
| Sprites (Random) | RandomBootScene.js | AI-generated sprites | DrawOp DSL → Phaser textures |
| World (Manor) | ManorScene.js | Map, physics, interactions | Tile grid, room system, day/night |
| World (Cruise) | CruiseManorScene.js | Cruise ship world | Multi-floor, stair system |
| World (Random) | RandomManorScene.js | AI-generated world | Dynamic rooms from generated data |
| Crime Replay | reconstruction.js | Chapter-based post-win replay | Typewriter + Next navigation in modal |
| NPC Emotions | npcEmotions.js | Floating emojis, tints, breathing | Polls sentiments, per-NPC visuals |
| NPC Movement | npcMovement.js | Autonomous room pacing | State machine: idle/walk/pause |
| NPC Approach | npcApproach.js | NPCs approach player | Proximity + sentiment triggers |
| NPC TTS | npcTTS.js | Text-to-speech for NPCs | Web Speech API, gender-matched |
| Narrator TTS | narratorTTS.js | Text-to-speech for narrator | Web Speech API |
| Voice Input | voiceInput.js | Push-to-talk speech-to-text | Web Speech API |
| Timed Events | timedEvents.js | Dramatic countdown challenges | Timer bar + pressure sequences |
| Chase | chase.js | NPC flee sequences | Exit pathfinding + catch mechanics |
| Ambient Music | ambientMusic.js | Procedural noir soundtrack | Web Audio API layers |
| Weather | weather.js | Rain, fog, snow, storm | Phaser particle emitters |
| Lighting | lighting.js | Flashlight / fog-of-war | GeometryMask, auto-enables Day 2+ |
| Backend | server.ts | Sessions, endpoints, Director | Copilot SDK, retry logic, health checks |
| Game State | gameState.ts | Evidence, accusations, days | Validation logic, day progression |
| Mystery Gen | mystery-generator.ts | Skeleton Key prompts | On-demand procedural mysteries |
| Creative Agency | creative-agent.ts | 3 parallel visual design agents | DrawOp DSL, Promise.allSettled |
| Narrator | narrator.ts | Atmospheric prose agent | Noir narration + hint system |
| Profiler | profiler.ts | Detective behavior analysis | Style/trait detection every 3rd question |
| Hidden Room | server.ts + ManorScene.js | Late-game map expansion | Dynamic room reveal, doorway clearing |
| Red Herring NPC | server.ts + ManorScene.js | Misleading dynamic NPC | Random archetype pool, probabilistic spawn |
| SDK Hooks | server.ts | Reactive cross-agent side effects | `onPostToolUse` for eavesdropping, emotional propagation |
| Director Resilience | server.ts | Auto-retry + night fallback | `directorSendAndWait()`, fallback pairs |
| Emotion Nudging | server.ts | Server-side sentiment shifts | `nudgeEmotion()` + evidence show emotions |

---

This extraction covers all technical architecture NOT in the NPC design guide. Ready to port to different games/settings! 🎮
---

## BUILDING DIFFERENT SETTINGS

The engine is setting-agnostic. Here's what to change for each new setting.

### Setting Examples

| Setting | Rooms | Theme | Floor Tiles |
|---------|-------|-------|-------------|
| Manor | study, library, kitchen, garden | Dark burgundy/gold | carpet, wood, grass |
| Hotel | lobby, rooms 101-104, restaurant, pool, parking | Art deco gold/teal | marble, carpet, concrete |
| Cruise Ship | deck, cabins, dining hall, engine room, bridge | Navy/brass | metal, wood, water |
| Supermarket | aisles 1-5, stockroom, office, parking lot, break room | Fluorescent white/green | linoleum, concrete |
| Ski Lodge | lounge, rooms, sauna, kitchen, ski rental, slope | Warm wood/snow white | wood, stone, snow |

### What You Must Change Per Level

#### 1. Map Layout (`ManorScene.js` → `LevelScene.js`)

```javascript
// Define rooms with tile coordinates
this.rooms = {
  lobby:    { name:'Hotel Lobby',  x:10, y:1,  w:16, h:10, floor:'tile_marble' },
  room_101: { name:'Room 101',     x:1,  y:12, w:8,  h:8,  floor:'tile_carpet' },
  // ... more rooms
};

// Define doorways connecting rooms
this.doors = [
  { x:14, y:11, w:2, h:4 }, // lobby <-> hallway
  // ...
];
```

**Rules for map design:**
- Rooms must not overlap
- Leave 1-2 tile gaps between rooms for walls
- Doors must span both room walls + gap (typically 4 tiles wide or tall)
- Interior walkable area = room minus 1-tile border on all sides
- Place NPCs and evidence within interior bounds

#### 2. Tile Textures (`BootScene.js`)

```javascript
// Add new tile types in _genTiles()
this._tex('tile_marble', 32, 32, g => {
  g.fillStyle(0xd4c5a9); g.fillRect(0,0,32,32);
  g.lineStyle(1, 0xbba88a); g.strokeRect(0,0,32,32);
  // marble veining
  g.lineStyle(1, 0xc9b99a, 0.3);
  g.beginPath(); g.moveTo(5,0); g.lineTo(27,32); g.strokePath();
});
```

#### 3. Character Sprites (`BootScene.js`)

```javascript
// Each NPC needs a _tex call with unique colors
this._tex('npc_bellboy', 32, 32, g => {
  g.fillStyle(0x800020); g.fillRect(cx-6,cy-2,12,14); // red uniform
  // ... head, hair, details
});
```

#### 4. Evidence Sprites (`BootScene.js`)

```javascript
// Each evidence item needs a 16x16 sprite
this._tex('ev_room_key', 16, 16, g => {
  g.fillStyle(0xc9a84c); g.fillRect(5,2,6,3); // key head
  g.fillRect(7,5,2,8); // key shaft
});
```

#### 5. Furniture (`BootScene.js`)

```javascript
// Setting-appropriate furniture
this._tex('furn_reception_desk', 96, 32, g => { /* ... */ });
this._tex('furn_hotel_bed', 48, 64, g => { /* ... */ });
```

#### 6. CSS Theme (`style.css`)

```css
:root {
  /* Hotel: Art Deco */
  --black:    #0a0a0a;
  --burgundy: #1a3a3a;    /* teal instead of burgundy */
  --gold:     #c9a84c;    /* keep gold for luxury */
  --cream:    #e8dcc8;
  --font-heading: 'Cinzel', Georgia, serif;  /* different font */
}
```

#### 7. Backend Configuration

**`src/gameState.ts`** — Replace:
- `EVIDENCE` array with new evidence items
- `EVIDENCE_POSITIONS` with coordinates matching new map
- `CORRECT_SUSPECT`, `KEY_EVIDENCE`, `MOTIVE_KEYWORDS`
- Initial `npcSentiments` for new characters

**`src/characters/`** — New character files with:
- Full system prompts per the template in npc-design-guide.md
- `index.ts` exporting the new character array

**`src/director.ts`** — Update `DIRECTOR_SYSTEM_PROMPT` with:
- New setting description
- New character secrets and relationships
- New evidence list

**`server.ts`** — No changes needed (it's setting-agnostic)

#### 8. Accusation Modal (`main.js`)

```javascript
// Update suspect list
const suspects = [
  { id: 'bellboy',    name: 'Marcus the Bellboy' },
  { id: 'manager',    name: 'Ms. Chen, Hotel Manager' },
  // ...
];
```

### File Checklist for a New Level

```
src/
  characters/
    *.ts              — One per NPC (system prompts)
    types.ts          — Reuse as-is
    index.ts          — Export new character array
  gameState.ts        — New evidence, positions, accusation config, sentiments
  director.ts         — Updated Director prompt with full mystery knowledge
  tools.ts            — Reuse as-is (tools are setting-agnostic)

public/
  js/scenes/
    BootScene.js      — New sprites (tiles, NPCs, evidence, furniture)
    ManorScene.js     — New room layout, NPC positions, evidence positions
    UIScene.js        — Reuse as-is
  js/
    main.js           — Update suspects list
    dialog.js         — Reuse as-is
    inventory.js      — Reuse as-is
    api.js            — Reuse as-is
  css/
    style.css         — Update CSS vars for theme (optional)
  index.html          — Reuse as-is

server.ts             — Reuse as-is
package.json          — Reuse as-is
docs/                 — Reuse as reference
```

### Reusable vs. Level-Specific

| Component | Reusable? | Notes |
|-----------|-----------|-------|
| Express server + routes | ✅ Yes | Setting-agnostic |
| Copilot SDK session management | ✅ Yes | Handles any number of NPCs |
| Healthcheck + retry system | ✅ Yes | Works for any sessions |
| Dialog UI (HTML/CSS/JS) | ✅ Yes | Themes via CSS vars |
| Inventory/notebook system | ✅ Yes | Data-driven |
| Accusation system | ✅ Yes | Config in gameState.ts |
| Day/night cycle | ✅ Yes | Timer + Director-driven |
| NPC sentiment system | ✅ Yes | Generic emotional tracking + auto-nudging |
| Game tools (tools.ts) | ✅ Yes | Character-agnostic |
| SDK hooks (onPostToolUse) | ✅ Yes | Reactive side effects work for any NPCs |
| Hidden room system | ✅ Yes | Data-driven room expansion |
| Red herring NPC system | ✅ Yes | Random archetype pool, works with any level |
| Phaser physics + collision | ✅ Yes | Data-driven from room defs |
| NPC emotion visuals | ✅ Yes | Polls sentiments, renders floating icons/tints |
| Crime replay system | ✅ Yes | Director generates + player navigates chapters |
| Mystery generation | ✅ Yes | Skeleton Key + Creative Agency |
| Weather/lighting/music | ✅ Yes | Setting-adaptive (configurable) |
| NPC TTS / voice input | ✅ Yes | Browser Speech APIs |
| Chase / timed events | ✅ Yes | Triggered by game events |
| Director resilience | ✅ Yes | Auto-retry + fallback pairs |
| Character system prompts | ❌ Per-level | Unique to each mystery |
| Director system prompt | ❌ Per-level | Needs full mystery knowledge |
| Room layout / tile map | ❌ Per-level | Setting-specific |
| Sprites | ❌ Per-level | Setting-specific visuals |
| Evidence definitions | ❌ Per-level | Story-specific |
| Accusation validation | ❌ Per-level | Who did it + how |
