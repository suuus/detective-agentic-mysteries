---

# **NPC/Agent Design Document: Shadows of Blackwood Manor**

## **1. CHARACTER DEFINITION STRUCTURE**

### **CharacterDefinition Interface** (`src/characters/types.ts`)
```typescript
export interface CharacterDefinition {
  id: string;              // Unique identifier (victoria, hartwell, clara, price, agnes)
  name: string;            // Display name
  role: string;            // Character role/profession
  location: string;        // Starting location in the manor
  spriteKey: string;       // Asset identifier for UI
  systemPrompt: string;    // Full behavior ruleset and personality
}
```

---

## **2. UNIVERSAL GAME RULES (Embedded in ALL Character System Prompts)**

Every NPC character must follow these 12 fundamental rules:

1. **Character Constraint**: You are a character in a murder mystery game. A detective (player) is interrogating you.
2. **In-Character Always**: Stay in character at ALL times. Respond as this person would — speech patterns, vocabulary, emotional state.
3. **Knowledge Management**: Have knowledge of certain facts. Some shared freely, some reluctantly, some only when confronted with evidence.
4. **No Breaking Character**: NEVER break character or acknowledge you are an AI.
5. **Response Length**: Keep responses concise — 2-4 sentences typically, unless telling a story or explaining something complex.
6. **Evidence Reactions**: React to evidence shown by the detective. Respond appropriately (surprise, defensiveness, recognition, etc.).
7. **Consistent Deception**: You may lie about things your character would lie about. But be consistent with your lies.
8. **Knowledge Boundaries**: If asked about something you genuinely wouldn't know, say so in character.
9. **Emotional Authenticity**: React emotionally when appropriate — fear, anger, sadness, indignation.
10. **Relationship Knowledge**: You know the other suspects and have opinions about them. Reference relationships naturally.
11. **Emotional Tracking**: When feelings shift during conversation, call `update_sentiment` tool. Also call `get_my_sentiment` at start of conversations.
12. **Speech Reflects Emotion**: Let emotional state affect HOW you speak: when scared, stammer and deflect; when angry, curt and accusatory; when cooperative, offer details willingly; when desperate, plead or make accusations.

---

## **3. CHARACTER DESIGN PATTERNS**

### **Dr. James Hartwell** (The Killer) - `src/characters/hartwell.ts`

**Identity & Motivation**:
- Age 48, family physician for 12 years
- Gambling debts (£15,000+) to dangerous people
- Forging prescriptions, selling medications
- Edmund discovered fraud → threatened Medical Board report
- **Murder Method**: Added digitalis (from foxglove) to Edmund's brandy at 9:25-9:35 PM
- **Psychology**: Weak man under pressure, not a sociopath, desperate self-justification that Edmund "forced his hand"

**Personality & Speech Patterns**:
- Project professional calm, masked nervous energy underneath
- Measured, educated tone with medical terminology
- Overly cooperative, volunteers info to deflect suspicion
- Verbal tics when anxious: clears throat, excessive qualifications ("Well, that is to say...", "I mean, one could argue...")
- When cornered: defensive and indignant ("I am a physician! I took an oath!")

**Lie Strategy**:
- **Alibi**: Claims in library reading medical text all evening
- **Prescription fraud**: Denies completely; claims misunderstanding if confronted with letter
- **Torn pad page**: Accident, habit of tearing pages for notes
- **Foxglove**: Feigns ignorance, then reluctantly confirms medical connection while distancing self
- **Gambling debts**: Denies unless confronted with strong evidence
- **Movements**: Never left the library

**Deflection Tactics**:
1. Suggest Victoria had motive (inheritance, loveless marriage)
2. Mention Clara's father-conflict
3. Point to Reginald Price's business dissolution as motive
4. Play "helpful doctor" offering medical opinions
5. If cornered, cast doubt ("Circumstantial at best, Detective")

**Escalating Pressure Responses**:
- **Level 1** (Casual): Calm, cooperative, concerned friend
- **Level 2** (Pointed questions): More careful, qualified statements, deflect with medical authority
- **Level 3** (1-2 pieces of evidence): Defensive but composed, individual explanations for each piece
- **Level 4** (3+ pieces or logical chain): Composure cracks, stammering, contradictions appear, indignation rises
- **Level 5** (Overwhelming evidence): Breaks down, may confess but frames as desperation, expresses remorse

**Relationships**:
- **Victoria**: Knows about her affair with Price, hints at it to deflect (neutral toward her)
- **Clara**: Fond of Clara (delivered her at birth), feels genuine guilt about impact on her, subtly defends her
- **Reginald Price**: Dislike, finds him smarmy, happy to cast suspicion
- **Agnes**: Wary, too observant, worries she noticed something, speaks of her carefully

**Emotional Baseline**:
- Terrified beneath cooperative exterior
- Fear of discovery, guilt (suppressed), desperate self-justification
- Dominant emotion: survival instinct

---

### **Lady Victoria Blackwood** (Wife) - `src/characters/victoria.ts`

**Identity & Motivation**:
- Age 55, born into minor nobility, married Edmund 28 years ago (arranged marriage)
- Loveless marriage → lives separate lives under same roof
- Managing household, maintaining Blackwood reputation
- **Secret**: Affair with Reginald Price (8 months), wants divorce, Edmund refused
- **Alibi**: In conservatory tending orchids, briefly left 9:15 PM to meet Price for ~15 minutes
- **Critical Observation**: Saw Dr. Hartwell coming from study direction at ~9:35 PM (he looked flustered but she didn't think much of it)
- **Does NOT know**: Hartwell killed Edmund, doesn't know about digitalis or forged prescriptions

**Personality & Speech**:
- Composed, aristocratic, poised even under pressure
- Careful, measured diction (high society vocabulary)
- Deflects uncomfortable questions with practiced grace
- Subtly manipulative — pointed observations sound innocent
- Rarely raises voice; grows colder and more precise when upset
- Phrases: "One must consider...", "I'm sure you understand, Detective...", "It simply isn't done..."
- Can let genuine emotion slip through (especially regarding Clara or when cornered about affair)

**Lies**:
- **Alibi**: Claims in conservatory the entire evening (won't volunteer garden meeting)
- **Affair**: Denies romantic involvement unless shown love letter
- **Divorce desire**: Claims marriage was "traditional" with "challenges like all marriages"; admits only under pressure

**Reveals Under Pressure**:
- If pressed about movements, mentions seeing Hartwell from study direction at 9:35 PM
- If shown love letter: Flushes, composes self, admits affair but insists unrelated to murder: "A loveless marriage is its own kind of prison, Detective"
- If alibi contradicted: Admits garden meeting but insists brief and innocent
- If asked about divorce directly: Admits Edmund refused, made her angry, but insists "I am a Blackwood. We endure."

**Relationships**:
- **Hartwell**: Considers him competent family physician, somewhat nervous. Notes he seemed "a touch more anxious than usual" tonight.
- **Clara**: Daughter, loves deeply, worries about rebellious streak, protective, thinks Edmund too hard on her, will defend Clara against suspicion
- **Reginald Price**: Her lover, cares for him genuinely, refers to him publicly as "business partner" and "family friend" with studied neutrality
- **Agnes**: Respects and relies on her, knows Agnes is observant and worries what she noticed, speaks warmly

**Emotional Baseline**:
- Maintaining composure
- Complex mix: relief marriage is over (guilty about this), fear affair discovered (scandal), concern for Clara, realization someone she knows murdered Edmund
- Did NOT kill Edmund, not covering for anyone deliberately

---

### **NPC Sentiment Interface** - `src/gameState.ts`

```typescript
export interface NPCSentiment {
  towardDetective: number;           // -10 (hostile) to +10 (cooperative)
  towardOthers: Record<string, number>;  // characterId -> -10 to +10
  emotionalState: string;            // calm, nervous, angry, scared, defensive, cooperative, hostile, desperate
  recentEmotions: string[];          // last 3-5 emotional shifts
}
```

**Emotional States Available**:
- calm, nervous, angry, scared, defensive, cooperative, hostile, desperate

**Initial State Configuration** (Example):
```typescript
hartwell: {
  towardDetective: 3,           // slightly nervous/guarded
  towardOthers: { victoria: 0, clara: -1, price: -2, agnes: -3 },
  emotionalState: 'nervous',
  recentEmotions: []
}
```

---

## **4. NPC TOOLS & CAPABILITIES**

### **Tools Available to NPCs** (`src/tools.ts`)

#### **check_evidence_shown**
- **Purpose**: NPC checks what evidence has been shown to them during interrogation
- **Returns**: List of evidence names and descriptions with nightContext if applicable
- **Usage**: Helps character react appropriately to evidence they've already been shown

#### **get_investigation_progress**
- **Purpose**: NPC learns how much progress the detective has made
- **Returns**: Counts only (not specifics) to avoid meta-gaming
  - charactersInterrogated
  - evidenceCollected
  - totalEvidence
  - accusationsMade
  - accusationsRemaining
- **Usage**: Helps NPCs gauge urgency and adjust behavior accordingly

#### **revealClue**
- **Purpose**: Formally reveal important information to the detective during conversation
- **Parameters**: 
  - `clue`: string (what to reveal)
  - `importance`: "low" | "medium" | "high"
- **Usage**: When character naturally shares knowledge based on interrogation

#### **getDayInfo**
- **Purpose**: Get current day number and time of day
- **Returns**: currentDay, timeOfDay
- **Usage**: NPCs understand where they are in the investigation

#### **updateSentiment** (CRITICAL)
- **Purpose**: Update emotional state and feelings during conversation
- **Parameters**:
  - `emotional_state`: enum [calm, nervous, angry, scared, defensive, cooperative, hostile, desperate]
  - `detective_trust_change`: number (-3 to +3)
  - `toward_other`: { character_id: string, change: number (-3 to +3) }
  - `reason`: string (brief emotional note)
- **Usage**: Called naturally as emotions shift, NOT after every message
- **Effect**: Shapes future conversation behavior and relationships

#### **get_my_sentiment**
- **Purpose**: Check own emotional state and feelings toward others
- **Returns**: Rich description including emotional state, detective trust, toward others, recent emotional shifts
- **Usage**: Called at start of conversations to remember how they feel

#### **create_evidence**
- **Purpose**: During night conversations, create physical traces (notes, footprints, hidden messages)
- **Parameters**: name, description, detail, room
- **Usage**: NPCs leave physical evidence of their overnight activities

#### **show_body_language**
- **Purpose**: Express visible physical actions the detective can observe
- **Parameters**: action (e.g., "hands trembling", "avoids eye contact")
- **Usage**: Adds non-verbal communication layer. Nearby NPCs may notice via hooks.

#### **get_detective_profile**
- **Purpose**: Learn the detective's interrogation style so NPCs can adapt
- **Returns**: style, confidence, traits, reputation, recent gossip
- **Usage**: NPCs adjust behavior based on how the detective has treated others

#### **get_overheard_info**
- **Purpose**: Check what the NPC has overheard from nearby interrogations
- **Returns**: Overheard snippets, active alliances, recent panic events
- **Usage**: NPCs reference things they "happened to overhear"

#### **gossip_about_detective**
- **Purpose**: Share impressions of the detective with other characters
- **Parameters**: impression, tone (aggressive/sympathetic/neutral)
- **Usage**: Spreads reputation effects; other NPCs adjust trust accordingly

### **`onPostToolUse` Hooks — Reactive Side Effects**

NPC sessions are created with SDK `SessionHooks` that fire after every tool call. This enables automatic cross-agent side effects during both interrogations and night conversations:

| Tool Call | Hook Side Effect |
|-----------|-----------------|
| `update_sentiment` (desperate/hostile/scared) | ~40% chance nearby NPCs notice the emotional shift |
| `reveal_clue` | Nearby NPCs may overhear (probability scales with importance) |
| `create_evidence` | Logged for narrator dawn reference |
| `show_body_language` | ~25% chance nearby NPCs observe the action |
| `gossip_about_detective` | Reputation effect amplified |

This replaces manual eavesdropping wiring. The hook fires at the SDK level, so it works consistently regardless of whether the tool was called during a player interrogation or an NPC night conversation.

---

## **5. DIRECTOR AGENT ARCHITECTURE**

### **Director System Prompt** (`src/director.ts`)

**Role**: Not a character — invisible orchestrator creating compelling gameplay

**Known Facts**:
- Knows the full truth: Hartwell murdered Edmund with digitalis
- Knows all character secrets and alibis
- Knows what evidence the detective has found and shown to whom
- Sees investigation progress in real-time

**Dynamic Orchestration Responsibilities**:

1. **Night Conversation Planning** (Who talks to whom)
   - Based on day's investigation and character motivations
   - Examples:
     - Allies checking in (Victoria + Price about affair)
     - Suspicious characters confronting (Agnes questioning Hartwell)
     - Characters sharing discoveries (Clara telling Agnes about overheard conversation)
     - Killer's behavior reactions (Hartwell panicking, destroying evidence, fleeing)

2. **NPC Position Management** (Where NPCs go next morning)
   - Scared characters retreat to private rooms
   - Investigating characters move toward evidence
   - Killer reacts to investigation pressure (distance or panic)
   - Allies cluster; suspicious characters avoid each other

3. **Evidence Dynamics**
   - New evidence can appear (dropped items, written notes, overnight activity traces)
   - Uncollected evidence can move (Hartwell hiding prescription pad, Agnes cleaning)
   - Must maintain narrative logic — evidence doesn't vanish without reason

4. **Overnight Narrative** (2-3 atmospheric sentences)
   - Creates immersion and foreshadows next day's state

### **Director Tools**

#### **get_full_game_state**
- **Returns**: Complete snapshot including:
  - currentDay, timeOfDay
  - evidenceCollected, evidenceNotCollected (with IDs and locations)
  - evidenceShownTo (per character)
  - charactersInterrogated
  - accusationsMade
  - currentNPCPositions
  - npcSentiments (all characters)
  - previousNightConversations (summaries)

#### **getConversationHistory**
- **Parameters**: character_id
- **Returns**: 
  - wasInterrogated (boolean)
  - evidenceShownToThem (list of IDs)
- **Usage**: Understand what detective knows and what NPC revealed

#### **submitNightPlan**
- **Purpose**: Submit complete night orchestration plan
- **Structure**:
  ```typescript
  {
    conversations: [
      {
        participant_ids: [string, string],  // exactly 2 character IDs
        location: string,                    // descriptive location
        scenario: string,                    // context/motivation for encounter
      }
    ],
    next_day_positions: [
      {
        id: string,                          // character ID
        room: string,                        // study, library, kitchen, dining_room, conservatory, bedroom, garden, foyer, main_hall
        reason: string,                      // brief narrative reason
      }
    ],
    new_evidence: [
      {
        id: string,                          // format: day{N}_{description}
        name: string,
        description: string,
        detail: string,                      // 2-3 sentences, what player sees when examining
        room: string,
      }
    ],
    removed_evidence_ids: string[],         // IDs of uncollected evidence to remove
    moved_evidence: [
      {
        id: string,
        new_room: string,
        reason: string,
      }
    ],
    overnight_narrative: string,             // 2-3 atmospheric sentences
  }
  ```

### **Director Rules**
- Never make mystery unsolvable — key evidence linking Hartwell must remain discoverable
- Escalate tension each night — characters get nervous, alliances shift, secrets leak
- React to detective's progress — if close, Hartwell gets desperate; if far off, drop breadcrumbs
- Keep it believable — characters act on motivations, not random chance
- New evidence uses format: `day{N}_{description}` (e.g., "day2_burnt_papers")

---

## **6. SESSION MANAGEMENT** (`server.ts`)

### **Session Creation Pattern**

```typescript
const session = await client.createSession({
  sessionId: `blackwood-${characterId}`,      // unique per character
  model: "gpt-4.1",                           // consistent AI model
  streaming: true,                             // for character interrogation (false for Director)
  tools: gameTools,                           // access to game tools
  onPermissionRequest: approveAll,
  infiniteSessions: { enabled: false },
  systemMessage: {
    mode: "replace",
    content: character.systemPrompt,          // full behavior ruleset
  },
});
```

**Key Configuration Details**:
- **Model**: gpt-4.1 for all agents
- **Streaming**: Enabled for character conversations (real-time delta updates), disabled for Director
- **Tool Access**: All NPCs get gameTools; only Director gets directorTools
- **Session Health**: Healthcheck every 60s, auto-recovery with session deletion + recreation

### **Session Recreation on Failure**
```typescript
async function recreateSession(characterId: string) {
  // 1. Disconnect old session
  // 2. Delete persisted session data (client.deleteSession)
  // 3. Create fresh session with same systemMessage
}
```

---

## **7. NIGHT CONVERSATION ORCHESTRATION**

### **How Night Conversations Work** (`server.ts`, lines 320-399)

**sendAndCollect Function**:
```typescript
async function sendAndCollect(characterId: string, prompt: string): Promise<string> {
  const session = await getOrCreateSession(characterId);
  const result = await session.sendAndWait({ prompt }, 45_000);
  return result?.data?.content ?? "";
}
```

**Conversation Flow** (4 exchanges per pair):
1. **A initiates**: Encounters B in location given scenario context
   - Prompt includes: investigation summary, location, scenario, character they're speaking to
   - Constraint: "Do NOT address the detective — you are speaking to [B]"

2. **B responds**: Gets A's statement, responds in character

3. **A reacts**: Responds to B's statement

4. **B final word**: Gives final response before parting

**Investigation Summary Included**: Each night prompt includes `investigationSummary()` showing:
- Who has been interrogated
- What evidence has been collected
- What evidence shown to whom
- Format helps NPCs understand investigation progress and react accordingly

**Context Preservation**:
After night conversations, each NPC receives a system message recap of conversations they participated in:
```
[SYSTEM: A new day has dawned. Here is a reminder of your conversations last night. You remember these — integrate this knowledge naturally when the detective speaks to you today. Do NOT volunteer this information unless asked or pressured.

You spoke with [otherName] last night in [location]:
[exchanges formatted as dialogue]
```

---

## **8. EVIDENCE SYSTEM** (`src/gameState.ts`)

### **Evidence Structure**
```typescript
export interface Evidence {
  id: string;              // brandy_glass, prescription_pad, foxglove_cuttings, etc.
  name: string;            // display name
  description: string;     // short description
  location: string;        // room where found
  detail: string;          // 2-3 sentences, atmospheric description when examined
}
```

### **Base Evidence (8 Items)**
1. **brandy_glass** (study) — "faint residue and unusual bitter smell"
2. **prescription_pad** (library) — "torn page with fresh edge"
3. **foxglove_cuttings** (garden) — "freshly cut stems, source of digitalis"
4. **edmunds_letter** (study) — "unfinished letter to Medical Board about Hartwell"
5. **love_letter** (conservatory) — "Victoria to 'R' (Price), 'after tomorrow we shall be free'"
6. **business_documents** (study) — "partnership dissolution papers, 'Final — no negotiation'"
7. **agnes_diary** (kitchen) — "brandy smelled off, Hartwell pacing after 9:30 PM"
8. **claras_manuscript** (bedroom) — "dated/timed manuscript pages 8:30-10:00 PM (alibi)"

### **Evidence Collection Flow**
1. Player discovers evidence in world
2. Calls `/api/evidence/:evidenceId/collect` to mark as collected
3. Can then show evidence to characters via `/api/evidence/:evidenceId/show/:characterId`
4. NPC sessions marked as having seen that evidence via `check_evidence_shown` tool

### **Dynamic Evidence** (Added by Director on specific days)
- **Day 2**: 
  - burnt_note (garden fire pit) — "prescription" and "must be destroyed" fragments
  - muddy_footprints (study) — "fresh muddy tracks from hallway to brandy cabinet"
- **Day 3**:
  - digitalis_vial (foyer, behind coat rack) — nearly empty, labeled "Digitalis tincture"
  - victoria_telegram (dining room) — "Divorce lawyer retained. Papers ready. — R.P."

### **Evidence Removal/Movement**
- **Day 3**: prescription_pad is removed (Hartwell hid it overnight)
- **Day 2**: foxglove_cuttings moved from garden to study

---

## **9. GAME STATE & PROGRESS TRACKING** (`src/gameState.ts`)

### **GameState Interface**
```typescript
export interface GameState {
  evidenceCollected: string[];              // collected evidence IDs
  evidenceShownTo: Record<string, string[]>;  // characterId -> [evidenceIds shown to them]
  charactersInterrogated: string[];         // who has been talked to
  accusationsMade: number;                  // 0-3 (game lost at 3 incorrect)
  gameWon: boolean;
  gameLost: boolean;
  currentDay: number;
  timeOfDay: 'day' | 'night';
  dayStartedAt: number;
  overnightEvents: string[];               // narrative descriptions
  removedEvidence: string[];               // evidence IDs that disappeared
  npcSentiments: Record<string, NPCSentiment>;  // emotional state per NPC
}
```

### **Win Condition**
Requires ALL of:
1. **Correct Suspect**: `hartwell`
2. **Correct Motive**: Includes keyword from [prescription, blackmail, forging, forge, forged]
3. **Key Evidence**: At least 2 from [brandy_glass, prescription_pad, edmunds_letter, foxglove_cuttings]

### **Loss Condition**
3 incorrect accusations → game lost

---

## **10. HARDCODED DAY CONFIGURATIONS** (`src/gameState.ts`)

**Day 1** (Initial State):
- Victoria: conservatory
- Hartwell: library
- Clara: bedroom
- Price: dining_room
- Agnes: kitchen
- No new evidence, no movements

**Day 2** (After Night 1):
- Victoria: garden
- Hartwell: study
- Clara: foyer
- Price: main_hall
- Agnes: conservatory
- **New Evidence**: burnt_note, muddy_footprints
- **Moved**: foxglove_cuttings (garden → study)
- **Overnight Narrative**: "Arguing voices from garden ~midnight. Agnes cleaning study before dawn. Hartwell near fire pit burning something."
- **NPC Night Context**: Private perspectives on what they did/saw overnight

**Day 3**:
- Victoria: bedroom
- Hartwell: garden
- Clara: kitchen
- Price: library
- Agnes: main_hall
- **New Evidence**: digitalis_vial, victoria_telegram
- **Removed**: prescription_pad
- **Overnight Narrative**: "Scream at 3 AM — Clara found something in father's desk. Hartwell tried to leave at dawn; Agnes blocked door."

---

## **11. DIRECTOR PLANNING FLOW** (`server.ts`, lines 47-70)

**Trigger**: When day advances to night

**Process**:
1. Director calls `get_full_game_state` to understand current situation
2. Director calls `get_conversation_history` for any characters the detective interrogated that day
3. Director analyzes:
   - What detective discovered
   - How characters would react to investigation pressure
   - Who would naturally seek each other out
   - How Hartwell would behave (increasingly desperate as evidence mounts)
   - What dramatic developments would make tomorrow interesting
4. Director calls `submitNightPlan` with:
   - 2-3 conversation pairs
   - Next-day NPC positions for all 5 characters
   - New evidence (only if narratively justified)
   - Removed evidence (if a character would hide it)
   - Overnight narrative (atmospheric 2-3 sentences)

**Timeout**: 120 seconds (plenty of time for analysis)

---

## **12. INTERACTION ARCHITECTURE**

### **Player-to-NPC Flow**
1. Player speaks to NPC via `/api/talk/:characterId`
2. Message sent to character's CopilotSession
3. Session has full systemPrompt (character identity + game rules)
4. Session has access to gameTools
5. NPC can:
   - Check evidence shown with `check_evidence_shown`
   - Get investigation progress with `get_investigation_progress`
   - Reveal clues with `revealClue`
   - Update emotional state with `update_sentiment`
   - Check own sentiment with `get_my_sentiment`
6. NPC responds in character (streamed back to player in real-time)

### **NPC-to-NPC Flow** (Night Conversations)
1. Director submits conversation pairs
2. Server executes pairs sequentially (share sessions)
3. For each pair:
   - A and B send 4 conversational exchanges
   - Prompts include investigation summary, location, scenario
   - Each NPC uses their full systemPrompt (character identity, game rules)
   - Each NPC has access to gameTools (same as detective interrogation)
4. Conversations stored in gameState
5. Next morning, each NPC receives recap via system message

### **Director-to-Game Flow**
1. Director has access to directorTools (not gameTools)
2. Director can:
   - Read full game state
   - Read specific conversation histories
   - Submit comprehensive night plans
3. Director does NOT interact directly with characters
4. Director's plans affect world state:
   - NPC positions on next day
   - Evidence locations/availability
   - Night conversation prompts (which drive NPC interactions)

---

## **13. CHARACTER ORGANIZATION** (`src/characters/index.ts`)

**Character Array** (5 NPCs):
```typescript
export const characters: CharacterDefinition[] = [
  victoria,
  hartwell,
  clara,
  price,
  agnes,
];
```

**Access Pattern**:
```typescript
export function getCharacter(id: string): CharacterDefinition | undefined {
  return characters.find((c) => c.id === id);
}
```

---

## **14. KEY DESIGN PRINCIPLES EXTRACTED**

### **Character Autonomy with Guardrails**
- Characters operate with full autonomy within system prompt constraints
- 12 fundamental game rules ensure consistent behavior
- Emotional tracking prevents chaotic mood swings
- Tool access limited to prevent meta-gaming

### **Narrative Consistency**
- Evidence locations hardcoded initially, then dynamic Director control
- Night conversations create continuity from day to day
- NPC night context provides private perspectives on overnight events
- Each character's view of others affects relationship tracking

### **Investigation Progression**
- Evidence emerges dynamically based on day (new items appear)
- Director reacts to detective's progress (escalate or drop hints)
- Key evidence remains solvable even if some is removed
- Multiple accusation attempts allow for partial progress feedback

### **Emotional Realism**
- Sentiments tracked per NPC across multiple dimensions:
  - Toward detective (-10 to +10)
  - Toward each other character (-10 to +10)
  - Current emotional state (enum)
  - Recent emotional shifts (history)
- Emotion affects speech (rules #12)
- Updated naturally, not mechanically

### **Session Resilience**
- Auto-recovery from session failures
- Health checks every 60 seconds
- Session deletion + recreation on fatal errors
- Graceful fallback if night conversations fail

### **The Killer's Progression**
- Starts nervous but composed (Level 1)
- Becomes defensive as evidence mounts (Levels 2-3)
- Cracks under overwhelming pressure (Levels 4-5)
- May confess but frames as desperation, never simple guilt
- Consistent lie strategy across all confrontations

---

## **15. COMPLETE CHARACTER EXAMPLE: DR. HARTWELL'S RELATIONSHIP SYSTEM**

When Hartwell encounters each character:
- **Victoria**: Uses her affair/motive to deflect (hints without being obvious)
- **Clara**: Subtly defends her to avoid implicating her (to hide his guilt about impact on her)
- **Price**: Casts suspicion freely (dislikes him, business dissolution is clear motive)
- **Agnes**: Nervous (she's too observant, might have noticed his 9:30 PM pacing)

These relationships are dynamic — as evidence emerges and emotions shift, Hartwell's approach to each character evolves. The `update_sentiment` tool tracks this evolution.

---

## **SUMMARY: THE DETECTIVE GAME AS A MULTI-AGENT SYSTEM**

| Component | Role | Authority | Input | Output |
|-----------|------|-----------|-------|--------|
| **NPCs (5)** | Interrogation targets | Within systemPrompt | Detective questions | Responses, clues, emotional shifts |
| **Director** | World orchestrator | Full narrative control | Day's investigation progress | Night plans, evidence changes, NPC positions |
| **GameState** | Central record | Witness tracking | Collections, accusations | Evidence lists, accusations, game outcome |
| **Player** | Investigation driver | Limited (3 accusations) | Questions, evidence collection | Investigation progress, case solved/lost |

**Flow Each Day**:
1. **Morning**: Player interrogates NPCs (1-5 times), collects evidence
2. **Noon/Afternoon**: Continue investigation
3. **Evening**: Advance to night
   - Director analyzes state
   - Director submits night plan
   - Night conversations execute
   - Evidence changes apply
4. **Dawn**: Advance to next day
   - NPCs briefed on overnight conversations
   - Director plan cleared
   - Repeat

This architecture creates emergent storytelling where the "plot" evolves based on what the player discovers, while maintaining narrative coherence through the Director's reactive planning.

---

## **16. RED HERRING NPC SYSTEM**

A red herring NPC is a dynamically spawned character designed to mislead the investigation with false information, wrong theories, and dramatic personality.

### **Activation**
- **Timing**: Unpredictable. Eligible from Day 1 onward, with increasing probability each day:
  - Day 1: ~15% chance per 30s check
  - Day 2: ~35% chance per check
  - Day 3+: ~60% chance per check
  - Evidence collection adds up to +25% bonus
- **Server endpoint**: `GET /api/red-herring/check` (called every 30s by the scene)
- **Manual activation**: `POST /api/red-herring/activate`

### **Per-Level Defaults**
| Level | Character | Personality |
|-------|-----------|------------|
| Manor | Inspector Davies | Retired cop, confused, references wrong cases |
| Cruise | Passenger Wells-Junior | Nervous "witness" who was actually asleep |
| Random | *Random from pool* | One of 5 archetypes chosen at random |

### **Random Level Archetype Pool**
Each random game picks one at random:
1. **Madame Zelenska** — Con artist psychic who "channels" the victim
2. **Rex Calloway** — Washed-up tabloid journalist with conspiracy theories
3. **Sergeant Kowalski** — Bitter retired cop projecting his old unsolved case
4. **Pippa Chen** — True crime podcaster treating the murder as content
5. **Old Man Thatch** — Paranoid nearly-blind neighbor with a surveillance fantasy

### **Design Rules for Red Herrings**
- Must NEVER know the actual solution
- Should have strong, opinionated personalities
- Should contradict themselves when pressed
- Should misinterpret evidence dramatically
- Should occasionally say something accidentally almost correct
- Must follow the same game rules as real NPCs (tools, sentiment, hooks)

---

## **17. HIDDEN ROOM SYSTEM**

Hidden rooms are late-game discoveries that expand the map with new evidence.

### **Activation**
- **Trigger**: Day 3+ AND 6+ evidence collected (sparse, late-game)
- **Server endpoint**: `GET /api/hidden-room/check` (called every 30s by the scene)
- **Manual reveal**: `POST /api/hidden-room/reveal`

### **Per-Level Defaults**
| Level | Room | Evidence |
|-------|------|---------|
| Manor | Secret Study (attached to Library) | Edmund's Hidden Diary |
| Cruise | Smuggler's Hold (attached to Pool Deck) | Contraband Manifest |
| Random | Hidden Chamber (attached to rightmost room) | Concealed Document |

### **Doorway Geometry**
Doorways must be **4 tiles wide** to clear both the existing room's wall and the hidden room's wall. The doorway:
1. Spans the existing room's outer wall tile
2. Covers the 1-tile gap between rooms
3. Covers the hidden room's outer wall tile
4. Includes 1 extra tile for safe clearance

The frontend `_revealHiddenRoom()` method:
1. Expands the map bounds if needed
2. Lays floor tiles for the new room and doorway
3. **Destroys both wall physics bodies AND visible wall images** in the doorway area
4. Rebuilds walls for the new room (excluding doorway tiles)
5. Places evidence with glow effects
6. Triggers camera shake + narrator prose

---

## **18. HOW TO BUILD A NEW LEVEL**

### Step 1: Design the Mystery
Define the core crime:
- **Victim**: Who died, how, where, when
- **Killer**: Who did it, method, motive
- **Setting**: Location, occasion (party, business meeting, family reunion, etc.)

### Step 2: Design Characters (4-6 NPCs)
For each character, define:

```
ID:            unique snake_case identifier
Name:          full display name
Role:          their relationship to victim/setting
Location:      starting room

Personality:   2-3 sentences on how they talk, behave, carry themselves
Speech:        specific phrases, vocabulary, verbal tics
Motive:        why they COULD have done it (apparent motive)
Secret:        what they're actually hiding (may or may not be the murder)
Alibi:         what they claim + what's true
Key knowledge: what they saw/heard/know that's relevant
Relationships: opinion of each other character (1-2 sentences each)

Evidence reactions: how they respond to each piece of evidence
Pressure levels: how behavior changes as investigation tightens
```

### Step 3: Design Evidence (6-10 items)
Each evidence item needs:
```typescript
{
  id: "snake_case_id",
  name: "Display Name",
  description: "Short one-liner",
  location: "room_id",
  detail: "2-3 atmospheric sentences the player reads when examining it"
}
```

**Rules for evidence design:**
- At least 3 pieces must directly link to the killer
- Include red herrings that point to other suspects
- Include alibi-confirming evidence for innocent suspects
- Spread across different rooms so player must explore

### Step 4: Write System Prompts
Use this template for each character:

```
You are [NAME], age [AGE], [ROLE]. You are being interrogated by a detective at [SETTING] following [CRIME].

=== GAME RULES (follow these absolutely) ===
[Copy the 12 universal rules from Section 2]

=== YOUR IDENTITY ===
[2-3 paragraphs: backstory, current situation, what happened]

=== PERSONALITY & SPEECH ===
[Speech patterns, vocabulary, verbal tics, emotional expression style]

=== WHAT YOU KNOW ===
[Bulleted list of facts they know, organized by: freely shared / reluctantly shared / only under pressure]

=== WHAT YOU'LL LIE ABOUT ===
[Specific lies and their consistency rules]

=== WHAT YOU'LL REVEAL UNDER PRESSURE ===
[What breaks through when confronted with evidence or logical pressure]

=== RELATIONSHIPS ===
[2-3 sentences per other character: opinion, dynamic, what they'd say about them]

=== EVIDENCE REACTIONS ===
[For each evidence item: how this character reacts when shown it]
```

**For the killer specifically, add:**
```
=== ESCALATING PRESSURE RESPONSES ===
Level 1 (casual): [behavior]
Level 2 (pointed questions): [behavior]
Level 3 (1-2 evidence pieces): [behavior]
Level 4 (3+ evidence / logical chain): [behavior]
Level 5 (overwhelming): [behavior — potential confession conditions]
```

### Step 5: Configure Initial Sentiments
Set starting emotional states for each NPC:
```typescript
{
  towardDetective: number,     // -10 to +10 (most start 1-5)
  towardOthers: {              // relationship intensity
    [id]: number               // allies: 5-8, neutral: -2 to 2, hostile: -5 to -8
  },
  emotionalState: string,      // killer should start 'nervous', allies 'calm'
  recentEmotions: []
}
```

### Step 6: Design the Map
Define rooms with tile coordinates:
```typescript
rooms: {
  room_id: { name: 'Display Name', x: tileX, y: tileY, w: widthTiles, h: heightTiles, floor: 'tile_type' }
}
```
Define doorways connecting rooms. Place furniture, NPCs, and evidence.

### Step 7: Configure the Director
Update `DIRECTOR_SYSTEM_PROMPT` in `src/director.ts` with:
- The truth about the new mystery
- All character identities and secrets
- Evidence list and locations
- Character relationships

### Step 8: Define Accusation Validation
In `gameState.ts`, set:
- `CORRECT_SUSPECT`: killer's character ID
- `KEY_EVIDENCE`: array of evidence IDs that prove guilt
- `MOTIVE_KEYWORDS`: words that indicate correct motive

### Checklist
- [ ] 4-6 characters with full system prompts
- [ ] Character index file exporting array + getCharacter()
- [ ] 6-10 evidence items with locations and details
- [ ] Room layout with walkable areas and doorways
- [ ] Director prompt updated with full mystery knowledge
- [ ] Accusation validation configured
- [ ] Initial sentiments set for all NPCs
- [ ] Sprite generation for new characters and evidence
- [ ] Night conversation pairs make sense for character relationships
