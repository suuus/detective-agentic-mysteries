      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line in buffer
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === '[DONE]') return;
        try {
          const parsed = JSON.parse(payload);
          yield parsed.text ?? parsed.content ?? payload;
        } catch {
          // plain-text chunk
          yield payload;
        }
      }
    }
  }
  // ── Forensic analysis (SSE streaming) ───────────────────────────
  async *analyzeEvidence(evidenceId) {
    const res = await fetch(`${this.baseUrl}/api/forensics/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ evidenceId }),
    });
    if (!res.ok) throw new Error(`Analysis failed (${res.status})`);
    
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === '[DONE]') return;
        try {
          const parsed = JSON.parse(payload);
          yield parsed.content ?? payload;
        } catch { yield payload; }
      }
    }
  }
  // ── Evidence ───────────────────────────────────────────────────
  async getEvidence() {
    const res = await fetch(`${this.baseUrl}/api/evidence`);
    if (!res.ok) throw new Error(`Failed to fetch evidence (${res.status})`);
    return res.json();
  }
  async collectEvidence(id) {
    const res = await fetch(`${this.baseUrl}/api/evidence/${id}/collect`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`Failed to collect evidence (${res.status})`);
    return res.json();
  }
  async showEvidence(evidenceId, characterId) {
    const res = await fetch(
      `${this.baseUrl}/api/evidence/${evidenceId}/show/${characterId}`,
      { method: 'POST' },
    );
    if (!res.ok) throw new Error(`Failed to show evidence (${res.status})`);
    return res.json();
  }
  // ── Game state ─────────────────────────────────────────────────
  async getState() {
    const res = await fetch(`${this.baseUrl}/api/state`);
    if (!res.ok) throw new Error(`Failed to fetch state (${res.status})`);
    return res.json();
  }
  // ── Accusation ─────────────────────────────────────────────────
  async accuse(suspectId, motive, evidenceIds) {
    const res = await fetch(`${this.baseUrl}/api/accuse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suspectId, motive, evidenceIds }),
    });
    if (!res.ok) throw new Error(`Accusation failed (${res.status})`);
    return res.json();
  }
  // ── Day/night cycle ────────────────────────────────────────────
  async getDay() {
    const res = await fetch(`${this.baseUrl}/api/day`);
    if (!res.ok) throw new Error(`Failed to fetch day (${res.status})`);
    return res.json();
  }
  async advanceDay() {
    const res = await fetch(`${this.baseUrl}/api/day/advance`, { method: 'POST' });
    if (!res.ok) throw new Error(`Failed to advance day (${res.status})`);
    return res.json();
  }
  async getEvidencePositions() {
    const res = await fetch(`${this.baseUrl}/api/evidence/positions`);
    if (!res.ok) throw new Error(`Failed to fetch positions (${res.status})`);
    return res.json();
  }
  // ── Reset ──────────────────────────────────────────────────────
  async reset() {
    const res = await fetch(`${this.baseUrl}/api/reset`, { method: 'POST' });
    if (!res.ok) throw new Error(`Reset failed (${res.status})`);
    return res.json();
  }
  // ── Narrator ────────────────────────────────────────────────
  async narrate(trigger, context = '') {
    const res = await fetch(`${this.baseUrl}/api/narrate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trigger, context }),
    });
    if (!res.ok) return { narration: '' };
    return res.json();
  }
  // ── Sentiment ─────────────────────────────────────────────────
  async getSentiment(characterId) {
    const res = await fetch(`${this.baseUrl}/api/sentiments/${characterId}`);
    if (!res.ok) throw new Error(`Failed to fetch sentiment (${res.status})`);
    return res.json();
  }
  // ── Detective profile ─────────────────────────────────────────
  async getProfile() {
    const res = await fetch(`${this.baseUrl}/api/profile`);
    if (!res.ok) throw new Error(`Failed to fetch profile (${res.status})`);
    return res.json();
  }
  // ── Level selection ─────────────────────────────────────────────
  async getLevels() {
    const res = await fetch(`${this.baseUrl}/api/levels`);
    if (!res.ok) throw new Error(`Failed to fetch levels (${res.status})`);
    return res.json();
  }
  async selectLevel(levelId) {
    const res = await fetch(`${this.baseUrl}/api/level/select`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ levelId }),
    });
    if (!res.ok) throw new Error(`Failed to select level (${res.status})`);
    return res.json();
  }
  async getLevel() {
    const res = await fetch(`${this.baseUrl}/api/level`);
    if (!res.ok) throw new Error(`Failed to fetch current level (${res.status})`);
    return res.json();
  }
  // ── Mystery generation ─────────────────────────────────────────
  async *generateMystery() {
    const res = await fetch(`${this.baseUrl}/api/mystery/generate`, { method: 'POST' });
    if (!res.ok) throw new Error(`Generation failed (${res.status})`);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === '[DONE]') return;
        try { yield JSON.parse(payload); } catch { yield { status: payload }; }
      }
    }
  }
  async getMystery() {
    const res = await fetch(`${this.baseUrl}/api/mystery`);
    if (!res.ok) throw new Error(`Failed (${res.status})`);
    return res.json();
  }
  async getCharacters() {
    const res = await fetch(`${this.baseUrl}/api/characters`);
    if (!res.ok) throw new Error(`Failed to fetch characters (${res.status})`);
    return res.json();
  }
  async getMysteryRooms() {
    const res = await fetch(`${this.baseUrl}/api/mystery/rooms`);
    if (!res.ok) throw new Error(`Failed (${res.status})`);
    return res.json();
  }
}
```
---
## 6. GAMESTATE.TS — Full Game State Structure
### Core Types
```typescript
export interface NPCSentiment {
  towardDetective: number;        // -10 (hostile) to +10 (cooperative)
  towardOthers: Record<string, number>;
  emotionalState: string;
  recentEmotions: string[];
}
export interface PlayerProfile {
  style: string;           // 'aggressive' | 'sympathetic' | 'methodical' | 'scattered' | 'unknown'
  confidence: number;      // 0-1
  traits: string[];
  questionCount: number;
  lastAnalysis: string;
}
export interface GameState {
  evidenceCollected: string[];
  evidenceShownTo: Record<string, string[]>;
  charactersInterrogated: string[];
  accusationsMade: number;
  gameWon: boolean;
  gameLost: boolean;
  currentDay: number;
  timeOfDay: 'day' | 'night';
  dayStartedAt: number;
  overnightEvents: string[];
  removedEvidence: string[];
  npcSentiments: Record<string, NPCSentiment>;
  playerProfile: PlayerProfile;
  reputation: {
    style: 'unknown' | 'aggressive' | 'sympathetic' | 'methodical' | 'deceptive';
    aggressiveCount: number;
    sympatheticCount: number;
    totalInteractions: number;
    gossipLog: string[];
  };
  eavesdropped: Record<string, string[]>;
  contradictions: { npc1: string; npc2: string; topic: string; detail: string }[];
  panicEvents: { type: string; description: string; day: number; affectedNPCs: string[] }[];
  alliances: { members: string[]; type: 'alliance' | 'rivalry'; reason: string }[];
  tamperedEvidence: string[];
}
```
### Evidence Definitions
```typescript
const EVIDENCE: Evidence[] = [
  {
    id: "brandy_glass",
    name: "Brandy Glass",
    description: "A crystal brandy glass found in the study",
    location: "study",
    detail: "A crystal brandy glass. It's been wiped, but you notice a faint residue and an unusual bitter smell.",
  },
  {
    id: "prescription_pad",
    name: "Prescription Pad",
    description: "Dr. Hartwell's prescription pad found in the library",
    location: "library",
    detail: "Dr. Hartwell's prescription pad. One page has been torn out recently — the torn edge is still fresh.",
  },
  {
    id: "foxglove_cuttings",
    name: "Foxglove Cuttings",
    description: "Freshly cut foxglove stems found in the garden",
    location: "garden",
    detail: "Several foxglove stems have been freshly cut. Foxglove is the source of digitalis — a heart medication that's deadly in high doses.",
  },
  {
    id: "edmunds_letter",
    name: "Edmund's Letter",
    description: "An unfinished letter found in the study",
    location: "study",
    detail: "An unfinished letter addressed to the Medical Board: 'I write to report Dr. James Hartwell for the forging of prescriptions. I have evidence that he has been—' The letter stops abruptly.",
  },
  {
    id: "love_letter",
    name: "Love Letter",
    description: "A folded letter found in the conservatory",
    location: "conservatory",
    detail: "A folded letter tucked between orchid care notes. 'My dearest R, I cannot bear another evening pretending. After tomorrow, we shall be free. Yours always, V.'",
  },
  {
    id: "business_documents",
    name: "Business Documents",
    description: "Partnership dissolution papers found in the study",
    location: "study",
    detail: "Partnership dissolution papers between Edmund Blackwood and Reginald Price. Partially signed. Notes in the margin read: 'Final — no negotiation.'",
  },
  {
    id: "agnes_diary",
    name: "Agnes's Diary",
    description: "Agnes's diary found in the kitchen",
    location: "kitchen",
    detail: "Today's entry reads: 'The brandy smelled off tonight when I checked the decanter. Probably nothing, but Lord Blackwood does prefer his usual brand. Dr. Hartwell was pacing about after half nine, most unlike him.'",
  },
  {
    id: "claras_manuscript",
    name: "Clara's Manuscript",
    description: "Pages of a novel manuscript found in the bedroom",
    location: "bedroom",
    detail: "Pages of a novel manuscript. Each page is dated and timed. Tonight's entries run continuously from 8:30 PM to 10:00 PM. The handwriting is consistent throughout.",
  },
];
const CORRECT_SUSPECT = "hartwell";
const KEY_EVIDENCE = ["brandy_glass", "prescription_pad", "edmunds_letter", "foxglove_cuttings"];
const MOTIVE_KEYWORDS = ["prescription", "blackmail", "forging", "forge", "forged"];
export const EVIDENCE_POSITIONS: Record<string, { x: number; y: number }> = {
  brandy_glass: { x: 5, y: 15 },
  prescription_pad: { x: 29, y: 15 },
  foxglove_cuttings: { x: 18, y: 25 },
  edmunds_letter: { x: 7, y: 16 },
  love_letter: { x: 6, y: 24 },
  business_documents: { x: 4, y: 17 },
  agnes_diary: { x: 5, y: 7 },
  claras_manuscript: { x: 31, y: 27 },
  burnt_note: { x: 18, y: 27 },
  muddy_footprints: { x: 6, y: 16 },
  digitalis_vial: { x: 19, y: 6 },
  victoria_telegram: { x: 28, y: 7 },
};
```
### GameStateManager Class - Constructor & Fresh State
```typescript
export class GameStateManager {
  private state: GameState;
  private nightConversations: NightConversation[] = [];
  private directorPlan: DirectorPlan | null = null;
  private _correctSuspect: string = CORRECT_SUSPECT;
  private _keyEvidence: string[] = KEY_EVIDENCE;
  private _motiveKeywords: string[] = MOTIVE_KEYWORDS;
  private _winMessage: string = "Brilliant deduction...";
  constructor() {
    this.state = this.createFreshState();
  }
  private createFreshState(): GameState {
    return {
      evidenceCollected: [],
      evidenceShownTo: {},
      charactersInterrogated: [],
      accusationsMade: 0,
      gameWon: false,
      gameLost: false,
      currentDay: 1,
      timeOfDay: 'day',
      dayStartedAt: Date.now(),
      overnightEvents: [],
      removedEvidence: [],
      npcSentiments: {
        victoria: { towardDetective: 2, towardOthers: { hartwell: 0, clara: 3, price: 8, agnes: 1 }, emotionalState: 'calm', recentEmotions: [] },
        hartwell: { towardDetective: 3, towardOthers: { victoria: 0, clara: -1, price: -2, agnes: -3 }, emotionalState: 'nervous', recentEmotions: [] },
        clara: { towardDetective: 4, towardOthers: { victoria: -2, hartwell: -3, price: -1, agnes: 5 }, emotionalState: 'angry', recentEmotions: [] },
        price: { towardDetective: 1, towardOthers: { victoria: 8, hartwell: 0, clara: 0, agnes: -1 }, emotionalState: 'calm', recentEmotions: [] },
        agnes: { towardDetective: 5, towardOthers: { victoria: 2, hartwell: -4, clara: 6, price: -1 }, emotionalState: 'calm', recentEmotions: [] },
      },
      playerProfile: {
        style: 'unknown',
        confidence: 0,
        traits: [],
        questionCount: 0,
        lastAnalysis: 'The detective has just arrived. Their approach is unknown.',
      },
      reputation: {
        style: 'unknown',
        aggressiveCount: 0,
        sympatheticCount: 0,
        totalInteractions: 0,
        gossipLog: [],
      },
      eavesdropped: {},
      contradictions: [],
      panicEvents: [],
      alliances: [],
      tamperedEvidence: [],
    };
  }
}
```
### Day Advancement & Evidence Management
```typescript
advanceToNight(): void {
  this.state.timeOfDay = 'night';
}
advanceToNextDay(): { dayConfig: DayConfig; removedEvidence: string[] } {
  const hasHardcodedDays = this.state.currentDay < DAY_CONFIGS.length;
  const hasDirectorPlan = this.directorPlan !== null;
  if (!hasHardcodedDays && !hasDirectorPlan) {
    return { dayConfig: this.getDayConfig(), removedEvidence: [] };
  }
  this.state.currentDay++;
  this.state.timeOfDay = 'day';
  this.state.dayStartedAt = Date.now();
  const actuallyRemoved: string[] = [];
  // Apply Director's plan if available
  if (this.directorPlan) {
    // Add Director's new evidence to the active pool
    for (const ev of this.directorPlan.newEvidence) {
      if (!EVIDENCE.find(e => e.id === ev.id)) {
        EVIDENCE.push(ev);
      }
    }
    // Remove Director-specified evidence
    for (const evId of this.directorPlan.removedEvidence) {
      if (!this.state.evidenceCollected.includes(evId) && !this.state.removedEvidence.includes(evId)) {
        this.state.removedEvidence.push(evId);
        actuallyRemoved.push(evId);
      }
    }
    // Move Director-specified evidence
    for (const moved of this.directorPlan.movedEvidence) {
      if (!this.state.evidenceCollected.includes(moved.id)) {
        const base = EVIDENCE.find(e => e.id === moved.id);
        if (base) base.location = moved.newLocation;
        EVIDENCE_POSITIONS[moved.id] = { x: moved.x, y: moved.y };
      }
    }
    // Use Director's narrative
    if (this.directorPlan.overnightNarrative) {
      this.state.overnightEvents.push(this.directorPlan.overnightNarrative);
    }
  }
  return { dayConfig: config, removedEvidence: actuallyRemoved };
}
```
### Accusation Logic
```typescript
makeAccusation(
  suspectId: string,
  motive: string,
  evidenceIds: string[]
): { correct: boolean; message: string } {
  if (this.state.gameWon) {
    return { correct: true, message: "You have already solved the case!" };
  }
  if (this.state.gameLost) {
    return {
      correct: false,
      message: "You have exhausted all your accusations. The case has gone cold.",
    };
  }
  this.state.accusationsMade++;
  const correctSuspect = suspectId.toLowerCase() === this._correctSuspect;
  const motiveLower = motive.toLowerCase();
  const correctMotive = this._motiveKeywords.some((kw) => motiveLower.includes(kw));
  const matchingEvidence = evidenceIds.filter((id) => this._keyEvidence.includes(id));
  const correctEvidence = matchingEvidence.length >= 2;
  if (correctSuspect && correctMotive && correctEvidence) {
    this.state.gameWon = true;
    return {
      correct: true,
      message: this._winMessage,
    };
  }
  const remaining = 3 - this.state.accusationsMade;
  if (remaining <= 0) {
    this.state.gameLost = true;
    return {
      correct: false,
      message: "Incorrect, and you have no accusations remaining. The killer walks free...",
    };
  }
  const hints: string[] = [];
  if (!correctSuspect) hints.push("You may be accusing the wrong person.");
  if (!correctMotive) hints.push("Consider what the killer stood to lose.");
  if (!correctEvidence) hints.push("Review the physical evidence more carefully...");
  return {
    correct: false,
    message: `Incorrect accusation. ${hints.join(" ")} You have ${remaining} accusation${remaining === 1 ? "" : "s"} remaining.`,
  };
}
```
### Reset Logic
```typescript
reset(): void {
  this.state = this.createFreshState();
  this.nightConversations = [];
  this.directorPlan = null;
  this._correctSuspect = CORRECT_SUSPECT;
  this._keyEvidence = KEY_EVIDENCE;
  this._motiveKeywords = MOTIVE_KEYWORDS;
  this._winMessage = "Brilliant deduction...";
  // Restore manor evidence (may have been overwritten by cruise/random)
  EVIDENCE.length = 0;
  EVIDENCE.push(...MANOR_EVIDENCE);
  for (const key of Object.keys(EVIDENCE_POSITIONS)) {
    delete EVIDENCE_POSITIONS[key];
  }
  Object.assign(EVIDENCE_POSITIONS, MANOR_EVIDENCE_POSITIONS);
}
loadLevelConfig(config: {
  evidence: Evidence[];
  evidencePositions: Record<string, { x: number; y: number }>;
  correctSuspect: string;
  keyEvidence: string[];
  motiveKeywords: string[];
  initialSentiments: Record<string, NPCSentiment>;
  winMessage: string;
}): void {
  // Override evidence
  EVIDENCE.length = 0;
  EVIDENCE.push(...config.evidence);
  // Override positions
  for (const key of Object.keys(EVIDENCE_POSITIONS)) {
    delete EVIDENCE_POSITIONS[key];
  }
  Object.assign(EVIDENCE_POSITIONS, config.evidencePositions);
  // Override accusation config
  this._correctSuspect = config.correctSuspect;
  this._keyEvidence = config.keyEvidence;
  this._motiveKeywords = config.motiveKeywords;
  this._winMessage = config.winMessage;
  // Override sentiments
  this.state.npcSentiments = config.initialSentiments;
}
```
---
## 7. CHARACTERS/TYPES.TS — CharacterDefinition Interface
```typescript
export interface CharacterDefinition {
  id: string;
  name: string;
  role: string;
  location: string;
  spriteKey: string;
  systemPrompt: string;
}
```
---
## 8. BOOTSCENE.JS — Sprite Generation
### _tex() Method (Graphics Texture Generator)
```javascript
_tex(key, w, h, fn) {
  const g = this.make.graphics({ add: false });
  fn(g, w, h);
  g.generateTexture(key, w, h);
  g.destroy();
}
```
- Creates temporary graphics object
- Calls `fn(graphics, width, height)` to draw on it
- Generates texture from the graphics
- Destroys temporary graphics
### _genNPCs() — NPC Sprite Generation
```javascript
_genNPCs() {
  const npcs = [
    { key:'npc_victoria', body:0x8B2252, hair:0xDAA520, accent:0x6b1a3f },
    { key:'npc_hartwell', body:0x2F4F4F, hair:0x696969, accent:0xffffff },
    { key:'npc_clara',    body:0x4a3280, hair:0x8B4513, accent:0xdda0dd },
    { key:'npc_price',    body:0x1a1a2e, hair:0x333333, accent:0xc9a84c },
    { key:'npc_agnes',    body:0x2d2d2d, hair:0xaaaaaa, accent:0xf5f5f5 },
  ];
  npcs.forEach(n => {
    this._tex(n.key, 32, 32, g => {
      const cx=16, cy=16;
      g.fillStyle(n.body);    g.fillRect(cx-6,cy-2,12,14);
      g.fillStyle(0xe8c99b);  g.fillRect(cx-5,cy-10,10,9);
      g.fillStyle(n.hair);    g.fillRect(cx-5,cy-13,10,5);
      g.fillStyle(0x222222);  g.fillRect(cx-3,cy-6,2,2); g.fillRect(cx+1,cy-6,2,2);
      g.fillStyle(n.accent);  g.fillRect(cx-1,cy-2,2,3);
      g.fillStyle(0x2a2a2a);  g.fillRect(cx-4,cy+12,3,4); g.fillRect(cx+1,cy+12,3,4);
    });
  });
}
```
- Each NPC is 32x32 pixels
- Body: colored rectangle at center
- Head: skin-colored rectangle
- Hair: colored rectangle at top
- Eyes: small black rectangles (differs per direction)
- Accent: colored badge/detail
- Legs: dark rectangles at bottom
### _genPlayer() — Player Animation Frames
```javascript
_genPlayer() {
  const S = 32;
  const dirNames = ['down','left','right','up'];
  for (let d = 0; d < 4; d++) {
    for (let f = 0; f < 3; f++) {
      const key = `player_${dirNames[d]}_${f}`;
      this._tex(key, S, S, (g) => {
        const cx = S/2, cy = S/2;
        const wb = f === 1 ? -1 : f === 2 ? 1 : 0;  // walk bob
        // Body: 0x5c4a32 (brown)
        // Head: 0xe8c99b (skin)
        // Hat: 0x3a2f24 (dark brown)
        // Eyes: 0x222222 (black) — only if not 'up' direction
        // Legs: 0x2a2a2a, Shoes: 0x1a1a1a
      });
    }
  }
  // Create walk and idle animations for each direction
  const fr = 8;  // frame rate
  for (let d = 0; d < 4; d++) {
    const dir = dirNames[d];
    this.anims.create({
      key: `walk-${dir}`,
      frames: [
        { key: `player_${dir}_0` },
        { key: `player_${dir}_1` },
        { key: `player_${dir}_0` },
        { key: `player_${dir}_2` },
      ],
      frameRate: fr, repeat: -1
    });
    this.anims.create({
      key: `idle-${dir}`,
      frames: [{ key: `player_${dir}_0` }],
      frameRate: 1, repeat: -1
    });
  }
}
```
- 3 frames per direction (32x32 each)
- Frame 0: neutral
- Frame 1: left leg forward, bob -1
- Frame 2: right leg forward, bob +1
- Creates walk animation (alternates 0-1-0-2)
- Creates idle animation (single frame repeat)
### _genEvidence() — Evidence Item Sprites
```javascript
_genEvidence() {
  const items = {
    brandy_glass: (g,cx,cy) => {
      g.fillStyle(0xc9a84c); g.fillRect(cx-3,cy-6,6,8);
      g.fillStyle(0x8B4513); g.fillRect(cx-2,cy-4,4,4);
      g.fillStyle(0xc9a84c); g.fillRect(cx-1,cy+2,2,4); g.fillRect(cx-3,cy+5,6,2);
    },
    prescription_pad: (g,cx,cy) => {
      g.fillStyle(0xf5f5dc); g.fillRect(cx-5,cy-6,10,12);
      g.fillStyle(0x333333); g.fillRect(cx-3,cy-4,6,1); g.fillRect(cx-3,cy-2,4,1);
      g.fillStyle(0xcc3333); g.fillRect(cx+2,cy-6,3,3);
    },
    // ... more items ...
  };
  for (const [key, draw] of Object.entries(items)) {
    this._tex('ev_'+key, 16, 16, g => draw(g, 8, 8));
  }
  this._tex('ev_glow', 24, 24, g => {
    g.fillStyle(0xc9a84c, 0.3);
    g.fillCircle(12, 12, 10);
  });
}
```
- Each evidence item is 16x16 pixels
- Custom draw function provided for each item type
- Glow effect: 24x24 semi-transparent golden circle (reused for all evidence)
EOF
cat /tmp/exploration_report.md
                EC=$?
                echo "___BEGIN___COMMAND_DONE_MARKER___$EC"
            }
___BEGIN___COMMAND_OUTPUT_MARKER___
# Phaser 3 Detective Game - Codebase Exploration Report

## 1. SERVER.TS — Routes, Game State Management, NPC Sessions, Reset Logic

### Imports & Core Setup
```typescript
import express from "express";
import cors from "cors";
import { CopilotClient, CopilotSession, approveAll } from "@github/copilot-sdk";
import { GameStateManager } from "./src/gameState.js";
import type { NightConversation, NightExchange } from "./src/gameState.js";
import { createGameTools } from "./src/tools.js";
import { createDirectorTools, DIRECTOR_SYSTEM_PROMPT } from "./src/director.js";
import { createNarratorTools, NARRATOR_SYSTEM_PROMPT } from "./src/narrator.js";
import { createProfilerTools, PROFILER_SYSTEM_PROMPT } from "./src/profiler.js";
import { characters } from "./src/characters/index.js";
import { cruiseCharacters } from "./src/characters/cruise/index.js";
import { CRUISE_CONFIG } from "./src/levels/cruise.js";
import { CRUISE_DIRECTOR_PROMPT } from "./src/levels/cruise-director.js";
import { SKELETON_PROMPT, buildCharacterPrompt, buildDirectorPromptRequest } from "./src/mystery-generator.js";
import type { GeneratedMystery } from "./src/mystery-generator.js";

const gameState = new GameStateManager();
const gameTools = createGameTools(gameState);
const client = new CopilotClient();
const sessions = new Map<string, CopilotSession>();
```

### Session Management
- Sessions stored in `Map<string, CopilotSession>()` indexed by characterId
- Each NPC gets sessionId: `blackwood-${characterId}`
- Sessions created via `client.createSession()` with name, instructions, and tools
- Sessions cleaned up via `client.deleteSession()` before recreation
- Active requests tracked in `activeRequests.set(characterId, { startedAt, session })`

### NPC Session Creation
```
getOrCreateSession(characterId) {
  - Check if existing session exists
  - If not, create new: client.createSession({
      sessionId: `blackwood-${characterId}`,
      name: character.name,
      instructions: character.systemPrompt,
      tools: gameTools,
      approval: approveAll
    })
  - Return session
}

recreateSession(characterId) {
  - Delete old session: await client.deleteSession(sessionId)
  - Create completely fresh session
  - Ensures clean start with no persisted state
}
```

### Talk to Character (SSE Streaming)
```
POST /api/talk/:characterId
- gameState.markInterrogated(characterId)
- gameState.recordQuestion()
- Get/create session for character
- Call session.sendAndWait({ prompt: message }, 45_000)
- Stream response via SSE on message_delta events
- Timeout after 45 seconds, force recreate on failure
- Eavesdropping: nearby NPCs may hear the conversation
```

### All Existing Endpoints

**Game State & Data:**
- `GET /api/state` — Full game state
- `GET /api/day` — Current day, time, day config
- `POST /api/day/advance` — Trigger night conversations, advance to next day
- `GET /api/evidence` — All active evidence (with collected status)
- `GET /api/evidence/positions` — Evidence x,y coordinates for scenes
- `GET /api/characters` — All NPC definitions
- `GET /api/levels` — Available level select options
- `GET /api/level` — Current selected level
- `POST /api/level/select` — Load different level (manor/cruise/random)
- `GET /api/mystery` — Generated mystery data
- `GET /api/mystery/rooms` — Rooms from generated mystery
- `POST /api/mystery/generate` — Generate new mystery (streaming)

**Interactions:**
- `POST /api/talk/:characterId` — Talk to NPC (SSE streaming)
- `POST /api/evidence/:evidenceId/collect` — Collect evidence
- `POST /api/evidence/:evidenceId/show/:characterId` — Show evidence to NPC
- `POST /api/forensics/analyze` — Analyze evidence forensically (streaming)

**Investigation Tracking:**
- `GET /api/sentiments` — All NPC sentiments
- `GET /api/sentiments/:characterId` — Single NPC sentiment
- `GET /api/profile` — Detective profile (aggressive/sympathetic/methodical)
- `GET /api/reputation` — Reputation tracking & gossip log
- `GET /api/contradictions` — Contradictions detected between NPCs
- `GET /api/events` — Panic events triggered
- `GET /api/alliances` — Detected alliances/rivalries

**Accusations & Resolution:**
- `POST /api/accuse` — Make accusation with suspect, motive, evidence
- `POST /api/narrate` — Request narrator narration for trigger & context

**System:**
- `POST /api/reset` — Full reset: clear sessions, reset game state
- `GET /api/health` — Health check on all sessions
- `POST /api/reset` — Full reset of game

### Reset Logic
```typescript
POST /api/reset {
  // 1. Disconnect and delete ALL active sessions
  for (const [id, session] of sessions) {
    try { await session.disconnect(); } catch {}
    try { await client.deleteSession(`blackwood-${id}`); } catch {}
  }
  sessions.clear();

  // 2. Reset game state
  gameState.reset();
  
  // 3. Results in:
  - Fresh GameState (currentDay=1, timeOfDay='day', no evidence collected)
  - Restored manor evidence (if cruise/random had overwritten)
  - Empty night conversations
  - Cleared director plans
}
```

---

## 2. MANORSCENE.JS — Blackwood Manor Layout

### Room Definitions (Tile Coordinates)
```javascript
this.rooms = {
  main_hall:   { name:'Main Hall',       x:12, y:12, w:12, h:8,  floor:'tile_carpet' },
  study:       { name:'Study',           x:1,  y:12, w:10, h:8,  floor:'tile_carpet' },
  library:     { name:'Library',         x:25, y:12, w:10, h:8,  floor:'tile_carpet' },
  kitchen:     { name:'Kitchen',         x:1,  y:1,  w:10, h:10, floor:'tile_kitchen_floor' },
  dining_room: { name:'Dining Room',     x:25, y:1,  w:10, h:10, floor:'tile_floor' },
  conservatory:{ name:'Conservatory',    x:1,  y:21, w:10, h:10, floor:'tile_floor' },
  bedroom:     { name:"Clara's Bedroom", x:25, y:21, w:10, h:10, floor:'tile_carpet' },
  garden:      { name:'Garden',          x:12, y:21, w:12, h:10, floor:'tile_grass' },
  foyer:       { name:'Foyer',           x:12, y:1,  w:12, h:10, floor:'tile_floor' },
};

this.MAP_W = 36;  // tiles wide
this.MAP_H = 32;  // tiles tall
```

### Doorways
```javascript
this.doors = [
  { x:17, y:10, w:2, h:4 }, // foyer <-> main hall (vertical)
  { x:10, y:15, w:4, h:2 }, // study <-> main hall (horizontal)
  { x:23, y:15, w:4, h:2 }, // main hall <-> library (horizontal)
  { x:10, y:5,  w:4, h:2 }, // kitchen <-> foyer (horizontal)
  { x:23, y:5,  w:4, h:2 }, // foyer <-> dining room (horizontal)
  { x:17, y:19, w:2, h:4 }, // main hall <-> garden (vertical)
  { x:10, y:25, w:4, h:2 }, // conservatory <-> garden (horizontal)
  { x:23, y:25, w:4, h:2 }, // garden <-> bedroom (horizontal)
];
```

### _buildFloors(T) Full Method
```javascript
_buildFloors(T) {
  for (const room of Object.values(this.rooms)) {
    for (let ry = 0; ry < room.h; ry++)
      for (let rx = 0; rx < room.w; rx++)
        this.add.image((room.x+rx)*T+T/2, (room.y+ry)*T+T/2, room.floor).setDepth(0);

    // Room name label
    this.add.text((room.x+room.w/2)*T, (room.y+1)*T, room.name, {
      fontFamily: '"Playfair Display", serif', fontSize: '11px', color: '#c9a84c55'
    }).setOrigin(0.5).setDepth(1);
  }
  // Floor under doorways
  for (const d of this.doors)
    for (let dy=0; dy<d.h; dy++)
      for (let dx=0; dx<d.w; dx++)
        this.add.image((d.x+dx)*T+T/2, (d.y+dy)*T+T/2, 'tile_floor').setDepth(0);
}
```

### _buildWalls(T) Full Method
```javascript
_buildWalls(T) {
  // Passability grid (true = blocked)
  const grid = Array.from({length:this.MAP_H}, () => Array(this.MAP_W).fill(true));
  
  // Mark room interiors as passable
  for (const r of Object.values(this.rooms))
    for (let ry=1; ry<r.h-1; ry++)
      for (let rx=1; rx<r.w-1; rx++)
        grid[r.y+ry][r.x+rx] = false;
  
  // Mark doorways as passable
  for (const d of this.doors)
    for (let dy=0; dy<d.h; dy++)
      for (let dx=0; dx<d.w; dx++) {
        const gy=d.y+dy, gx=d.x+dx;
        if(gy>=0&&gy<this.MAP_H&&gx>=0&&gx<this.MAP_W) grid[gy][gx]=false;
      }

  // Place walls only on edges of blocked areas
  const neighbors = (x,y) => [[x-1,y],[x+1,y],[x,y-1],[x,y+1]];
  for (let y=0; y<this.MAP_H; y++)
    for (let x=0; x<this.MAP_W; x++) {
      if (!grid[y][x]) continue;
      // Only render visible walls (adjacent to passable)
      const visible = neighbors(x,y).some(([nx,ny]) =>
        nx>=0&&nx<this.MAP_W&&ny>=0&&ny<this.MAP_H&&!grid[ny][nx]);
      if (visible)
        this.add.image(x*T+T/2, y*T+T/2, 'tile_wall').setDepth(0);
      // Physics body for all wall cells
      const b = this.add.rectangle(x*T+T/2, y*T+T/2, T, T).setVisible(false);
      this.physics.add.existing(b, true);
      this.wallGroup.add(b);
    }
}
```

### _placeNPCs(T) Full Method
```javascript
_placeNPCs(T) {
  const defs = [
    { id:'victoria', key:'npc_victoria', name:'Lady Victoria',  x:6,  y:25 },
    { id:'hartwell', key:'npc_hartwell', name:'Dr. Hartwell',   x:30, y:16 },
    { id:'clara',    key:'npc_clara',    name:'Clara Blackwood', x:30, y:26 },
    { id:'price',    key:'npc_price',    name:'Mr. Price',      x:30, y:4  },
    { id:'agnes',    key:'npc_agnes',    name:'Mrs. Whitfield', x:6,  y:5  },
  ];
  
  for (const n of defs) {
    const sprite = this.physics.add.sprite(n.x*T+T/2, n.y*T+T/2, n.key)
      .setDepth(5).setImmovable(true);
    sprite.body.setSize(28, 28);
    sprite.setData('id', n.id);
    sprite.setData('name', n.name);

    const label = this.add.text(n.x*T+T/2, n.y*T-8, n.name, {
      fontFamily: '"Playfair Display", serif', fontSize: '9px', color: '#c9a84c',
      stroke: '#0a0a0a', strokeThickness: 2
    }).setOrigin(0.5).setDepth(10);
    this.npcLabels[n.id] = label;

    this.tweens.add({
      targets: sprite, scaleY:{from:1,to:1.03},
      duration:2000, yoyo:true, repeat:-1, ease:'Sine.easeInOut'
    });
    this.npcs[n.id] = sprite;
  }

  // Add NPC-to-NPC colliders so they never overlap
  const npcList = Object.values(this.npcs);
  for (let i = 0; i < npcList.length; i++) {
    for (let j = i + 1; j < npcList.length; j++) {
      this.physics.add.collider(npcList[i], npcList[j]);
    }
  }
}
```

### NPC Structure
```javascript
this.npcs = {
  victoria: Phaser.Physics.Sprite,
  hartwell: Phaser.Physics.Sprite,
  clara: Phaser.Physics.Sprite,
  price: Phaser.Physics.Sprite,
  agnes: Phaser.Physics.Sprite,
};

this.npcLabels = {
  victoria: Phaser.GameObjects.Text,
  hartwell: Phaser.GameObjects.Text,
  clara: Phaser.GameObjects.Text,
  price: Phaser.GameObjects.Text,
  agnes: Phaser.GameObjects.Text,
};
```

### _syncDayState() Full Method
```javascript
async _syncDayState() {
  try {
    const data = await window.gameAPI.getDay();
    this.currentDay = data.currentDay;
    this.isNight = data.timeOfDay === 'night';
    this._updateClock(0);
    if (this.isNight) {
      this.nightOverlay.setAlpha(0.6);
    }
  } catch (err) {
    console.warn('Failed to sync day state:', err);
  }
}
```

### Evidence Placement
```javascript
_placeEvidence(T) {
  const defs = [
    { id:'brandy_glass',       key:'ev_brandy_glass',       x:5,  y:14 },
    { id:'prescription_pad',   key:'ev_prescription_pad',   x:32, y:15 },
    { id:'foxglove_cuttings',  key:'ev_foxglove_cuttings',  x:16, y:26 },
    { id:'edmunds_letter',     key:'ev_edmunds_letter',     x:4,  y:15 },
    { id:'love_letter',        key:'ev_love_letter',        x:7,  y:24 },
    { id:'business_documents', key:'ev_business_documents', x:3,  y:14 },
    { id:'agnes_diary',        key:'ev_agnes_diary',        x:5,  y:7  },
    { id:'claras_manuscript',  key:'ev_claras_manuscript',  x:33, y:24 },
  ];
  for (const e of defs) {
    const glow = this.add.image(e.x*T+T/2, e.y*T+T/2, 'ev_glow').setDepth(8).setAlpha(0.7).setScale(1.5);
    this.tweens.add({
      targets:glow, alpha:{from:0.4,to:1.0}, scale:{from:1.3,to:1.8},
      duration:1200, yoyo:true, repeat:-1, ease:'Sine.easeInOut'
    });
    const sprite = this.physics.add.sprite(e.x*T+T/2, e.y*T+T/2, e.key)
      .setDepth(9).setImmovable(true).setScale(1.5);
    sprite.body.setSize(20,20);
    sprite.setData('id', e.id);
    this.evidenceItems[e.id] = { sprite, glow, collected:false };
  }
}
```

---

## 3. CRUISEMANORSCENE.JS — Cruise Ship Layout

### Room Definitions (Tile Coordinates)
```javascript
this.rooms = {
  bridge:           { name:'Bridge',            x:1,  y:1,  w:10, h:10, floor:'tile_metal' },
  observation_deck: { name:'Observation Deck',  x:12, y:1,  w:12, h:10, floor:'tile_wood_deck' },
  penthouse:        { name:'Penthouse Suite',   x:25, y:1,  w:10, h:10, floor:'tile_carpet_blue' },
  library:          { name:'Ship Library',      x:1,  y:12, w:10, h:8,  floor:'tile_carpet_blue' },
  lounge:           { name:'Grand Lounge',      x:12, y:12, w:12, h:8,  floor:'tile_carpet_blue' },
  casino:           { name:'Casino',            x:25, y:12, w:10, h:8,  floor:'tile_carpet_red' },
  kitchen:          { name:'Kitchen',           x:1,  y:21, w:10, h:10, floor:'tile_tile_white' },
  restaurant:       { name:'Restaurant',        x:12, y:21, w:12, h:10, floor:'tile_carpet_red' },
  pool_deck:        { name:'Pool Deck',         x:25, y:21, w:10, h:10, floor:'tile_wood_deck' },
  staff_quarters:   { name:'Staff Quarters',    x:1,  y:32, w:10, h:10, floor:'tile_metal' },
  medical_bay:      { name:'Medical Bay',       x:12, y:32, w:12, h:10, floor:'tile_tile_white' },
  security_office:  { name:'Security Office',   x:25, y:32, w:10, h:10, floor:'tile_metal' },
};

this.MAP_W = 36;  // tiles wide
this.MAP_H = 43;  // tiles tall (taller than manor)
```

### _buildFloors(T) — Same structure as ManorScene
Iterates rooms, places tiles per room.floor type, adds room name labels, floors doorways

### _buildWalls(T) — Same structure as ManorScene
Creates passability grid from rooms, marks doors passable, renders walls adjacent to blocked areas

### _placeNPCs(T) Full Method
```javascript
_placeNPCs(T) {
  const defs = [
    { id:'vasquez',    key:'npc_vasquez',    name:'Dr. Vasquez',        x:17, y:35 },
    { id:'harrington', key:'npc_harrington', name:'Capt. Harrington',   x:6,  y:5  },
    { id:'isabelle',   key:'npc_isabelle',   name:'Isabelle Thorne',    x:17, y:15 },
    { id:'volkov',     key:'npc_volkov',     name:'Nikolai Volkov',     x:17, y:25 },
    { id:'diego',      key:'npc_diego',      name:'Diego Reyes',        x:30, y:25 },
    { id:'lydia',      key:'npc_lydia',      name:'Lydia Chen',         x:30, y:15 },
    { id:'wells',      key:'npc_wells',      name:'Rep. Wells',         x:6,  y:15 },
    { id:'sofia',      key:'npc_sofia',      name:'Sofia Andersson',    x:6,  y:35 },
    { id:'romano',     key:'npc_romano',     name:'Chef Romano',        x:6,  y:25 },
    { id:'okafor',     key:'npc_okafor',     name:'Chief Okafor',       x:30, y:35 },
    { id:'yuki',       key:'npc_yuki',       name:'Yuki Tanaka',        x:17, y:5  },
  ];
  for (const n of defs) {
    const sprite = this.physics.add.sprite(n.x*T+T/2, n.y*T+T/2, n.key)
      .setDepth(5).setImmovable(true);
    sprite.body.setSize(28, 28);
    sprite.setData('id', n.id);
    sprite.setData('name', n.name);

    const label = this.add.text(n.x*T+T/2, n.y*T-8, n.name, {
      fontFamily: '"Playfair Display", serif', fontSize: '9px', color: '#c9a84c',
      stroke: '#0a0a0a', strokeThickness: 2
    }).setOrigin(0.5).setDepth(10);
    this.npcLabels[n.id] = label;

    this.tweens.add({
      targets: sprite, scaleY:{from:1,to:1.03},
      duration:2000, yoyo:true, repeat:-1, ease:'Sine.easeInOut'
    });
    this.npcs[n.id] = sprite;
  }

  // Add NPC-to-NPC colliders
  const npcList = Object.values(this.npcs);
  for (let i = 0; i < npcList.length; i++) {
    for (let j = i + 1; j < npcList.length; j++) {
      this.physics.add.collider(npcList[i], npcList[j]);
    }
  }
}
```

### _syncDayState() — Same as ManorScene
Syncs currentDay, isNight from server, updates overlay

---

## 4. RANDOMMANORSCENE.JS — Procedurally Generated Manor

### Dynamic Room Generation
```javascript
const world = window._generatedWorld;
// Build rooms from generated data
this.rooms = {};
for (const r of world.rooms) {
  this.rooms[r.id] = { name: r.name, x: r.x, y: r.y, w: r.w, h: r.h, floor: r.floor };
}

// Auto-generate doors between adjacent rooms
const rooms = world.rooms;
this.doors = [];
for (let i = 0; i < rooms.length; i++) {
  for (let j = i + 1; j < rooms.length; j++) {
    const a = rooms[i], b = rooms[j];
    // Horizontal neighbors (same row, adjacent columns)
    if (Math.abs(a.y - b.y) < 3) {
      if (a.x + a.w <= b.x && b.x - (a.x + a.w) <= 2) {
        const shared_y = Math.max(a.y, b.y) + 2;
        this.doors.push({ x: a.x + a.w - 1, y: shared_y, w: b.x - a.x - a.w + 2, h: 2 });
      }
      // ... similar for other horizontal case
    }
    // Vertical neighbors (same column, adjacent rows)
    if (Math.abs(a.x - b.x) < 3) {
      if (a.y + a.h <= b.y && b.y - (a.y + a.h) <= 2) {
        const shared_x = Math.max(a.x, b.x) + 2;
        this.doors.push({ x: shared_x, y: a.y + a.h - 1, w: 2, h: b.y - a.y - a.h + 2 });
      }
      // ... similar for other vertical case
    }
  }
}

// Compute dynamic map size
let maxX = 0, maxY = 0;
for (const r of world.rooms) {
  maxX = Math.max(maxX, r.x + r.w + 1);
  maxY = Math.max(maxY, r.y + r.h + 1);
}
this.MAP_W = Math.max(maxX + 1, 20);
this.MAP_H = Math.max(maxY + 1, 15);
```

### _buildFloors(T) Full Method
```javascript
_buildFloors(T) {
  for (const room of Object.values(this.rooms)) {
    const floorKey = this.textures.exists(room.floor) ? room.floor : 'tile_floor';
    for (let ry = 0; ry < room.h; ry++)
      for (let rx = 0; rx < room.w; rx++)
        this.add.image((room.x+rx)*T+T/2, (room.y+ry)*T+T/2, floorKey).setDepth(0);

    this.add.text((room.x+room.w/2)*T, (room.y+1)*T, room.name, {
      fontFamily: '"Playfair Display", serif', fontSize: '11px', color: '#c9a84c55'
    }).setOrigin(0.5).setDepth(1);
  }
  for (const d of this.doors)
    for (let dy=0; dy<d.h; dy++)
      for (let dx=0; dx<d.w; dx++)
        this.add.image((d.x+dx)*T+T/2, (d.y+dy)*T+T/2, 'tile_floor').setDepth(0);
}
```

### _buildWalls(T) — Same as other scenes
Creates grid from this.rooms and this.doors, renders walls on edges

### _placeNPCs(T, world) Full Method
```javascript
_placeNPCs(T, world) {
  for (const char of world.characters) {
    const room = this.rooms[char.location] || Object.values(this.rooms)[0];
    // Place inside room interior
    const nx = room.x + 2 + Math.floor(Math.random() * (room.w - 4));
    const ny = room.y + 2 + Math.floor(Math.random() * (room.h - 4));

    const texKey = 'npc_' + char.id;
    const spriteKey = this.textures.exists(texKey) ? texKey : 'npc_' + world.characters[0].id;
    const sprite = this.physics.add.sprite(nx*T+T/2, ny*T+T/2, spriteKey)
      .setDepth(5).setImmovable(true);
    sprite.body.setSize(28, 28);
    sprite.setData('id', char.id);
    sprite.setData('name', char.name);

    const label = this.add.text(nx*T+T/2, ny*T-8, char.name, {
      fontFamily: '"Playfair Display", serif', fontSize: '9px', color: '#c9a84c',
      stroke: '#0a0a0a', strokeThickness: 2
    }).setOrigin(0.5).setDepth(10);
    this.npcLabels[char.id] = label;

    this.tweens.add({
      targets: sprite, scaleY:{from:1,to:1.03},
      duration:2000, yoyo:true, repeat:-1, ease:'Sine.easeInOut'
    });
    this.npcs[char.id] = sprite;
  }

  // NPC-to-NPC colliders
  const npcList = Object.values(this.npcs);
  for (let i = 0; i < npcList.length; i++) {
    for (let j = i + 1; j < npcList.length; j++) {
      this.physics.add.collider(npcList[i], npcList[j]);
    }
  }
}
```

### _syncDayState() — Same as other scenes

---

## 5. API.JS — Full GameAPI Class

```javascript
export class GameAPI {
  constructor(baseUrl = '') {
    this.baseUrl = baseUrl;
  }

  // ── Talk to a character (SSE streaming) ────────────────────────
  async *talkTo(characterId, message) {
    const res = await fetch(`${this.baseUrl}/api/talk/${characterId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Talk request failed (${res.status}): ${err}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;

        const payload = trimmed.slice(5).trim();
        if (payload === '[DONE]') return;

        try {
          const parsed = JSON.parse(payload);
          yield parsed.text ?? parsed.content ?? payload;
        } catch {
          // plain-text chunk
          yield payload;
        }
      }
    }
  }

  // ── Forensic analysis (SSE streaming) ───────────────────────────
  async *analyzeEvidence(evidenceId) {
    const res = await fetch(`${this.baseUrl}/api/forensics/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ evidenceId }),
    });
    if (!res.ok) throw new Error(`Analysis failed (${res.status})`);
    
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === '[DONE]') return;
        try {
          const parsed = JSON.parse(payload);
          yield parsed.content ?? payload;
        } catch { yield payload; }
      }
    }
  }

  // ── Evidence ───────────────────────────────────────────────────
  async getEvidence() {
    const res = await fetch(`${this.baseUrl}/api/evidence`);
    if (!res.ok) throw new Error(`Failed to fetch evidence (${res.status})`);
    return res.json();
  }

  async collectEvidence(id) {
    const res = await fetch(`${this.baseUrl}/api/evidence/${id}/collect`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`Failed to collect evidence (${res.status})`);
    return res.json();
  }

  async showEvidence(evidenceId, characterId) {
    const res = await fetch(
      `${this.baseUrl}/api/evidence/${evidenceId}/show/${characterId}`,
      { method: 'POST' },
    );
    if (!res.ok) throw new Error(`Failed to show evidence (${res.status})`);
    return res.json();
  }

  // ── Game state ─────────────────────────────────────────────────
  async getState() {
    const res = await fetch(`${this.baseUrl}/api/state`);
    if (!res.ok) throw new Error(`Failed to fetch state (${res.status})`);
    return res.json();
  }

  // ── Accusation ─────────────────────────────────────────────────
  async accuse(suspectId, motive, evidenceIds) {
    const res = await fetch(`${this.baseUrl}/api/accuse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suspectId, motive, evidenceIds }),
    });
    if (!res.ok) throw new Error(`Accusation failed (${res.status})`);
    return res.json();
  }

  // ── Day/night cycle ────────────────────────────────────────────
  async getDay() {
    const res = await fetch(`${this.baseUrl}/api/day`);
    if (!res.ok) throw new Error(`Failed to fetch day (${res.status})`);
    return res.json();
  }

  async advanceDay() {
    const res = await fetch(`${this.baseUrl}/api/day/advance`, { method: 'POST' });
    if (!res.ok) throw new Error(`Failed to advance day (${res.status})`);
    return res.json();
  }

  async getEvidencePositions() {
    const res = await fetch(`${this.baseUrl}/api/evidence/positions`);
    if (!res.ok) throw new Error(`Failed to fetch positions (${res.status})`);
    return res.json();
  }

  // ── Reset ──────────────────────────────────────────────────────
  async reset() {
    const res = await fetch(`${this.baseUrl}/api/reset`, { method: 'POST' });
    if (!res.ok) throw new Error(`Reset failed (${res.status})`);
    return res.json();
  }

  // ── Narrator ────────────────────────────────────────────────
  async narrate(trigger, context = '') {
    const res = await fetch(`${this.baseUrl}/api/narrate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trigger, context }),
    });
    if (!res.ok) return { narration: '' };
    return res.json();
  }

  // ── Sentiment ─────────────────────────────────────────────────
  async getSentiment(characterId) {
    const res = await fetch(`${this.baseUrl}/api/sentiments/${characterId}`);
    if (!res.ok) throw new Error(`Failed to fetch sentiment (${res.status})`);
    return res.json();
  }

  // ── Detective profile ─────────────────────────────────────────
  async getProfile() {
    const res = await fetch(`${this.baseUrl}/api/profile`);
    if (!res.ok) throw new Error(`Failed to fetch profile (${res.status})`);
    return res.json();
  }

  // ── Level selection ─────────────────────────────────────────────
  async getLevels() {
    const res = await fetch(`${this.baseUrl}/api/levels`);
    if (!res.ok) throw new Error(`Failed to fetch levels (${res.status})`);
    return res.json();
  }

  async selectLevel(levelId) {
    const res = await fetch(`${this.baseUrl}/api/level/select`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ levelId }),
    });
    if (!res.ok) throw new Error(`Failed to select level (${res.status})`);
    return res.json();
  }

  async getLevel() {
    const res = await fetch(`${this.baseUrl}/api/level`);
    if (!res.ok) throw new Error(`Failed to fetch current level (${res.status})`);
    return res.json();
  }

  // ── Mystery generation ─────────────────────────────────────────
  async *generateMystery() {
    const res = await fetch(`${this.baseUrl}/api/mystery/generate`, { method: 'POST' });
    if (!res.ok) throw new Error(`Generation failed (${res.status})`);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === '[DONE]') return;
        try { yield JSON.parse(payload); } catch { yield { status: payload }; }
      }
    }
  }

  async getMystery() {
    const res = await fetch(`${this.baseUrl}/api/mystery`);
    if (!res.ok) throw new Error(`Failed (${res.status})`);
    return res.json();
  }

  async getCharacters() {
    const res = await fetch(`${this.baseUrl}/api/characters`);
    if (!res.ok) throw new Error(`Failed to fetch characters (${res.status})`);
    return res.json();
  }

  async getMysteryRooms() {
    const res = await fetch(`${this.baseUrl}/api/mystery/rooms`);
    if (!res.ok) throw new Error(`Failed (${res.status})`);
    return res.json();
  }
}
```

---

## 6. GAMESTATE.TS — Full Game State Structure

### Core Types
```typescript
export interface NPCSentiment {
  towardDetective: number;        // -10 (hostile) to +10 (cooperative)
  towardOthers: Record<string, number>;
  emotionalState: string;
  recentEmotions: string[];
}

export interface PlayerProfile {
  style: string;           // 'aggressive' | 'sympathetic' | 'methodical' | 'scattered' | 'unknown'
  confidence: number;      // 0-1
  traits: string[];
  questionCount: number;
  lastAnalysis: string;
}

export interface GameState {
  evidenceCollected: string[];
  evidenceShownTo: Record<string, string[]>;
  charactersInterrogated: string[];
  accusationsMade: number;
  gameWon: boolean;
  gameLost: boolean;
  currentDay: number;
  timeOfDay: 'day' | 'night';
  dayStartedAt: number;
  overnightEvents: string[];
  removedEvidence: string[];
  npcSentiments: Record<string, NPCSentiment>;
  playerProfile: PlayerProfile;
  reputation: {
    style: 'unknown' | 'aggressive' | 'sympathetic' | 'methodical' | 'deceptive';
    aggressiveCount: number;
    sympatheticCount: number;
    totalInteractions: number;
    gossipLog: string[];
  };
  eavesdropped: Record<string, string[]>;
  contradictions: { npc1: string; npc2: string; topic: string; detail: string }[];
  panicEvents: { type: string; description: string; day: number; affectedNPCs: string[] }[];
  alliances: { members: string[]; type: 'alliance' | 'rivalry'; reason: string }[];
  tamperedEvidence: string[];
}
```

### Evidence Definitions
```typescript
const EVIDENCE: Evidence[] = [
  {
    id: "brandy_glass",
    name: "Brandy Glass",
    description: "A crystal brandy glass found in the study",
    location: "study",
    detail: "A crystal brandy glass. It's been wiped, but you notice a faint residue and an unusual bitter smell.",
  },
  {
    id: "prescription_pad",
    name: "Prescription Pad",
    description: "Dr. Hartwell's prescription pad found in the library",
    location: "library",
    detail: "Dr. Hartwell's prescription pad. One page has been torn out recently — the torn edge is still fresh.",
  },
  {
    id: "foxglove_cuttings",
    name: "Foxglove Cuttings",
    description: "Freshly cut foxglove stems found in the garden",
    location: "garden",
    detail: "Several foxglove stems have been freshly cut. Foxglove is the source of digitalis — a heart medication that's deadly in high doses.",
  },
  {
    id: "edmunds_letter",
    name: "Edmund's Letter",
    description: "An unfinished letter found in the study",
    location: "study",
    detail: "An unfinished letter addressed to the Medical Board: 'I write to report Dr. James Hartwell for the forging of prescriptions. I have evidence that he has been—' The letter stops abruptly.",
  },
  {
    id: "love_letter",
    name: "Love Letter",
    description: "A folded letter found in the conservatory",
    location: "conservatory",
    detail: "A folded letter tucked between orchid care notes. 'My dearest R, I cannot bear another evening pretending. After tomorrow, we shall be free. Yours always, V.'",
  },
  {
    id: "business_documents",
    name: "Business Documents",
    description: "Partnership dissolution papers found in the study",
    location: "study",
    detail: "Partnership dissolution papers between Edmund Blackwood and Reginald Price. Partially signed. Notes in the margin read: 'Final — no negotiation.'",
  },
  {
    id: "agnes_diary",
    name: "Agnes's Diary",
    description: "Agnes's diary found in the kitchen",
    location: "kitchen",
    detail: "Today's entry reads: 'The brandy smelled off tonight when I checked the decanter. Probably nothing, but Lord Blackwood does prefer his usual brand. Dr. Hartwell was pacing about after half nine, most unlike him.'",
  },
  {
    id: "claras_manuscript",
    name: "Clara's Manuscript",
    description: "Pages of a novel manuscript found in the bedroom",
    location: "bedroom",
    detail: "Pages of a novel manuscript. Each page is dated and timed. Tonight's entries run continuously from 8:30 PM to 10:00 PM. The handwriting is consistent throughout.",
  },
];

const CORRECT_SUSPECT = "hartwell";
const KEY_EVIDENCE = ["brandy_glass", "prescription_pad", "edmunds_letter", "foxglove_cuttings"];
const MOTIVE_KEYWORDS = ["prescription", "blackmail", "forging", "forge", "forged"];

export const EVIDENCE_POSITIONS: Record<string, { x: number; y: number }> = {
  brandy_glass: { x: 5, y: 15 },
  prescription_pad: { x: 29, y: 15 },
  foxglove_cuttings: { x: 18, y: 25 },
  edmunds_letter: { x: 7, y: 16 },
  love_letter: { x: 6, y: 24 },
  business_documents: { x: 4, y: 17 },
  agnes_diary: { x: 5, y: 7 },
  claras_manuscript: { x: 31, y: 27 },
  burnt_note: { x: 18, y: 27 },
  muddy_footprints: { x: 6, y: 16 },
  digitalis_vial: { x: 19, y: 6 },
  victoria_telegram: { x: 28, y: 7 },
};
```

### GameStateManager Class - Constructor & Fresh State
```typescript
export class GameStateManager {
  private state: GameState;
  private nightConversations: NightConversation[] = [];
  private directorPlan: DirectorPlan | null = null;
  private _correctSuspect: string = CORRECT_SUSPECT;
  private _keyEvidence: string[] = KEY_EVIDENCE;
  private _motiveKeywords: string[] = MOTIVE_KEYWORDS;
  private _winMessage: string = "Brilliant deduction...";

  constructor() {
    this.state = this.createFreshState();
  }

  private createFreshState(): GameState {
    return {
      evidenceCollected: [],
      evidenceShownTo: {},
      charactersInterrogated: [],
      accusationsMade: 0,
      gameWon: false,
      gameLost: false,
      currentDay: 1,
      timeOfDay: 'day',
      dayStartedAt: Date.now(),
      overnightEvents: [],
      removedEvidence: [],
      npcSentiments: {
        victoria: { towardDetective: 2, towardOthers: { hartwell: 0, clara: 3, price: 8, agnes: 1 }, emotionalState: 'calm', recentEmotions: [] },
        hartwell: { towardDetective: 3, towardOthers: { victoria: 0, clara: -1, price: -2, agnes: -3 }, emotionalState: 'nervous', recentEmotions: [] },
        clara: { towardDetective: 4, towardOthers: { victoria: -2, hartwell: -3, price: -1, agnes: 5 }, emotionalState: 'angry', recentEmotions: [] },
        price: { towardDetective: 1, towardOthers: { victoria: 8, hartwell: 0, clara: 0, agnes: -1 }, emotionalState: 'calm', recentEmotions: [] },
        agnes: { towardDetective: 5, towardOthers: { victoria: 2, hartwell: -4, clara: 6, price: -1 }, emotionalState: 'calm', recentEmotions: [] },
      },
      playerProfile: {
        style: 'unknown',
        confidence: 0,
        traits: [],
        questionCount: 0,
        lastAnalysis: 'The detective has just arrived. Their approach is unknown.',
      },
      reputation: {
        style: 'unknown',
        aggressiveCount: 0,
        sympatheticCount: 0,
        totalInteractions: 0,
        gossipLog: [],
      },
      eavesdropped: {},
      contradictions: [],
      panicEvents: [],
      alliances: [],
      tamperedEvidence: [],
    };
  }
}
```

### Day Advancement & Evidence Management
```typescript
advanceToNight(): void {
  this.state.timeOfDay = 'night';
}

advanceToNextDay(): { dayConfig: DayConfig; removedEvidence: string[] } {
  const hasHardcodedDays = this.state.currentDay < DAY_CONFIGS.length;
  const hasDirectorPlan = this.directorPlan !== null;

  if (!hasHardcodedDays && !hasDirectorPlan) {
    return { dayConfig: this.getDayConfig(), removedEvidence: [] };
  }

  this.state.currentDay++;
  this.state.timeOfDay = 'day';
  this.state.dayStartedAt = Date.now();

  const actuallyRemoved: string[] = [];

  // Apply Director's plan if available
  if (this.directorPlan) {
    // Add Director's new evidence to the active pool
    for (const ev of this.directorPlan.newEvidence) {
      if (!EVIDENCE.find(e => e.id === ev.id)) {
        EVIDENCE.push(ev);
      }
    }

    // Remove Director-specified evidence
    for (const evId of this.directorPlan.removedEvidence) {
      if (!this.state.evidenceCollected.includes(evId) && !this.state.removedEvidence.includes(evId)) {
        this.state.removedEvidence.push(evId);
        actuallyRemoved.push(evId);
      }
    }

    // Move Director-specified evidence
    for (const moved of this.directorPlan.movedEvidence) {
      if (!this.state.evidenceCollected.includes(moved.id)) {
        const base = EVIDENCE.find(e => e.id === moved.id);
        if (base) base.location = moved.newLocation;
        EVIDENCE_POSITIONS[moved.id] = { x: moved.x, y: moved.y };
      }
    }

    // Use Director's narrative
    if (this.directorPlan.overnightNarrative) {
      this.state.overnightEvents.push(this.directorPlan.overnightNarrative);
    }
  }

  return { dayConfig: config, removedEvidence: actuallyRemoved };
}
```

### Accusation Logic
```typescript
makeAccusation(
  suspectId: string,
  motive: string,
  evidenceIds: string[]
): { correct: boolean; message: string } {
  if (this.state.gameWon) {
    return { correct: true, message: "You have already solved the case!" };
  }
  if (this.state.gameLost) {
    return {
      correct: false,
      message: "You have exhausted all your accusations. The case has gone cold.",
    };
  }

  this.state.accusationsMade++;

  const correctSuspect = suspectId.toLowerCase() === this._correctSuspect;
  const motiveLower = motive.toLowerCase();
  const correctMotive = this._motiveKeywords.some((kw) => motiveLower.includes(kw));
  const matchingEvidence = evidenceIds.filter((id) => this._keyEvidence.includes(id));
  const correctEvidence = matchingEvidence.length >= 2;

  if (correctSuspect && correctMotive && correctEvidence) {
    this.state.gameWon = true;
    return {
      correct: true,
      message: this._winMessage,
    };
  }

  const remaining = 3 - this.state.accusationsMade;
  if (remaining <= 0) {
    this.state.gameLost = true;
    return {
      correct: false,
      message: "Incorrect, and you have no accusations remaining. The killer walks free...",
    };
  }

  const hints: string[] = [];
  if (!correctSuspect) hints.push("You may be accusing the wrong person.");
  if (!correctMotive) hints.push("Consider what the killer stood to lose.");
  if (!correctEvidence) hints.push("Review the physical evidence more carefully...");

  return {
    correct: false,
    message: `Incorrect accusation. ${hints.join(" ")} You have ${remaining} accusation${remaining === 1 ? "" : "s"} remaining.`,
  };
}
```

### Reset Logic
```typescript
reset(): void {
  this.state = this.createFreshState();
  this.nightConversations = [];
  this.directorPlan = null;
  this._correctSuspect = CORRECT_SUSPECT;
  this._keyEvidence = KEY_EVIDENCE;
  this._motiveKeywords = MOTIVE_KEYWORDS;
  this._winMessage = "Brilliant deduction...";

  // Restore manor evidence (may have been overwritten by cruise/random)
  EVIDENCE.length = 0;
  EVIDENCE.push(...MANOR_EVIDENCE);
  for (const key of Object.keys(EVIDENCE_POSITIONS)) {
    delete EVIDENCE_POSITIONS[key];
  }
  Object.assign(EVIDENCE_POSITIONS, MANOR_EVIDENCE_POSITIONS);
}

loadLevelConfig(config: {
  evidence: Evidence[];
  evidencePositions: Record<string, { x: number; y: number }>;
  correctSuspect: string;
  keyEvidence: string[];
  motiveKeywords: string[];
  initialSentiments: Record<string, NPCSentiment>;
  winMessage: string;
}): void {
  // Override evidence
  EVIDENCE.length = 0;
  EVIDENCE.push(...config.evidence);

  // Override positions
  for (const key of Object.keys(EVIDENCE_POSITIONS)) {
    delete EVIDENCE_POSITIONS[key];
  }
  Object.assign(EVIDENCE_POSITIONS, config.evidencePositions);

  // Override accusation config
  this._correctSuspect = config.correctSuspect;
  this._keyEvidence = config.keyEvidence;
  this._motiveKeywords = config.motiveKeywords;
  this._winMessage = config.winMessage;

  // Override sentiments
  this.state.npcSentiments = config.initialSentiments;
}
```

---

## 7. CHARACTERS/TYPES.TS — CharacterDefinition Interface

```typescript
export interface CharacterDefinition {
  id: string;
  name: string;
  role: string;
  location: string;
  spriteKey: string;
  systemPrompt: string;
}
```

---

## 8. BOOTSCENE.JS — Sprite Generation

### _tex() Method (Graphics Texture Generator)
```javascript
_tex(key, w, h, fn) {
  const g = this.make.graphics({ add: false });
  fn(g, w, h);
  g.generateTexture(key, w, h);
  g.destroy();
}
```
- Creates temporary graphics object
- Calls `fn(graphics, width, height)` to draw on it
- Generates texture from the graphics
- Destroys temporary graphics

### _genNPCs() — NPC Sprite Generation
```javascript
_genNPCs() {
  const npcs = [
    { key:'npc_victoria', body:0x8B2252, hair:0xDAA520, accent:0x6b1a3f },
    { key:'npc_hartwell', body:0x2F4F4F, hair:0x696969, accent:0xffffff },
    { key:'npc_clara',    body:0x4a3280, hair:0x8B4513, accent:0xdda0dd },
    { key:'npc_price',    body:0x1a1a2e, hair:0x333333, accent:0xc9a84c },
    { key:'npc_agnes',    body:0x2d2d2d, hair:0xaaaaaa, accent:0xf5f5f5 },
  ];
  npcs.forEach(n => {
    this._tex(n.key, 32, 32, g => {
      const cx=16, cy=16;
      g.fillStyle(n.body);    g.fillRect(cx-6,cy-2,12,14);
      g.fillStyle(0xe8c99b);  g.fillRect(cx-5,cy-10,10,9);
      g.fillStyle(n.hair);    g.fillRect(cx-5,cy-13,10,5);
      g.fillStyle(0x222222);  g.fillRect(cx-3,cy-6,2,2); g.fillRect(cx+1,cy-6,2,2);
      g.fillStyle(n.accent);  g.fillRect(cx-1,cy-2,2,3);
      g.fillStyle(0x2a2a2a);  g.fillRect(cx-4,cy+12,3,4); g.fillRect(cx+1,cy+12,3,4);
    });
  });
}
```
- Each NPC is 32x32 pixels
- Body: colored rectangle at center
- Head: skin-colored rectangle
- Hair: colored rectangle at top
- Eyes: small black rectangles (differs per direction)
- Accent: colored badge/detail
- Legs: dark rectangles at bottom

### _genPlayer() — Player Animation Frames
```javascript
_genPlayer() {
  const S = 32;
  const dirNames = ['down','left','right','up'];

  for (let d = 0; d < 4; d++) {
    for (let f = 0; f < 3; f++) {
      const key = `player_${dirNames[d]}_${f}`;
      this._tex(key, S, S, (g) => {
        const cx = S/2, cy = S/2;
        const wb = f === 1 ? -1 : f === 2 ? 1 : 0;  // walk bob
        // Body: 0x5c4a32 (brown)
        // Head: 0xe8c99b (skin)
        // Hat: 0x3a2f24 (dark brown)
        // Eyes: 0x222222 (black) — only if not 'up' direction
        // Legs: 0x2a2a2a, Shoes: 0x1a1a1a
      });
    }
  }

  // Create walk and idle animations for each direction
  const fr = 8;  // frame rate
  for (let d = 0; d < 4; d++) {
    const dir = dirNames[d];
    this.anims.create({
      key: `walk-${dir}`,
      frames: [
        { key: `player_${dir}_0` },
        { key: `player_${dir}_1` },
        { key: `player_${dir}_0` },
        { key: `player_${dir}_2` },
      ],
      frameRate: fr, repeat: -1
    });
    this.anims.create({
      key: `idle-${dir}`,
      frames: [{ key: `player_${dir}_0` }],
      frameRate: 1, repeat: -1
    });
  }
}
```
- 3 frames per direction (32x32 each)
- Frame 0: neutral
- Frame 1: left leg forward, bob -1
- Frame 2: right leg forward, bob +1
- Creates walk animation (alternates 0-1-0-2)
- Creates idle animation (single frame repeat)

### _genEvidence() — Evidence Item Sprites
```javascript
_genEvidence() {
  const items = {
    brandy_glass: (g,cx,cy) => {
      g.fillStyle(0xc9a84c); g.fillRect(cx-3,cy-6,6,8);
      g.fillStyle(0x8B4513); g.fillRect(cx-2,cy-4,4,4);
      g.fillStyle(0xc9a84c); g.fillRect(cx-1,cy+2,2,4); g.fillRect(cx-3,cy+5,6,2);
    },
    prescription_pad: (g,cx,cy) => {
      g.fillStyle(0xf5f5dc); g.fillRect(cx-5,cy-6,10,12);
      g.fillStyle(0x333333); g.fillRect(cx-3,cy-4,6,1); g.fillRect(cx-3,cy-2,4,1);
      g.fillStyle(0xcc3333); g.fillRect(cx+2,cy-6,3,3);
    },
    // ... more items ...
  };
  for (const [key, draw] of Object.entries(items)) {
    this._tex('ev_'+key, 16, 16, g => draw(g, 8, 8));
  }
  this._tex('ev_glow', 24, 24, g => {
    g.fillStyle(0xc9a84c, 0.3);
    g.fillCircle(12, 12, 10);
  });
}
```
- Each evidence item is 16x16 pixels
- Custom draw function provided for each item type
- Glow effect: 24x24 semi-transparent golden circle (reused for all evidence)

___BEGIN___COMMAND_DONE_MARKER___0
