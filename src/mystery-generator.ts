import type { Evidence, NPCSentiment } from "./gameState.js";
import type { CreativeAssets } from "./creative-agent.js";

export interface GeneratedMystery {
  title: string;
  setting: string;
  settingTheme: string;
  crime: string;
  victim: { name: string; age: number; role: string };
  visual?: { wallColor: string; wallAccent: string; accentColor: string; ambientTint: string; furnitureStyle: string; roomLayout: string; weather: string };
  characters: { id: string; name: string; role: string; location: string; motive: string; secret: string; alibi: string; personality: string; isKiller: boolean; systemPrompt: string; spriteColors?: { body: string; hair: string } }[];
  evidence: (Evidence & { color?: string })[];
  evidencePositions: Record<string, { x: number; y: number; floor?: number }>;
  rooms: { id: string; name: string; x: number; y: number; w: number; h: number; floor: string; size?: string; floorNum?: number }[];
  stairs?: { x: number; y: number; w: number; h: number; fromFloor: number; toFloor: number }[];
  multiFloor?: boolean;
  creativeAssets?: CreativeAssets;
  correctSuspect: string;
  keyEvidence: string[];
  motiveKeywords: string[];
  winMessage: string;
  directorPrompt: string;
  initialSentiments: Record<string, NPCSentiment>;
}

// Step 1: Generate the mystery skeleton
export const SKELETON_PROMPT_BASE = `You are a MYSTERY ARCHITECT designing a murder mystery game.

Invent a COMPLETELY ORIGINAL setting of your own choosing. You have full creative freedom — pick any real-world location, profession, subculture, historical era, industry, or niche hobby that would make a compelling and unusual backdrop for a murder. Think specifically and vividly: not just "a restaurant" but "a Michelin-starred kitchen mid-service"; not just "a lab" but "a cryonics revival facility at 3am"; not just "a ship" but "a solo-circumnavigation yacht run aground".

DO NOT pick: mansion, manor, hotel, cruise ship, archaeological dig, circus, submarine, underwater base, desert camp. These are BANNED.

Output a JSON object with this EXACT structure (no other text):
{
  "title": "Mystery Title",
  "setting": "One-sentence setting description",
  "settingTheme": "one word: noir|tropical|clinical|rustic|industrial|elegant|gritty|mystical",
  "crime": "What happened (2-3 sentences)",
  "victim": { "name": "Name", "age": 50, "role": "Their role" },
  "visual": {
    "wallColor": "hex color for walls, e.g. #2d1117 (dark tone matching setting)",
    "wallAccent": "hex color for wall detail/trim, e.g. #3a1520",
    "accentColor": "hex color for UI highlights and glow, e.g. #c9a84c (gold) or #00ccff (sci-fi blue)",
    "ambientTint": "hex color overlay for atmosphere, e.g. #1a0a00 (warm) or #000a1a (cold)",
    "furnitureStyle": "one of: wooden|metal|modern|ornate|rustic|clinical|futuristic",
    "roomLayout": "one of: grid|L_shaped|corridor|hub_spoke|irregular",
    "weather": "one of: rain|fog|storm|snow|clear (match setting — rain for ships/tropics, snow for arctic, fog for noir, storm for dramatic)"
  },
  "rooms": [
    { "id": "snake_case", "name": "Display Name", "floor": "tile_floor|tile_carpet|tile_metal|tile_wood_deck|tile_carpet_blue|tile_carpet_red|tile_tile_white|tile_sand|tile_ice|tile_grass|tile_stone", "size": "small|medium|large" }
  ],
  "upperRooms": [
    { "name": "Display Name for Upper Floor version of each room", "floor": "tile_floor|tile_carpet|tile_metal|tile_wood_deck|tile_carpet_blue|tile_carpet_red|tile_tile_white|tile_sand|tile_ice|tile_grass|tile_stone" }
  ],
  "characters": [
    {
      "id": "snake_case",
      "name": "Full Name",
      "role": "Role/profession",
      "location": "room_id",
      "personality": "2-3 sentences on personality and speech style",
      "motive": "Why they COULD have done it",
      "secret": "What they're actually hiding",
      "alibi": "What they claim + what's true",
      "isKiller": false,
      "spriteColors": { "body": "#hex outfit color", "hair": "#hex hair color" }
    }
  ],
  "evidence": [
    { "id": "snake_case", "name": "Name", "description": "Short desc", "location": "room_id", "detail": "What detective sees examining it (2-3 atmospheric sentences)", "color": "#hex primary color of this item" }
  ],
  "correctSuspect": "killer_character_id",
  "keyEvidence": ["ev_id1", "ev_id2", "ev_id3"],
  "motiveKeywords": ["word1", "word2", "word3"],
  "winMessage": "Congratulations message explaining the full solution (3-4 sentences)"
}

RULES:
- Exactly 6 suspects, one of whom is the killer (isKiller: true)
- Exactly 8 evidence items, with at least 3 directly linking to the killer
- 5 to 8 rooms — pick a number that fits the setting naturally
- Room sizes should VARY: mix small (storage, closet), medium (office), and large (hall, arena)
- Include red herrings pointing to innocent suspects
- Every suspect needs a believable motive, secret, and alibi
- Make the setting VIVID and unusual — the more specific and unexpected the better
- Choose spriteColors for each character that match their role/personality (e.g. chef = white, military = olive, wealthy = deep red)
- The visual palette should strongly reflect the setting (cold blues for ice station, warm golds for desert, sterile whites for lab, etc.)
- roomLayout should match the setting (corridor for submarine/train, hub_spoke for space station, irregular for cave/ruins)
- upperRooms must have EXACTLY the same number of entries as rooms. Each entry is the upper-floor version of the corresponding ground-floor room — give it a thematic name fitting the setting (e.g. a winery's "Tasting Room" might become "Private Cellar", a lab's "Reception" might become "Data Vault"). Choose a floor texture that matches (warmer carpets upstairs, same stone if underground, etc.)`;

/** Build the skeleton prompt, letting the AI freely invent its own setting/scenario. */
export function buildSkeletonPrompt(previousSettings: string[]): string {
  let prompt = SKELETON_PROMPT_BASE;

  // Exclude previously used settings so the AI doesn't repeat itself
  if (previousSettings.length > 0) {
    prompt += `\n\nALREADY USED (do NOT repeat these titles or settings — invent something completely different):\n- ${previousSettings.join('\n- ')}`;
  }

  return prompt;
}

// Step 2: Generate a single character's full system prompt
export function buildCharacterPrompt(skeleton: any, character: any, allCharacters: any[], allEvidence: any[]): string {
  const otherChars = allCharacters.filter((c: any) => c.id !== character.id);
  const relationships = otherChars.map((c: any) => `- ${c.name} (${c.role})`).join('\n');
  const evidenceList = allEvidence.map((e: any) => `- ${e.name}: ${e.detail}`).join('\n');

  return `Write the FULL system prompt for this character in a murder mystery game.

SETTING: ${skeleton.setting}
CRIME: ${skeleton.crime}
VICTIM: ${skeleton.victim.name}, ${skeleton.victim.age}, ${skeleton.victim.role}

THIS CHARACTER:
- Name: ${character.name}
- Role: ${character.role}
- Personality: ${character.personality}
- Motive: ${character.motive}
- Secret: ${character.secret}
- Alibi: ${character.alibi}
- Is the killer: ${character.isKiller}

OTHER SUSPECTS:
${relationships}

EVIDENCE IN THE GAME:
${evidenceList}

Write the system prompt following this EXACT format. Include ALL sections. The prompt must be 500-800 words.

"You are [NAME], age [AGE], [ROLE]. [Setting context].

=== GAME RULES ===
1. You are a character in a murder mystery game. A detective is interrogating you.
2. Stay in character at ALL times with unique speech patterns and vocabulary.
3. Some facts you share freely, some reluctantly, some only when confronted with evidence.
4. NEVER break character or acknowledge you are an AI.
5. Keep responses concise — 2-4 sentences typically.
6. React to evidence shown to you appropriately.
7. You may lie about things your character would lie about. Be consistent.
8. If asked about something you wouldn't know, say so in character.
9. React emotionally when appropriate.
10. Reference your relationships with other suspects naturally.
11. Call update_sentiment when your feelings shift. Call get_my_sentiment at conversation start.
12. Let emotional state affect your speech style.
13. During night scenes, you may plot, threaten, form alliances, or betray others.
14. Use show_body_language for visible physical reactions.

=== CONFESSION RULES ===
- NEVER confess just because accused. Need 3+ pieces of direct evidence.
- If innocent, NEVER confess under any circumstances.

=== YOUR IDENTITY ===
[Full backstory and what happened]

=== PERSONALITY & SPEECH ===
[How they talk, verbal tics, emotional patterns]

=== WHAT YOU KNOW ===
[Organized: freely shared / reluctantly / only under pressure]

=== WHAT YOU'LL LIE ABOUT ===
[Specific lies with consistency rules]

=== RELATIONSHIPS ===
[2-3 sentences per other character]

=== EVIDENCE REACTIONS ===
[How they react to each evidence item]"

${character.isKiller ? 'Include ESCALATING PRESSURE RESPONSES (5 levels from calm to breakdown/confession).' : ''}

Output ONLY the system prompt text, nothing else.`;
}

// Step 3: Generate Director prompt
export function buildDirectorPromptRequest(skeleton: any): string {
  return `Write a GAME DIRECTOR system prompt for this murder mystery. The Director is an invisible AI that orchestrates night events — choosing who talks to whom, where NPCs go, what evidence changes.

SETTING: ${skeleton.setting}
CRIME: ${skeleton.crime}
VICTIM: ${skeleton.victim.name}
KILLER: ${skeleton.correctSuspect}

CHARACTERS:
${skeleton.characters.map((c: any) => `- ${c.name} (${c.id}): ${c.role}. Secret: ${c.secret}. Motive: ${c.motive}. ${c.isKiller ? 'THIS IS THE KILLER.' : ''}`).join('\n')}

EVIDENCE:
${skeleton.evidence.map((e: any) => `- ${e.name} (${e.id}): ${e.detail}`).join('\n')}

ROOMS: ${skeleton.rooms.map((r: any) => r.id).join(', ')}

Write the Director prompt (300-500 words) following this structure:
"You are the GAME DIRECTOR for [title]. You orchestrate the world to create compelling gameplay.
=== THE TRUTH === [full solution]
=== THE CHARACTERS === [each with secrets]
=== RULES === [night conversation pairs, NPC positioning, evidence dynamics, adaptive difficulty]"

Include adaptive difficulty rules (stuckLevel 0-3).
Output ONLY the prompt text.`;
}
