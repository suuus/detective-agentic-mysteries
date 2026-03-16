export interface NPCSentiment {
  towardDetective: number;        // -10 (hostile) to +10 (cooperative)
  towardOthers: Record<string, number>;  // characterId -> -10 to +10
  emotionalState: string;         // calm, nervous, angry, scared, defensive, cooperative, hostile, desperate
  recentEmotions: string[];       // last 3-5 emotional shifts (e.g. "became defensive when shown brandy glass")
}

export interface PlayerProfile {
  style: string;           // 'aggressive' | 'sympathetic' | 'methodical' | 'scattered' | 'unknown'
  confidence: number;      // 0-1, how confident we are in the assessment
  traits: string[];        // e.g. ['confrontational', 'evidence-focused', 'builds rapport']
  questionCount: number;   // total questions asked
  lastAnalysis: string;    // prose description for NPCs
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
  // New: reputation system — NPCs track and gossip about detective's style
  reputation: {
    style: 'unknown' | 'aggressive' | 'sympathetic' | 'methodical' | 'deceptive';
    aggressiveCount: number;
    sympatheticCount: number;
    totalInteractions: number;
    gossipLog: string[];  // what NPCs have told each other about the detective
  };
  // New: eavesdropping — NPCs near interrogations overhear things
  eavesdropped: Record<string, string[]>;  // characterId -> overheard summary strings
  // New: contradiction log — AI-detected inconsistencies between NPC statements
  contradictions: { npc1: string; npc2: string; topic: string; detail: string }[];
  // New: panic events triggered during gameplay
  panicEvents: { type: string; description: string; day: number; affectedNPCs: string[] }[];
  // New: alliances detected/created by Director
  alliances: { members: string[]; type: 'alliance' | 'rivalry'; reason: string }[];
  // New: tampered evidence
  tamperedEvidence: string[];
  // Notebook clues — auto-populated from NPC reveals and key events
  notebookClues: { source: string; text: string; day: number }[];
}

export interface Evidence {
  id: string;
  name: string;
  description: string;
  location: string;
  detail: string;
}

export interface NPCSchedule {
  id: string;
  name: string;
  location: string;
  x: number;
  y: number;
}

export interface DayConfig {
  npcPositions: NPCSchedule[];
  newEvidence: Evidence[];
  movedEvidence: { id: string; newLocation: string; x: number; y: number }[];
  removedEvidence: string[];
  overnightNarrative: string;
  npcNightContext: Record<string, string>;
}

export interface NightExchange {
  speaker: string;      // character id
  speakerName: string;
  text: string;
}

export interface NightConversation {
  participants: string[];    // character ids
  participantNames: string[];
  location: string;          // where they met
  exchanges: NightExchange[];
}

export interface NightConversationPair {
  ids: [string, string];
  location: string;
  scenario: string;   // context prompt for the encounter
}

export interface DirectorPlan {
  conversations: NightConversationPair[];
  npcPositions: NPCSchedule[];
  newEvidence: Evidence[];
  removedEvidence: string[];
  movedEvidence: { id: string; newLocation: string; x: number; y: number }[];
  overnightNarrative: string;
  npcNightContext?: Record<string, string>;
}

const EVIDENCE: Evidence[] = [
  {
    id: "brandy_glass",
    name: "Brandy Glass",
    description: "A crystal brandy glass found in the study",
    location: "study",
    detail:
      "A crystal brandy glass. It's been wiped, but you notice a faint residue and an unusual bitter smell.",
  },
  {
    id: "prescription_pad",
    name: "Prescription Pad",
    description: "Dr. Hartwell's prescription pad found in the library",
    location: "library",
    detail:
      "Dr. Hartwell's prescription pad. One page has been torn out recently — the torn edge is still fresh.",
  },
  {
    id: "foxglove_cuttings",
    name: "Foxglove Cuttings",
    description: "Freshly cut foxglove stems found in the garden",
    location: "garden",
    detail:
      "Several foxglove stems have been freshly cut. Foxglove is the source of digitalis — a heart medication that's deadly in high doses.",
  },
  {
    id: "edmunds_letter",
    name: "Edmund's Letter",
    description: "An unfinished letter found in the study",
    location: "study",
    detail:
      "An unfinished letter addressed to the Medical Board: 'I write to report Dr. James Hartwell for the forging of prescriptions. I have evidence that he has been—' The letter stops abruptly.",
  },
  {
    id: "love_letter",
    name: "Love Letter",
    description: "A folded letter found in the conservatory",
    location: "conservatory",
    detail:
      "A folded letter tucked between orchid care notes. 'My dearest R, I cannot bear another evening pretending. After tomorrow, we shall be free. Yours always, V.'",
  },
  {
    id: "business_documents",
    name: "Business Documents",
    description: "Partnership dissolution papers found in the study",
    location: "study",
    detail:
      "Partnership dissolution papers between Edmund Blackwood and Reginald Price. Partially signed. Notes in the margin read: 'Final — no negotiation.'",
  },
  {
    id: "agnes_diary",
    name: "Agnes's Diary",
    description: "Agnes's diary found in the kitchen",
    location: "kitchen",
    detail:
      "Today's entry reads: 'The brandy smelled off tonight when I checked the decanter. Probably nothing, but Lord Blackwood does prefer his usual brand. Dr. Hartwell was pacing about after half nine, most unlike him.'",
  },
  {
    id: "claras_manuscript",
    name: "Clara's Manuscript",
    description: "Pages of a novel manuscript found in the bedroom",
    location: "bedroom",
    detail:
      "Pages of a novel manuscript. Each page is dated and timed. Tonight's entries run continuously from 8:30 PM to 10:00 PM. The handwriting is consistent throughout.",
  },
];

const CORRECT_SUSPECT = "hartwell";
const KEY_EVIDENCE = [
  "brandy_glass",
  "prescription_pad",
  "edmunds_letter",
  "foxglove_cuttings",
];
const MOTIVE_KEYWORDS = [
  "prescription",
  "blackmail",
  "forging",
  "forge",
  "forged",
];

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

// Preserve originals so reset() can restore after cruise/random overwrites them
const MANOR_EVIDENCE: Evidence[] = [...EVIDENCE];
const MANOR_EVIDENCE_POSITIONS: Record<string, { x: number; y: number }> = { ...EVIDENCE_POSITIONS };

// Night conversation pairs — who meets whom, and the scenario prompt
const NIGHT_CONVERSATION_PAIRS: NightConversationPair[][] = [
  // Night 1 (after day 1)
  [
    {
      ids: ["victoria", "price"],
      location: "the garden, under the moonlight",
      scenario: "You've slipped away to meet in the garden late at night. You need to discuss the murder, whether the detective suspects your affair, and what to do next. You're both nervous."
    },
    {
      ids: ["agnes", "hartwell"],
      location: "the hallway outside the kitchen",
      scenario: "Agnes spotted Hartwell pacing nervously and confronted him. She's suspicious of his behavior since the murder. Hartwell needs to deflect without revealing his guilt."
    },
  ],
  // Night 2 (after day 2)
  [
    {
      ids: ["clara", "agnes"],
      location: "the kitchen, over late-night tea",
      scenario: "Clara has come to Agnes with her growing suspicions about Dr. Hartwell. She overheard him and her father arguing about prescriptions. Agnes has noticed the brandy smelled off and saw Hartwell pacing. They're piecing things together."
    },
    {
      ids: ["victoria", "price"],
      location: "the hallway, whispering urgently",
      scenario: "Victoria and Price are panicking about the investigation. Victoria saw the detective finding evidence. They need to coordinate their stories about the evening, especially their alibis. Price mentions a telegram he sent about a divorce lawyer."
    },
  ],
];

const DAY_CONFIGS: DayConfig[] = [
  // Day 1 — initial state
  {
    npcPositions: [
      { id: "victoria", name: "Victoria", location: "conservatory", x: 6, y: 25 },
      { id: "hartwell", name: "Hartwell", location: "library", x: 30, y: 16 },
      { id: "clara", name: "Clara", location: "bedroom", x: 30, y: 26 },
      { id: "price", name: "Price", location: "dining_room", x: 30, y: 4 },
      { id: "agnes", name: "Agnes", location: "kitchen", x: 6, y: 5 },
    ],
    newEvidence: [],
    movedEvidence: [],
    removedEvidence: [],
    overnightNarrative: "",
    npcNightContext: {},
  },
  // Day 2
  {
    npcPositions: [
      { id: "victoria", name: "Victoria", location: "garden", x: 16, y: 24 },
      { id: "hartwell", name: "Hartwell", location: "study", x: 5, y: 16 },
      { id: "clara", name: "Clara", location: "foyer", x: 17, y: 7 },
      { id: "price", name: "Price", location: "main_hall", x: 18, y: 15 },
      { id: "agnes", name: "Agnes", location: "conservatory", x: 5, y: 24 },
    ],
    newEvidence: [
      {
        id: "burnt_note",
        name: "Burnt Note",
        description: "A partially burnt note found in the garden fire pit",
        location: "garden",
        detail: "A partially burnt note in the garden fire pit. Fragments read: '...cannot let anyone know about the prescr...' and '...must be destroyed before the detective...'",
      },
      {
        id: "muddy_footprints",
        name: "Muddy Footprints",
        description: "Fresh muddy footprints found in the study",
        location: "study",
        detail: "Fresh muddy footprints leading from the hallway to the brandy cabinet. Someone returned to the study during the night.",
      },
    ],
    movedEvidence: [
      { id: "foxglove_cuttings", newLocation: "study", x: 7, y: 15 },
    ],
    removedEvidence: [],
    overnightNarrative: "The night was restless. Arguing voices echoed from the garden around midnight. Agnes was seen cleaning the study before dawn. Dr. Hartwell was spotted near the garden fire pit, burning something.",
    npcNightContext: {
      victoria: "Last night you met Price in the garden again. You argued about whether to tell the detective about your affair. You decided to keep quiet for now. You noticed Hartwell near the fire pit around 1 AM — he was burning papers.",
      hartwell: "Last night you panicked. You went to the garden fire pit and burned some notes about your prescription scheme. You also went back to the study to check if you left any traces — you tracked mud from the garden. You're more nervous today.",
      clara: "Last night you couldn't sleep. You went to your father's study and found the unfinished letter (if not yet collected by detective). You're starting to suspect Dr. Hartwell. You've moved to the foyer to watch who comes and goes.",
      price: "Last night you met Victoria in the garden. She told you she saw Hartwell near the fire pit burning papers. You're worried about the detective finding out about your affair and the business dispute.",
      agnes: "Last night you heard someone in the study around 2 AM. You found muddy footprints this morning. You suspect Dr. Hartwell. You're keeping a closer eye on everyone today.",
    },
  },
  // Day 3
  {
    npcPositions: [
      { id: "victoria", name: "Victoria", location: "bedroom", x: 29, y: 26 },
      { id: "hartwell", name: "Hartwell", location: "garden", x: 16, y: 23 },
      { id: "clara", name: "Clara", location: "kitchen", x: 4, y: 8 },
      { id: "price", name: "Price", location: "library", x: 29, y: 15 },
      { id: "agnes", name: "Agnes", location: "main_hall", x: 16, y: 16 },
    ],
    newEvidence: [
      {
        id: "digitalis_vial",
        name: "Digitalis Vial",
        description: "A small glass vial found behind the coat rack in the foyer",
        location: "foyer",
        detail: "A small glass vial fallen behind the coat rack. The label reads 'Digitalis tincture — 2mg/mL'. It is nearly empty. It matches the pharmaceutical supplies Dr. Hartwell would carry.",
      },
      {
        id: "victoria_telegram",
        name: "Victoria's Telegram",
        description: "A telegram addressed to Victoria found in the dining room",
        location: "dining_room",
        detail: "A telegram on the sideboard addressed to Victoria: 'Divorce lawyer retained. Papers prepared and ready for signing Monday. — R.P.' So Price was helping Victoria plan a divorce.",
      },
    ],
    movedEvidence: [],
    removedEvidence: ["prescription_pad"],
    overnightNarrative: "A scream pierced the night at 3 AM — Clara discovered something disturbing in her father's desk. Hushed voices were heard in the hallway; Price and Victoria, heads close together. Dr. Hartwell attempted to leave the manor at dawn but Agnes blocked the door, insisting no one should leave before the investigation concludes.",
    npcNightContext: {
      victoria: "Last night you and Price finalized plans. You're scared now — not of being caught for the murder, but of the affair being exposed. You've retreated to your bedroom. You received a telegram from Price's lawyer about your divorce papers.",
      hartwell: "You tried to leave the manor at dawn. Agnes stopped you. You're desperate. You hid your prescription pad overnight. You're pacing the garden trying to think of an escape. If confronted with enough evidence, you're closer to breaking.",
      clara: "Last night you found more of your father's private papers. You now strongly suspect Hartwell. You went to the kitchen to confide in Agnes. You're angry and emotional today.",
      price: "You helped Victoria plan their alibi story. You're worried about the telegram you sent about the divorce lawyer — you left it on the dining room sideboard. You're in the library looking for any other incriminating documents about the business.",
      agnes: "You stopped Dr. Hartwell from leaving at dawn. You're now certain he's hiding something. You've positioned yourself in the main hall to watch everyone. You're ready to talk more openly to the detective.",
    },
  },
];

export class GameStateManager {
  private state: GameState;
  private nightConversations: NightConversation[] = [];
  private directorPlan: DirectorPlan | null = null;
  private _correctSuspect: string = CORRECT_SUSPECT;
  private _keyEvidence: string[] = KEY_EVIDENCE;
  private _motiveKeywords: string[] = MOTIVE_KEYWORDS;
  private _winMessage: string = "Brilliant deduction, Detective! Dr. James Hartwell poisoned Lord Edmund Blackwood's brandy with a lethal dose of digitalis, extracted from foxglove, to prevent Edmund from reporting his prescription forgery to the Medical Board. Case closed!";
  _activeLevel: string = 'manor';

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
      notebookClues: [],
    };
  }

  getState(): GameState {
    return { ...this.state };
  }

  collectEvidence(id: string): boolean {
    const evidence = this.getActiveEvidence().find((e) => e.id === id);
    if (!evidence) return false;
    if (this.state.evidenceCollected.includes(id)) return false;
    this.state.evidenceCollected.push(id);
    return true;
  }

  showEvidence(characterId: string, evidenceId: string): boolean {
    if (!this.state.evidenceCollected.includes(evidenceId)) return false;
    if (!this.state.evidenceShownTo[characterId]) {
      this.state.evidenceShownTo[characterId] = [];
    }
    if (!this.state.evidenceShownTo[characterId].includes(evidenceId)) {
      this.state.evidenceShownTo[characterId].push(evidenceId);
    }
    return true;
  }

  hasEvidence(id: string): boolean {
    return this.state.evidenceCollected.includes(id);
  }

  getEvidence(id: string): Evidence | undefined {
    return this.getActiveEvidence().find((e) => e.id === id)
      ?? EVIDENCE.find((e) => e.id === id);
  }

  getAllEvidence(): Evidence[] {
    return this.getActiveEvidence();
  }

  getCollectedEvidence(): Evidence[] {
    return this.getActiveEvidence().filter((e) =>
      this.state.evidenceCollected.includes(e.id)
    );
  }

  getCurrentDay(): number {
    return this.state.currentDay;
  }

  getTimeOfDay(): 'day' | 'night' {
    return this.state.timeOfDay;
  }

  getDayConfig(): DayConfig {
    // For non-manor levels, don't use hardcoded DAY_CONFIGS
    if (this._activeLevel && this._activeLevel !== 'manor') {
      if (this.directorPlan && this.directorPlan.npcPositions.length > 0) {
        return {
          npcPositions: this.directorPlan.npcPositions,
          newEvidence: this.directorPlan.newEvidence || [],
          movedEvidence: this.directorPlan.movedEvidence || [],
          removedEvidence: this.directorPlan.removedEvidence || [],
          overnightNarrative: this.directorPlan.overnightNarrative || '',
          npcNightContext: this.directorPlan.npcNightContext || {},
        };
      }
      // No Director plan yet — return empty config (NPCs stay in place)
      return {
        npcPositions: [],
        newEvidence: [],
        movedEvidence: [],
        removedEvidence: [],
        overnightNarrative: '',
        npcNightContext: {},
      };
    }

    const idx = Math.min(this.state.currentDay, DAY_CONFIGS.length) - 1;
    const base = DAY_CONFIGS[idx];

    // If Director has planned NPC positions, use those instead
    if (this.directorPlan && this.directorPlan.npcPositions.length > 0) {
      return {
        ...base,
        npcPositions: this.directorPlan.npcPositions,
        overnightNarrative: this.directorPlan.overnightNarrative || base.overnightNarrative,
      };
    }

    return base;
  }

  advanceToNight(): void {
    this.state.timeOfDay = 'night';
  }

  advanceToNextDay(): { dayConfig: DayConfig; removedEvidence: string[] } {
    const isManor = !this._activeLevel || this._activeLevel === 'manor';
    const hasHardcodedDays = isManor && this.state.currentDay < DAY_CONFIGS.length;
    const hasDirectorPlan = this.directorPlan !== null;

    // Allow advancing beyond hardcoded configs when the Director is driving
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

    // Also apply hardcoded day config if available (Director plan takes priority for overlaps)
    const config = this.getDayConfig();
    if (hasHardcodedDays && !hasDirectorPlan) {
      for (const evidenceId of config.removedEvidence) {
        if (!this.state.evidenceCollected.includes(evidenceId) && !this.state.removedEvidence.includes(evidenceId)) {
          this.state.removedEvidence.push(evidenceId);
          actuallyRemoved.push(evidenceId);
        }
      }

      for (const moved of config.movedEvidence) {
        if (!this.state.evidenceCollected.includes(moved.id)) {
          const base = EVIDENCE.find((e) => e.id === moved.id);
          if (base) base.location = moved.newLocation;
          EVIDENCE_POSITIONS[moved.id] = { x: moved.x, y: moved.y };
        }
      }

      if (config.overnightNarrative && !this.directorPlan?.overnightNarrative) {
        this.state.overnightEvents.push(config.overnightNarrative);
      }
    }

    return { dayConfig: config, removedEvidence: actuallyRemoved };
  }

  getNPCNightContext(characterId: string): string {
    const config = this.getDayConfig();
    return config.npcNightContext[characterId] || "";
  }

  getNightConversationPairs(): NightConversationPair[] {
    // Prefer Director's dynamic plan
    if (this.directorPlan && this.directorPlan.conversations.length > 0) {
      return this.directorPlan.conversations;
    }
    // Fallback to hardcoded pairs
    const nightIdx = this.state.currentDay - 1; // night after day 1 = index 0
    if (nightIdx < 0 || nightIdx >= NIGHT_CONVERSATION_PAIRS.length) return [];
    return NIGHT_CONVERSATION_PAIRS[nightIdx];
  }

  getInvestigationSummary(): string {
    const interrogated = this.state.charactersInterrogated;
    const evidenceFound = this.state.evidenceCollected;
    const shown = this.state.evidenceShownTo;
    const parts: string[] = [];
    if (interrogated.length > 0)
      parts.push(`The detective has interrogated: ${interrogated.join(", ")}.`);
    if (evidenceFound.length > 0) {
      const names = evidenceFound.map(id => {
        const ev = this.getEvidence(id);
        return ev ? ev.name : id;
      });
      parts.push(`Evidence collected: ${names.join(", ")}.`);
    }
    for (const [charId, evIds] of Object.entries(shown)) {
      if (evIds.length > 0) {
        const names = evIds.map(id => {
          const ev = this.getEvidence(id);
          return ev ? ev.name : id;
        });
        parts.push(`The detective showed ${charId}: ${names.join(", ")}.`);
      }
    }
    return parts.length > 0 ? parts.join(" ") : "The detective hasn't done much investigating yet.";
  }

  storeNightConversations(conversations: NightConversation[]): void {
    this.nightConversations = conversations;
  }

  getLastNightConversations(): NightConversation[] {
    return this.nightConversations;
  }

  getActiveEvidence(): Evidence[] {
    const day = this.state.currentDay;
    // Start with base evidence
    const all: Evidence[] = [...EVIDENCE];

    // Add new evidence from days up to current
    for (let d = 0; d < day && d < DAY_CONFIGS.length; d++) {
      for (const ev of DAY_CONFIGS[d].newEvidence) {
        if (!all.find((e) => e.id === ev.id)) {
          all.push(ev);
        }
      }
    }

    // Filter out removed and collected evidence is NOT filtered (collected is still "active", just picked up)
    return all.filter((e) => !this.state.removedEvidence.includes(e.id));
  }

  getEvidencePositions(): { id: string; x: number; y: number }[] {
    const active = this.getActiveEvidence();
    const positions: { id: string; x: number; y: number }[] = [];

    for (const ev of active) {
      if (this.state.evidenceCollected.includes(ev.id)) continue;
      const pos = EVIDENCE_POSITIONS[ev.id];
      if (pos) {
        positions.push({ id: ev.id, x: pos.x, y: pos.y });
      }
    }

    return positions;
  }

  addDynamicEvidence(evidence: Evidence, position?: { x: number; y: number }): void {
    if (!EVIDENCE.find(e => e.id === evidence.id)) {
      EVIDENCE.push(evidence);
    }
    if (position) {
      EVIDENCE_POSITIONS[evidence.id] = position;
    } else {
      // Auto-calculate position from room bounds
      const roomBounds: Record<string, {x:[number,number],y:[number,number]}> = {
        study: {x:[3,8],y:[14,17]}, library: {x:[27,32],y:[14,17]}, kitchen: {x:[3,8],y:[3,8]},
        dining_room: {x:[27,32],y:[3,8]}, conservatory: {x:[3,8],y:[23,28]}, bedroom: {x:[27,32],y:[23,28]},
        garden: {x:[14,21],y:[23,28]}, foyer: {x:[14,21],y:[3,8]}, main_hall: {x:[14,21],y:[14,17]},
      };
      const bounds = roomBounds[evidence.location];
      if (bounds) {
        const x = bounds.x[0] + Math.floor(Math.random() * (bounds.x[1] - bounds.x[0]));
        const y = bounds.y[0] + Math.floor(Math.random() * (bounds.y[1] - bounds.y[0]));
        EVIDENCE_POSITIONS[evidence.id] = { x, y };
      }
    }
  }

  markInterrogated(characterId: string): void {
    if (!this.state.charactersInterrogated.includes(characterId)) {
      this.state.charactersInterrogated.push(characterId);
    }
  }

  // ── Reputation System ────────────────────────────────────────
  updateReputation(tone: 'aggressive' | 'sympathetic' | 'neutral'): void {
    const rep = this.state.reputation;
    rep.totalInteractions++;
    if (tone === 'aggressive') rep.aggressiveCount++;
    if (tone === 'sympathetic') rep.sympatheticCount++;

    // Determine dominant style
    const ratio = rep.totalInteractions > 0
      ? (rep.aggressiveCount - rep.sympatheticCount) / rep.totalInteractions : 0;
    if (rep.totalInteractions < 3) rep.style = 'unknown';
    else if (ratio > 0.3) rep.style = 'aggressive';
    else if (ratio < -0.3) rep.style = 'sympathetic';
    else rep.style = 'methodical';
  }

  getReputation(): typeof this.state.reputation {
    return this.state.reputation;
  }

  addGossip(gossip: string): void {
    this.state.reputation.gossipLog.push(gossip);
    if (this.state.reputation.gossipLog.length > 20) {
      this.state.reputation.gossipLog = this.state.reputation.gossipLog.slice(-15);
    }
  }

  // ── Eavesdropping System ──────────────────────────────────────
  addEavesdrop(listenerId: string, summary: string): void {
    if (!this.state.eavesdropped[listenerId]) {
      this.state.eavesdropped[listenerId] = [];
    }
    this.state.eavesdropped[listenerId].push(summary);
  }

  getEavesdroppedInfo(characterId: string): string[] {
    return this.state.eavesdropped[characterId] || [];
  }

  // ── Contradiction Detector ────────────────────────────────────
  addContradiction(npc1: string, npc2: string, topic: string, detail: string): void {
    // Don't add duplicates
    if (!this.state.contradictions.find(c => c.npc1 === npc1 && c.npc2 === npc2 && c.topic === topic)) {
      this.state.contradictions.push({ npc1, npc2, topic, detail });
    }
  }

  getContradictions(): typeof this.state.contradictions {
    return this.state.contradictions;
  }

  // ── Notebook Clues ─────────────────────────────────────────────
  addNotebookClue(source: string, text: string): void {
    if (!this.state.notebookClues.find(c => c.source === source && c.text === text)) {
      this.state.notebookClues.push({ source, text, day: this.state.currentDay });
    }
  }

  getNotebookClues(): typeof this.state.notebookClues {
    return this.state.notebookClues;
  }

  // ── Panic Events ──────────────────────────────────────────────
  addPanicEvent(type: string, description: string, affectedNPCs: string[]): void {
    this.state.panicEvents.push({
      type, description, day: this.state.currentDay, affectedNPCs,
    });
  }

  getPanicEvents(): typeof this.state.panicEvents {
    return this.state.panicEvents;
  }

  getRecentPanicEvents(): typeof this.state.panicEvents {
    return this.state.panicEvents.filter(e => e.day === this.state.currentDay);
  }

  // ── Alliance System ───────────────────────────────────────────
  addAlliance(members: string[], type: 'alliance' | 'rivalry', reason: string): void {
    if (!this.state.alliances.find(a => a.members.sort().join() === members.sort().join())) {
      this.state.alliances.push({ members, type, reason });
    }
  }

  getAlliances(): typeof this.state.alliances {
    return this.state.alliances;
  }

  // ── Evidence Tampering ────────────────────────────────────────
  tamperEvidence(evidenceId: string): boolean {
    if (this.state.evidenceCollected.includes(evidenceId)) return false;
    if (this.state.tamperedEvidence.includes(evidenceId)) return false;
    this.state.tamperedEvidence.push(evidenceId);
    this.state.removedEvidence.push(evidenceId);
    return true;
  }

  getTamperedEvidence(): string[] {
    return this.state.tamperedEvidence;
  }

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
        message:
          "You have exhausted all your accusations. The case has gone cold.",
      };
    }

    this.state.accusationsMade++;

    const correctSuspect =
      suspectId.toLowerCase() === this._correctSuspect;
    const motiveLower = motive.toLowerCase();
    const correctMotive = this._motiveKeywords.some((kw) =>
      motiveLower.includes(kw)
    );
    const matchingEvidence = evidenceIds.filter((id) =>
      this._keyEvidence.includes(id)
    );
    const hasAnyEvidence = evidenceIds.length >= 2;
    const correctEvidence = matchingEvidence.length >= 2;

    // Win condition: right suspect is mandatory.
    // Evidence and motive are checked more leniently:
    // - Perfect: right suspect + right motive + 2+ key evidence
    // - Good enough: right suspect + (right motive OR 2+ key evidence) + at least 2 evidence selected
    // - Generous for random levels: right suspect + any 3 evidence
    const perfectCase = correctSuspect && correctMotive && correctEvidence;
    const strongCase = correctSuspect && (correctMotive || correctEvidence) && hasAnyEvidence;
    const randomLevelCase = correctSuspect && this._activeLevel === 'random' && evidenceIds.length >= 3;

    if (perfectCase || strongCase || randomLevelCase) {
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
        message:
          "Incorrect, and you have no accusations remaining. The killer walks free. The case grows cold…",
      };
    }

    const hints: string[] = [];
    if (!correctSuspect) hints.push("You may be accusing the wrong person.");
    else {
      // They got the suspect right but not enough supporting evidence
      if (!correctMotive && !correctEvidence)
        hints.push("You have the right suspect but need stronger evidence and a clearer motive.");
      else if (!correctMotive)
        hints.push("Your suspect is right, but consider WHY they did it — what did they stand to lose?");
      else if (!correctEvidence)
        hints.push("Your suspect and motive are on track. Select more evidence that directly connects them to the crime.");
    }

    return {
      correct: false,
      message: `Incorrect accusation. ${hints.join(" ")} You have ${remaining} accusation${remaining === 1 ? "" : "s"} remaining.`,
    };
  }

  setDirectorPlan(plan: DirectorPlan): void {
    this.directorPlan = plan;
  }

  getDirectorPlan(): DirectorPlan | null {
    return this.directorPlan;
  }

  clearDirectorPlan(): void {
    this.directorPlan = null;
  }

  registerEvidencePosition(id: string, x: number, y: number): void {
    EVIDENCE_POSITIONS[id] = { x, y };
  }

  getSentiment(characterId: string): NPCSentiment | undefined {
    return this.state.npcSentiments[characterId];
  }

  getAllSentiments(): Record<string, NPCSentiment> {
    return { ...this.state.npcSentiments };
  }

  updateSentiment(characterId: string, updates: {
    towardDetective?: number;
    towardOther?: { id: string; delta: number };
    emotionalState?: string;
    emotionNote?: string;
  }): void {
    const s = this.state.npcSentiments[characterId];
    if (!s) return;

    if (updates.towardDetective !== undefined) {
      s.towardDetective = Math.max(-10, Math.min(10, s.towardDetective + updates.towardDetective));
    }
    if (updates.towardOther) {
      const current = s.towardOthers[updates.towardOther.id] ?? 0;
      s.towardOthers[updates.towardOther.id] = Math.max(-10, Math.min(10, current + updates.towardOther.delta));
    }
    if (updates.emotionalState) {
      s.emotionalState = updates.emotionalState;
    }
    if (updates.emotionNote) {
      s.recentEmotions.push(updates.emotionNote);
      if (s.recentEmotions.length > 5) s.recentEmotions.shift();
    }
  }

  getSentimentDescription(characterId: string): string {
    const s = this.state.npcSentiments[characterId];
    if (!s) return '';

    const detectiveLabel = s.towardDetective >= 5 ? 'very cooperative' :
      s.towardDetective >= 2 ? 'somewhat cooperative' :
      s.towardDetective >= -2 ? 'neutral' :
      s.towardDetective >= -5 ? 'guarded and evasive' :
      'hostile and uncooperative';

    const others = Object.entries(s.towardOthers).map(([id, val]) => {
      const label = val >= 5 ? 'trusting' : val >= 2 ? 'friendly' : val >= -2 ? 'neutral' : val >= -5 ? 'suspicious' : 'hostile';
      return `${id}: ${label} (${val})`;
    }).join(', ');

    const emotions = s.recentEmotions.length > 0
      ? `Recent emotional shifts: ${s.recentEmotions.join('; ')}`
      : '';

    return `Current emotional state: ${s.emotionalState}. Attitude toward detective: ${detectiveLabel} (${s.towardDetective}). Toward others: ${others}. ${emotions}`;
  }

  getPlayerProgress(): { stuckLevel: number; progressSummary: string } {
    const state = this.state;
    const day = state.currentDay;
    const evidenceRatio = state.evidenceCollected.length / Math.max(1, this.getActiveEvidence().length);
    const interrogated = state.charactersInterrogated.length;
    const totalNPCs = Object.keys(state.npcSentiments).length;
    const interrogationRatio = interrogated / Math.max(1, totalNPCs);
    
    let stuckLevel = 0;
    if (day >= 2 && evidenceRatio < 0.3 && interrogationRatio < 0.4) stuckLevel = 1;
    if (day >= 3 && evidenceRatio < 0.4) stuckLevel = 2;
    if (day >= 3 && state.accusationsMade > 0 && !state.gameWon) stuckLevel = 2;
    if (day >= 4 && evidenceRatio < 0.5) stuckLevel = 3;
    
    const progressSummary = `Day ${day}: ${state.evidenceCollected.length}/${this.getActiveEvidence().length} evidence found (${Math.round(evidenceRatio*100)}%), ${interrogated}/${totalNPCs} suspects interrogated, ${state.accusationsMade} wrong accusations.`;
    
    return { stuckLevel, progressSummary };
  }

  getPlayerProfile(): PlayerProfile {
    return { ...this.state.playerProfile };
  }

  updatePlayerProfile(profile: Partial<PlayerProfile>): void {
    Object.assign(this.state.playerProfile, profile);
  }

  recordQuestion(): void {
    this.state.playerProfile.questionCount++;
  }

  reset(): void {
    this.state = this.createFreshState();
    this.nightConversations = [];
    this.directorPlan = null;
    this._correctSuspect = CORRECT_SUSPECT;
    this._keyEvidence = KEY_EVIDENCE;
    this._motiveKeywords = MOTIVE_KEYWORDS;
    this._activeLevel = 'manor';
    this._winMessage = "Brilliant deduction, Detective! Dr. James Hartwell poisoned Lord Edmund Blackwood's brandy with a lethal dose of digitalis, extracted from foxglove, to prevent Edmund from reporting his prescription forgery to the Medical Board. Case closed!";

    // Restore manor evidence (may have been overwritten by cruise/random loadLevelConfig)
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
}
