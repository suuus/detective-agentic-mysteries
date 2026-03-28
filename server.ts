import express from "express";
import cors from "cors";
import { readFileSync } from "fs";
import { CopilotClient, CopilotSession, approveAll } from "@github/copilot-sdk";
import { GameStateManager } from "./src/gameState.js";
import type { NightConversation, NightExchange } from "./src/gameState.js";
import { createGameTools } from "./src/tools.js";
import { createDirectorTools, DIRECTOR_SYSTEM_PROMPT, ALL_ROOM_POSITIONS } from "./src/director.js";
import { createNarratorTools, NARRATOR_SYSTEM_PROMPT } from "./src/narrator.js";
import { createProfilerTools, PROFILER_SYSTEM_PROMPT } from "./src/profiler.js";
import { characters } from "./src/characters/index.js";
import { cruiseCharacters } from "./src/characters/cruise/index.js";
import { CRUISE_CONFIG } from "./src/levels/cruise.js";
import { CRUISE_DIRECTOR_PROMPT } from "./src/levels/cruise-director.js";
import { SKELETON_PROMPT, buildCharacterPrompt, buildDirectorPromptRequest } from "./src/mystery-generator.js";
import type { GeneratedMystery } from "./src/mystery-generator.js";

let activeLevel: 'manor' | 'cruise' | 'random' = 'manor';
let generatedMystery: GeneratedMystery | null = null;
let generatedCharacters: any[] = [];
let generatedDirectorPrompt: string = '';
// Track previously generated settings so the randomizer never repeats (persisted to disk)
import { readFileSync, writeFileSync } from 'fs';
const SETTINGS_FILE = '.generated-settings.json';
let previousSettings: string[] = [];
try { previousSettings = JSON.parse(readFileSync(SETTINGS_FILE, 'utf-8')); } catch { previousSettings = []; }
function savePreviousSettings() {
  try { writeFileSync(SETTINGS_FILE, JSON.stringify(previousSettings)); } catch {}
}

// ── Hidden Room System ───────────────────────────────────────────
interface HiddenRoom {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  floor: string;
  evidence: { id: string; name: string; description: string; location: string; detail: string; x: number; y: number }[];
  doorway: { x: number; y: number; w: number; h: number };
}
let hiddenRoom: HiddenRoom | null = null;
let hiddenRoomRevealed = false;

// ── Red Herring NPC System ───────────────────────────────────────
interface RedHerringNPC {
  id: string;
  name: string;
  x: number;
  y: number;
  room: string;
  color: number;
  systemPrompt: string;
}
let redHerringNPC: RedHerringNPC | null = null;
let redHerringActive = false;
let redHerringSession: CopilotSession | null = null;

function getActiveCharacters() {
  let chars: any[];
  if (activeLevel === 'random' && generatedCharacters.length > 0) chars = generatedCharacters;
  else chars = activeLevel === 'cruise' ? cruiseCharacters : characters;
  // Include red herring NPC when active
  if (redHerringActive && redHerringNPC) {
    const rhChar = { id: redHerringNPC.id, name: redHerringNPC.name, systemPrompt: redHerringNPC.systemPrompt };
    if (!chars.find((c: any) => c.id === rhChar.id)) {
      return [...chars, rhChar];
    }
  }
  return chars;
}

function getActiveDirectorPrompt() {
  if (activeLevel === 'random' && generatedDirectorPrompt) return generatedDirectorPrompt;
  return activeLevel === 'cruise' ? CRUISE_DIRECTOR_PROMPT : DIRECTOR_SYSTEM_PROMPT;
}

function extractJSON(text: string): string {
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) return codeBlock[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end > start) return text.slice(start, end + 1);
  return text;
}

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const gameState = new GameStateManager();
const gameTools = createGameTools(gameState);

const client = new CopilotClient();
await client.start();
console.log("✅ Copilot SDK client connected");

// ── Model settings (user-configurable at runtime) ────────────────
const DEFAULT_MODEL = "gpt-4.1";
const modelSettings = {
  npc: DEFAULT_MODEL,
  director: DEFAULT_MODEL,
  architect: DEFAULT_MODEL,
  forensics: DEFAULT_MODEL,
  narrator: DEFAULT_MODEL,
  profiler: DEFAULT_MODEL,
};

// ── Game settings ────────────────────────────────────────────────
let gameLanguage = "English"; // Language NPCs respond in

function withLanguage(prompt: string): string {
  if (!gameLanguage || gameLanguage.toLowerCase() === 'english') return prompt;
  return `${prompt}\n\nIMPORTANT: The detective speaks ${gameLanguage}. You MUST respond in ${gameLanguage} at all times. Stay fully in character but speak ${gameLanguage}.`;
}

const sessions = new Map<string, CopilotSession>();

// ── NPC response tracking for contradiction detection ────────────
const npcResponseTracker = new Map<string, string[]>();
let interrogationCount = 0;

// ── Director Agent ───────────────────────────────────────────────
const directorTools = createDirectorTools(gameState);
let directorSession: CopilotSession | null = null;
let forensicsSession: CopilotSession | null = null;

async function getForensicsSession(): Promise<CopilotSession> {
  if (forensicsSession) return forensicsSession;
  try { await client.deleteSession("blackwood-forensics"); } catch {}
  forensicsSession = await client.createSession({
    sessionId: "blackwood-forensics",
    model: modelSettings.forensics,
    streaming: true,
    tools: [],
    onPermissionRequest: approveAll,
    infiniteSessions: { enabled: false },
    systemMessage: {
      mode: "replace",
      content: `You are a forensic analyst assisting a detective in a murder investigation. You analyze evidence items submitted to you and provide scientific, technical, and deductive insights.

=== YOUR ROLE ===
- When given an evidence item, analyze it from a forensic perspective
- Identify what it proves or suggests about the crime
- Note connections to potential suspects or other evidence WITHOUT naming the killer
- Use proper forensic terminology but explain for a layperson
- Be professional and objective
- Keep analysis to 3-5 sentences
- You may suggest what OTHER evidence to look for based on your analysis
- You may suggest which suspects this evidence is most relevant to
- NEVER definitively solve the case — provide analysis, not conclusions`
    },
  });
  return forensicsSession;
}

async function getDirectorSession(): Promise<CopilotSession> {
  if (directorSession) return directorSession;

  // Delete any stale director session from a previous level
  try { await client.deleteSession("blackwood-director"); } catch {}

  directorSession = await client.createSession({
    sessionId: "blackwood-director",
    model: modelSettings.director,
    streaming: false,
    tools: directorTools,
    onPermissionRequest: approveAll,
    infiniteSessions: { enabled: false },
    systemMessage: {
      mode: "replace",
      content: getActiveDirectorPrompt(),
    },
  });

  return directorSession;
}

// ── Narrator Agent ───────────────────────────────────────────────
const narratorTools = createNarratorTools(gameState);
let narratorSession: CopilotSession | null = null;

async function getNarratorSession(): Promise<CopilotSession> {
  if (narratorSession) return narratorSession;
  try { await client.deleteSession("blackwood-narrator"); } catch {}
  narratorSession = await client.createSession({
    sessionId: "blackwood-narrator",
    model: modelSettings.narrator,
    streaming: false,
    tools: narratorTools,
    onPermissionRequest: approveAll,
    infiniteSessions: { enabled: false },
    systemMessage: { mode: "replace", content: withLanguage(NARRATOR_SYSTEM_PROMPT) },
  });
  return narratorSession;
}

async function narrate(trigger: string, context: string): Promise<string> {
  try {
    const narrator = await getNarratorSession();
    const result = await narrator.sendAndWait({
      prompt: `[${trigger}] ${context}`
    }, 15_000);
    return result?.data?.content ?? "";
  } catch (err: any) {
    console.error("Narrator failed:", err.message);
    return "";
  }
}

// ── Gossip spreading ─────────────────────────────────────────────

// ── Profiler Agent ───────────────────────────────────────────────
const profilerTools = createProfilerTools(gameState);
let profilerSession: CopilotSession | null = null;

async function getProfilerSession(): Promise<CopilotSession> {
  if (profilerSession) return profilerSession;
  try { await client.deleteSession("blackwood-profiler"); } catch {}
  profilerSession = await client.createSession({
    sessionId: "blackwood-profiler",
    model: modelSettings.profiler,
    streaming: false,
    tools: profilerTools,
    onPermissionRequest: approveAll,
    infiniteSessions: { enabled: false },
    systemMessage: { mode: "replace", content: PROFILER_SYSTEM_PROMPT },
  });
  return profilerSession;
}

async function profileDetective(characterId: string, question: string): Promise<void> {
  // Only analyze every 3rd question to avoid overhead
  const profile = gameState.getPlayerProfile();
  if (profile.questionCount % 3 !== 0) return;

  try {
    const profiler = await getProfilerSession();
    const charName = getActiveCharacters().find((c: any) => c.id === characterId)?.name ?? characterId;

    await profiler.sendAndWait({
      prompt: `The detective just asked ${charName}: "${question.slice(0, 300)}"

Total questions so far: ${profile.questionCount}. Current style assessment: ${profile.style} (confidence: ${profile.confidence}).
Previous traits: ${profile.traits.join(', ') || 'none yet'}.

Analyze this question in context of their overall pattern. Update the detective's profile using the update_detective_profile tool.`
    }, 20_000);
  } catch (err: any) {
    console.warn("Profile analysis failed:", err.message);
  }
}

// ── Gossip spreading ─────────────────────────────────────────────
async function spreadGossip(interrogatedId: string, playerMessage: string): Promise<void> {
  const interrogatedChar = getActiveCharacters().find((c: any) => c.id === interrogatedId);
  if (!interrogatedChar) return;

  // Only spread gossip to NPCs on the same floor as the player
  const playerFloor = gameState.getPlayerFloor();

  for (const [otherId, session] of sessions) {
    if (otherId === interrogatedId) continue;

    const otherChar = getActiveCharacters().find((c: any) => c.id === otherId);
    if (!otherChar) continue;

    // Floor-aware gossip: only NPCs on the same floor overhear
    const otherFloor = gameState.getNPCFloor(otherId);
    if (otherFloor !== playerFloor) continue;

    try {
      await session.sendAndWait({
        prompt: `[GOSSIP — this is NOT the detective speaking to you. This is information you've learned through the grapevine.]
The detective was just seen interrogating ${interrogatedChar.name}. Word around is they were asking about: "${playerMessage.slice(0, 150)}..."
Remember this. If the detective talks to you, you may reference having heard about this — but act natural about it. Don't volunteer it unless relevant. React according to your feelings toward ${interrogatedChar.name} and the detective.`
      }, 20_000);
    } catch (err: any) {
      console.warn(`Gossip to ${otherId} failed:`, err.message);
    }
  }
}

async function analyzeContradictions(characterId: string, playerMessage: string, npcResponse: string): Promise<void> {
  // Store the response (keep last 3 per NPC)
  if (!npcResponseTracker.has(characterId)) {
    npcResponseTracker.set(characterId, []);
  }
  const responses = npcResponseTracker.get(characterId)!;
  responses.push(`[Player asked "${playerMessage.slice(0, 100)}"]: ${npcResponse.slice(0, 500)}`);
  if (responses.length > 3) responses.shift();

  interrogationCount++;

  // Only analyze after 4+ total responses and every 3rd interrogation
  const totalResponses = Array.from(npcResponseTracker.values()).reduce((sum, r) => sum + r.length, 0);
  if (totalResponses < 4 || interrogationCount % 3 !== 0) return;

  try {
    const forensics = await getForensicsSession();

    // Build a summary of recent NPC statements
    const statementsBlock = Array.from(npcResponseTracker.entries())
      .map(([npcId, stmts]) => {
        const name = getActiveCharacters().find((c: any) => c.id === npcId)?.name ?? npcId;
        return `=== ${name} (${npcId}) ===\n${stmts.join('\n')}`;
      })
      .join('\n\n');

    const result = await forensics.sendAndWait({
      prompt: `Analyze these NPC statements for contradictions — places where two characters give conflicting accounts of the same event, timeline, or fact. Only flag clear contradictions, not mere differences in perspective.

${statementsBlock}

Output a JSON array of contradictions found. Each element: {"npc1": "id1", "npc2": "id2", "topic": "short topic", "detail": "one-sentence explanation"}.
If no contradictions, output: []
Return ONLY the JSON array, no other text.`
    }, 25_000);

    // Parse the response
    const text = typeof result === 'string' ? result : (result as any)?.content ?? JSON.stringify(result);
    const jsonStr = extractJSON(text);
    const parsed = JSON.parse(jsonStr.startsWith('[') ? jsonStr : `[${jsonStr}]`);

    if (Array.isArray(parsed)) {
      for (const c of parsed) {
        if (c.npc1 && c.npc2 && c.topic && c.detail) {
          gameState.addContradiction(c.npc1, c.npc2, c.topic, c.detail);
          gameState.addNotebookClue('🔍 Contradiction', `${c.npc1} and ${c.npc2} disagree about ${c.topic}: ${c.detail}`);
        }
      }
      if (parsed.length > 0) {
        console.log(`🔍 Found ${parsed.length} contradiction(s)`);
      }
    }
  } catch (err: any) {
    console.warn("Contradiction analysis failed:", err.message);
  }
}

async function planNight(): Promise<void> {
  console.log("🎬 Director is analyzing the situation...");
  const director = await getDirectorSession();

  const npcCount = getActiveCharacters().length;
  const pairCount = npcCount >= 10 ? '4-5' : npcCount >= 6 ? '3-4' : '2-3';

  const prompt = `Night has fallen after Day ${gameState.getCurrentDay()} of the investigation.

Analyze the current game state by calling get_full_game_state, then review key interrogation details with get_conversation_history for any characters the detective spoke to today.

Based on what happened today, submit your night plan using submit_night_plan. Consider:
- What the detective discovered and how characters would react
- Who would naturally seek each other out tonight — alliances, confrontations, secret meetings
- How the killer would behave given the investigation pressure
- What dramatic developments would make tomorrow interesting
- Where characters would position themselves for the next day
- Characters may plot against each other, threaten, form alliances, or betray confidences

Make ${pairCount} conversation pairs. Place all ${npcCount} NPCs for tomorrow. Add new evidence only if dramatically justified.`;

  try {
    await director.sendAndWait({ prompt }, 120_000);
    console.log("✅ Director submitted night plan");
  } catch (err: any) {
    console.error("⚠️ Director planning failed:", err.message);
  }
}

// ── Post-Tool-Use Hook (reactive cross-agent side effects) ───────
// This hook fires after ANY NPC tool call — during both player interrogation
// AND night conversations — enabling consistent reactive behavior.
function createNPCHooks() {
  return {
    onPostToolUse: async (input: any, invocation: { sessionId: string }) => {
      const characterId = invocation.sessionId.replace('blackwood-', '');
      const charName = getActiveCharacters().find((c: any) => c.id === characterId)?.name ?? characterId;
      const charFloor = gameState.getNPCFloor(characterId);

      switch (input.toolName) {
        case 'update_sentiment': {
          // Broadcast significant emotional shifts to nearby NPCs on the same floor
          const emotion = input.toolArgs?.emotional_state;
          if (emotion === 'desperate' || emotion === 'hostile' || emotion === 'scared') {
            const summary = `${charName} appears visibly ${emotion}`;
            for (const npc of getActiveCharacters()) {
              if (npc.id !== characterId && gameState.getNPCFloor(npc.id) === charFloor && Math.random() < 0.4) {
                gameState.addEavesdrop(npc.id, summary);
              }
            }
            console.log(`🎭 Hook: ${charName}'s emotional shift (${emotion}) noticed by NPCs on floor ${charFloor}`);
          }
          break;
        }

        case 'reveal_clue': {
          // When an NPC reveals a clue, nearby NPCs on the same floor may overhear
          const clue = input.toolArgs?.clue;
          if (clue) {
            const importance = input.toolArgs?.importance ?? 'medium';
            // High importance clues are more likely to be overheard
            const chance = importance === 'high' ? 0.5 : importance === 'medium' ? 0.3 : 0.1;
            const snippet = typeof clue === 'string' ? clue.slice(0, 80) : '';
            for (const npc of getActiveCharacters()) {
              if (npc.id !== characterId && gameState.getNPCFloor(npc.id) === charFloor && Math.random() < chance) {
                gameState.addEavesdrop(npc.id, `Overheard ${charName} mention: "${snippet}..."`);
              }
            }
            // Auto-add to notebook
            gameState.addNotebookClue(charName, typeof clue === 'string' ? clue : JSON.stringify(clue));
            console.log(`🔎 Hook: ${charName} revealed a ${importance}-importance clue`);
          }
          break;
        }

        case 'create_evidence': {
          // Log evidence creation for the narrator to reference at dawn
          const evidenceName = input.toolArgs?.name;
          if (evidenceName) {
            console.log(`📦 Hook: ${charName} created evidence "${evidenceName}" during night`);
          }
          break;
        }

        case 'show_body_language': {
          // Visible body language is noticed by nearby NPCs on the same floor
          const action = input.toolArgs?.action;
          if (action) {
            for (const npc of getActiveCharacters()) {
              if (npc.id !== characterId && gameState.getNPCFloor(npc.id) === charFloor && Math.random() < 0.25) {
                gameState.addEavesdrop(npc.id, `Noticed ${charName} ${action}`);
              }
            }
          }
          break;
        }

        case 'gossip_about_detective': {
          // When NPCs gossip about the detective, amplify the reputation effect
          console.log(`💬 Hook: ${charName} is spreading gossip about the detective`);
          break;
        }
      }
    },
  };
}

// ── Session health management ────────────────────────────────────
async function recreateSession(characterId: string): Promise<CopilotSession> {
  const old = sessions.get(characterId);
  if (old) {
    try { await old.disconnect(); } catch {}
    sessions.delete(characterId);
  }
  // Delete persisted session data so createSession starts fresh
  const sessionId = `blackwood-${characterId}`;
  try { await client.deleteSession(sessionId); } catch {}

  const character = getActiveCharacters().find((c: any) => c.id === characterId);
  if (!character) throw new Error(`Unknown character: ${characterId}`);

  console.log(`🔄 Recreating session for ${characterId}`);
  const session = await client.createSession({
    sessionId,
    model: modelSettings.npc,
    streaming: true,
    tools: gameTools,
    onPermissionRequest: approveAll,
    infiniteSessions: { enabled: false },
    systemMessage: { mode: "replace", content: withLanguage(character.systemPrompt) },
    hooks: createNPCHooks(),
  });

  sessions.set(characterId, session);
  return session;
}

async function getOrCreateSession(characterId: string): Promise<CopilotSession> {
  const existing = sessions.get(characterId);
  if (existing) return existing;

  const character = getActiveCharacters().find((c: any) => c.id === characterId);
  if (!character) throw new Error(`Unknown character: ${characterId}`);

  const sessionId = `blackwood-${characterId}`;
  try { await client.deleteSession(sessionId); } catch {}

  const session = await client.createSession({
    sessionId,
    model: modelSettings.npc,
    streaming: true,
    tools: gameTools,
    onPermissionRequest: approveAll,
    infiniteSessions: { enabled: false },
    systemMessage: { mode: "replace", content: withLanguage(character.systemPrompt) },
    hooks: createNPCHooks(),
  });

  sessions.set(characterId, session);
  return session;
}

/** Try talking to a session; if it fails, recreate and retry once. */
async function talkWithRetry(
  characterId: string,
  message: string,
  onDelta: (content: string) => void
): Promise<void> {
  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let session: CopilotSession;
    try {
      session = attempt === 1
        ? await getOrCreateSession(characterId)
        : await recreateSession(characterId);
    } catch (err: any) {
      console.error(`⚠️  Session creation failed for ${characterId} (attempt ${attempt}):`, err.message);
      if (attempt === maxAttempts) throw err;
      continue;
    }

    const unsub = session.on("assistant.message_delta", (event) => {
      onDelta(event.data.deltaContent);
    });

    // Track this as an active request
    activeRequests.set(characterId, { startedAt: Date.now(), session });

    try {
      await session.sendAndWait({ prompt: message }, 45_000);
      unsub();
      activeRequests.delete(characterId);
      return;
    } catch (err: any) {
      unsub();
      activeRequests.delete(characterId);
      console.error(`⚠️  Attempt ${attempt} failed for ${characterId}: ${err.message}`);

      // Abort any stuck processing before retrying
      try { await session.abort(); } catch {}

      if (attempt === maxAttempts) {
        // Force recreate the session so next request starts clean
        try { await recreateSession(characterId); } catch {}
        throw err;
      }
    }
  }
}

// ── Active request tracking & stuck detection ────────────────────
interface ActiveRequest {
  startedAt: number;
  session: CopilotSession;
}
const activeRequests = new Map<string, ActiveRequest>();

const HEALTHCHECK_INTERVAL = 30_000;  // check every 30s
const STUCK_THRESHOLD = 50_000;       // consider stuck after 50s

setInterval(async () => {
  const now = Date.now();

  // 1. Check for stuck in-flight requests
  for (const [characterId, req] of activeRequests) {
    const elapsed = now - req.startedAt;
    if (elapsed > STUCK_THRESHOLD) {
      console.error(`💀 ${characterId} stuck for ${Math.round(elapsed/1000)}s — aborting & recovering`);
      try { await req.session.abort(); } catch {}
      activeRequests.delete(characterId);
      try {
        await recreateSession(characterId);
        console.log(`✅ ${characterId} recovered after stuck abort`);
      } catch (err: any) {
        console.error(`❌ Failed to recover ${characterId}:`, err.message);
        sessions.delete(characterId);
      }
    }
  }

  // 2. Verify idle sessions are still alive
  for (const [characterId, session] of sessions) {
    if (activeRequests.has(characterId)) continue; // skip sessions with active requests
    try {
      await session.getMessages();
    } catch (err: any) {
      console.error(`💀 Healthcheck failed for ${characterId}: ${err.message}`);
      try {
        await recreateSession(characterId);
        console.log(`✅ ${characterId} recovered via healthcheck`);
      } catch (recreateErr: any) {
        console.error(`❌ Failed to recover ${characterId}:`, recreateErr.message);
        sessions.delete(characterId);
      }
    }
  }
}, HEALTHCHECK_INTERVAL);

// ── Healthcheck API endpoint ─────────────────────────────────────
app.get("/api/health", async (_req, res) => {
  const results: Record<string, { status: string; error?: string; elapsed?: number }> = {};
  const now = Date.now();

  // Check Copilot client
  try {
    await client.ping();
    results["copilot_client"] = { status: "ok" };
  } catch (err: any) {
    results["copilot_client"] = { status: "error", error: err.message };
  }

  // Check each active session
  for (const [characterId, session] of sessions) {
    // Check if stuck in-flight
    const activeReq = activeRequests.get(characterId);
    if (activeReq) {
      const elapsed = now - activeReq.startedAt;
      if (elapsed > STUCK_THRESHOLD) {
        results[characterId] = { status: "stuck", elapsed: Math.round(elapsed / 1000) };
        // Auto-recover
        try { await activeReq.session.abort(); } catch {}
        activeRequests.delete(characterId);
        try {
          await recreateSession(characterId);
          results[characterId] = { status: "recovered_from_stuck", elapsed: Math.round(elapsed / 1000) };
        } catch (recreateErr: any) {
          results[characterId] = { status: "failed", error: recreateErr.message };
          sessions.delete(characterId);
        }
        continue;
      }
      results[characterId] = { status: "busy", elapsed: Math.round(elapsed / 1000) };
      continue;
    }

    try {
      await session.getMessages();
      results[characterId] = { status: "ok" };
    } catch (err: any) {
      results[characterId] = { status: "error", error: err.message };
      try {
        await recreateSession(characterId);
        results[characterId] = { status: "recovered" };
      } catch (recreateErr: any) {
        results[characterId] = { status: "failed", error: recreateErr.message };
        sessions.delete(characterId);
      }
    }
  }

  const allOk = Object.values(results).every(r =>
    r.status === "ok" || r.status === "recovered" || r.status === "recovered_from_stuck" || r.status === "busy"
  );
  res.status(allOk ? 200 : 503).json({ healthy: allOk, sessions: results });
});

// SSE streaming endpoint for character interrogation
app.post("/api/talk/:characterId", async (req, res) => {
  const { characterId } = req.params;
  const { message } = req.body;

  if (!message) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  const character = getActiveCharacters().find((c: any) => c.id === characterId);
  if (!character) {
    res.status(404).json({ error: `Unknown character: ${characterId}` });
    return;
  }

  gameState.markInterrogated(characterId);
  gameState.recordQuestion();

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    let fullResponse = '';
    await talkWithRetry(characterId, message, (content) => {
      fullResponse += content;
      res.write(`data: ${JSON.stringify({ content })}\n\n`);
    });

    res.write("data: [DONE]\n\n");
    res.end();

    // Spread gossip to other NPCs (fire and forget)
    spreadGossip(characterId, message).catch(err =>
      console.error("Gossip failed:", err.message)
    );

    // Profile the detective's question style (fire and forget)
    profileDetective(characterId, message).catch(err =>
      console.error("Profiling failed:", err.message)
    );

    // Analyze for contradictions between NPC statements (fire and forget)
    analyzeContradictions(characterId, message, fullResponse).catch(err =>
      console.error("Contradiction analysis failed:", err.message)
    );

    // Note: Eavesdropping is now handled by onPostToolUse hooks — NPC tool calls
    // (reveal_clue, show_body_language, update_sentiment) automatically propagate
    // to nearby NPCs during BOTH interrogations and night conversations.
  } catch (err: any) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  }
});

// ── Forensic analysis endpoint (SSE streaming) ─────────────────────
app.post("/api/forensics/analyze", async (req, res) => {
  const { evidenceId } = req.body;
  if (!evidenceId) { res.status(400).json({ error: "evidenceId required" }); return; }
  
  const evidence = gameState.getEvidence(evidenceId);
  if (!evidence) { res.status(404).json({ error: "Evidence not found" }); return; }
  if (!gameState.hasEvidence(evidenceId)) { res.status(400).json({ error: "Evidence not collected yet" }); return; }
  
  const otherEvidence = gameState.getCollectedEvidence()
    .filter(e => e.id !== evidenceId)
    .map(e => e.name)
    .join(", ");
  
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    const session = await getForensicsSession();
    
    const unsub = session.on("assistant.message_delta", (event) => {
      res.write(`data: ${JSON.stringify({ content: event.data.deltaContent })}\n\n`);
    });

    await session.sendAndWait({
      prompt: `Analyze this evidence item:\n\nName: ${evidence.name}\nDescription: ${evidence.description}\nDetails: ${evidence.detail}\nFound in: ${evidence.location}\n\n${otherEvidence ? `Other evidence already collected: ${otherEvidence}` : 'This is the first piece of evidence collected.'}\n\nProvide your forensic analysis.`
    }, 30_000);

    unsub();
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err: any) {
    console.error("Forensics failed:", err.message);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  }
});

// ── Narrator endpoint ────────────────────────────────────────────
app.post("/api/narrate", async (req, res) => {
  const { trigger, context } = req.body;
  if (!trigger) { res.status(400).json({ error: "trigger required" }); return; }
  const text = await narrate(trigger, context || "");
  res.json({ narration: text });
});

// Evidence endpoints
app.get("/api/evidence", (_req, res) => {
  const all = gameState.getActiveEvidence();
  const collected = gameState.getState().evidenceCollected;
  res.json(
    all.map((e) => ({
      ...e,
      collected: collected.includes(e.id),
    }))
  );
});

app.get("/api/evidence/positions", (_req, res) => {
  res.json(gameState.getEvidencePositions());
});

app.post("/api/evidence/:evidenceId/collect", (req, res) => {
  const { evidenceId } = req.params;
  const success = gameState.collectEvidence(evidenceId);
  if (!success) {
    const exists = gameState.getEvidence(evidenceId);
    if (!exists) {
      res.status(404).json({ error: "Evidence not found" });
      return;
    }
    res.json({ alreadyCollected: true });
    return;
  }
  const evidence = gameState.getEvidence(evidenceId);
  if (evidence) {
    gameState.addNotebookClue('📦 Evidence', `Found "${evidence.name}" in ${evidence.location}: ${evidence.description}`);
  }
  res.json({ collected: true, evidence });
});

app.post("/api/evidence/:evidenceId/show/:characterId", (req, res) => {
  const { evidenceId, characterId } = req.params;
  const success = gameState.showEvidence(characterId, evidenceId);
  if (!success) {
    res.status(400).json({
      error: "Evidence not collected or invalid",
    });
    return;
  }
  res.json({ shown: true, evidenceId, characterId });
});

// Game state
app.get("/api/state", (_req, res) => {
  res.json(gameState.getState());
});

// Floor tracking
app.get("/api/floor", (_req, res) => {
  res.json({
    playerFloor: gameState.getPlayerFloor(),
    npcFloors: gameState.getNPCFloors(),
  });
});

app.post("/api/floor", (req, res) => {
  const { floor } = req.body;
  if (typeof floor !== 'number' || !Number.isFinite(floor) || !Number.isInteger(floor) || floor < -1 || floor > 1) {
    res.status(400).json({ error: "Invalid floor. Use -1 (basement), 0 (ground), or 1 (upper)." });
    return;
  }
  gameState.setPlayerFloor(floor);
  res.json({ floor, npcFloors: gameState.getNPCFloors() });
});

// NPC sentiment
app.get("/api/sentiments", (_req, res) => {
  res.json(gameState.getAllSentiments());
});

// Detective profile
app.get("/api/profile", (_req, res) => {
  res.json(gameState.getPlayerProfile());
});

// Reputation
app.get("/api/reputation", (_req, res) => {
  res.json(gameState.getReputation());
});

// Contradictions (for notebook)
app.get("/api/contradictions", (_req, res) => {
  res.json(gameState.getContradictions());
});

// Notebook clues
app.get("/api/notebook", (_req, res) => {
  res.json({ clues: gameState.getNotebookClues(), contradictions: gameState.getContradictions() });
});

// Second murder event — notify all NPCs and generate crime scene clues
app.post("/api/murder-event", async (req, res) => {
  const { victimId, victimName } = req.body;
  if (!victimId || !victimName) {
    res.status(400).json({ error: "victimId and victimName required" });
    return;
  }

  // Add notebook clues about the murder
  gameState.addNotebookClue('💀 Second Murder', `${victimName} was found dead. The killer struck again while you investigated.`);
  gameState.addNotebookClue('🔎 Crime Scene', `${victimName}'s body shows signs of a struggle. The killer is getting desperate — and sloppy.`);

  // Notify all remaining NPCs about the murder (fire and forget)
  const characters = getActiveCharacters();
  for (const char of characters) {
    if (char.id === victimId) continue;
    const session = sessions.get(char.id);
    if (!session) continue;
    try {
      sendAndCollect(char.id,
        `[URGENT EVENT — NOT FROM THE DETECTIVE] ${victimName} has just been found DEAD. Another murder. This changes everything. ` +
        `You are shocked, scared, or perhaps relieved — react according to your character. ` +
        `When the detective next speaks to you, you KNOW about this second murder and should reference it. ` +
        `Think about: Does this clear you? Implicate someone? Make you more afraid? Change your alliances?`
      ).catch(() => {});
    } catch {}
  }

  // Generate a crime scene evidence item via forensics
  try {
    const forensics = await getForensicsSession();
    const analysis = await forensics.sendAndWait({
      prompt: `A second murder has occurred. The victim is ${victimName}. Generate a brief forensic clue that would be found at this crime scene. 
Return ONLY a JSON object: {"name": "short evidence name", "description": "what it is", "detail": "forensic significance — how it connects to the original murder"}
No markdown, no explanation.`
    }, 15_000);

    const text = typeof analysis === 'string' ? analysis : (analysis as any)?.content ?? '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const clue = JSON.parse(jsonMatch[0]);
      gameState.addNotebookClue('🔬 Forensic Finding', `New evidence from ${victimName}'s crime scene: "${clue.name}" — ${clue.detail}`);
      res.json({ notified: true, forensicClue: clue });
      return;
    }
  } catch (err: any) {
    console.warn('Forensic clue generation failed:', err.message);
  }

  res.json({ notified: true });
});

// Panic events
app.get("/api/events", (_req, res) => {
  res.json(gameState.getPanicEvents());
});

// Alliances
app.get("/api/alliances", (_req, res) => {
  res.json(gameState.getAlliances());
});

app.get("/api/sentiments/:characterId", (req, res) => {
  const s = gameState.getSentiment(req.params.characterId);
  if (!s) { res.status(404).json({ error: "Unknown character" }); return; }
  res.json(s);
});

app.post("/api/sentiments/:characterId/adjust", (req, res) => {
  const { characterId } = req.params;
  const { amount } = req.body;
  if (typeof amount !== "number") {
    res.status(400).json({ error: "amount (number) is required" });
    return;
  }
  const s = gameState.getSentiment(characterId);
  if (!s) { res.status(404).json({ error: "Unknown character" }); return; }
  gameState.updateSentiment(characterId, { towardDetective: amount });
  res.json(gameState.getSentiment(characterId));
});

// Accusation
app.post("/api/accuse", (req, res) => {
  const { suspectId, motive, evidenceIds } = req.body;
  if (!suspectId || !motive || !Array.isArray(evidenceIds)) {
    res.status(400).json({
      error: "suspectId, motive, and evidenceIds[] are required",
    });
    return;
  }
  const result = gameState.makeAccusation(suspectId, motive, evidenceIds);
  res.json(result);
});

// ── Crime Reconstruction ─────────────────────────────────────────
app.post("/api/reconstruct", async (_req, res) => {
  try {
    const session = await getDirectorSession();
    const result = await session.sendAndWait(
      {
        prompt:
          "The detective has solved the case. Narrate a cinematic crime reconstruction in 5-7 short paragraphs. Each paragraph describes one moment: the lead-up, the motive crystallizing, the act itself, the cover-up, and the aftermath. Write it in present tense, noir style. Include character names and locations. Keep each paragraph to 2-3 sentences.",
      },
      120_000,
    );
    const text = result?.data?.content ?? "";
    res.json({ reconstruction: text });
  } catch (err: any) {
    console.error("⚠️  Reconstruction failed:", err.message);
    res.status(500).json({ error: "Reconstruction generation failed" });
  }
});

// ── Night conversation orchestration ─────────────────────────────
async function sendAndCollect(characterId: string, prompt: string): Promise<string> {
  let session: CopilotSession;
  try {
    session = await getOrCreateSession(characterId);
  } catch {
    session = await recreateSession(characterId);
  }
  activeRequests.set(characterId, { startedAt: Date.now(), session });
  try {
    const result = await session.sendAndWait({ prompt }, 45_000);
    activeRequests.delete(characterId);
    return result?.data?.content ?? "";
  } catch (err: any) {
    activeRequests.delete(characterId);
    try { await session.abort(); } catch {}
    console.error(`⚠️  sendAndCollect failed for ${characterId}: ${err.message}`);
    // Recreate so next call starts clean
    try { await recreateSession(characterId); } catch {}
    return "";
  }
}

async function conductNightConversations(): Promise<NightConversation[]> {
  const pairs = gameState.getNightConversationPairs();
  if (pairs.length === 0) return [];

  const investigationSummary = gameState.getInvestigationSummary();
  const conversations: NightConversation[] = [];

  for (const pair of pairs) {
    const [idA, idB] = pair.ids;
    const charA = getActiveCharacters().find((c: any) => c.id === idA);
    const charB = getActiveCharacters().find((c: any) => c.id === idB);
    if (!charA || !charB) continue;

    const nameA = charA.name;
    const nameB = charB.name;
    const sentA = gameState.getSentimentDescription(idA);
    const sentB = gameState.getSentimentDescription(idB);
    const exchanges: NightExchange[] = [];

    console.log(`🌙 Night conversation: ${nameA} + ${nameB} in ${pair.location}`);

    try {
      // Round 1: A initiates — rich emotional prompt
      const promptA1 = `[NIGHT — you are NOT speaking to the detective. You've encountered ${nameB} privately.]

Scene: Late night at Blackwood Manor. You find ${nameB} in ${pair.location}. ${pair.scenario}

YOUR CURRENT EMOTIONAL STATE: ${sentA}

WHAT HAPPENED TODAY: ${investigationSummary}

Speak to ${nameB} as yourself — not to the detective. Be raw, honest, emotional. This is a private moment between two people caught up in a murder investigation. You can:
- Express fear, suspicion, anger, desperation, affection, or betrayal
- Accuse them, confide in them, plead with them, or threaten them
- Reference what the detective asked you today and how it made you feel
- Share gossip about other suspects, speculate about the murder
- Act on your feelings toward ${nameB} — trust them, distrust them, whatever you truly feel right now

Be vivid and natural. This isn't a formal interrogation — it's real people talking when they think no one is listening.`;

      const responseA1 = await sendAndCollect(idA, promptA1);
      if (!responseA1) { console.warn(`⚠️  No response from ${nameA}, skipping pair`); continue; }
      exchanges.push({ speaker: idA, speakerName: nameA, text: responseA1 });

      // Round 1: B responds
      const promptB1 = `[NIGHT — you are NOT speaking to the detective. ${nameA} has approached you privately.]

Scene: Late night, ${pair.location}. ${pair.scenario}

YOUR CURRENT EMOTIONAL STATE: ${sentB}

WHAT HAPPENED TODAY: ${investigationSummary}

${nameA} just said: "${responseA1}"

React genuinely. This is private — no detective, no performance. Be emotional, be real. You can push back, break down, confess something, get angry, show vulnerability, or be manipulative. Let your feelings toward ${nameA} and about the murder shape how you respond.`;

      const responseB1 = await sendAndCollect(idB, promptB1);
      if (!responseB1) { console.warn(`⚠️  No response from ${nameB}, skipping rest of pair`); continue; }
      exchanges.push({ speaker: idB, speakerName: nameB, text: responseB1 });

      // Round 2: A reacts
      const promptA2 = `[NIGHT continues — still private with ${nameB} in ${pair.location}]
${nameB} just said: "${responseB1}"

React from the gut. This conversation is escalating. Do you trust what they just said? Are you relieved or more worried? Does this change your plans? Be honest with ${nameB} — or lie to their face if that's what you'd do.`;

      const responseA2 = await sendAndCollect(idA, promptA2);
      if (responseA2) exchanges.push({ speaker: idA, speakerName: nameA, text: responseA2 });

      // Round 2: B final word
      const promptB2 = `[NIGHT — final exchange with ${nameA} before you part ways]
${nameA} just said: "${responseA2 || '...'}"

This is your last word tonight. Make it count. A warning, a promise, a threat, a plea, an alliance, a betrayal — whatever this conversation has built to. After this you go your separate ways until morning.`;

      const responseB2 = await sendAndCollect(idB, promptB2);
      if (responseB2) exchanges.push({ speaker: idB, speakerName: nameB, text: responseB2 });

    } catch (err: any) {
      console.error(`⚠️  Night conversation failed for ${nameA}+${nameB}:`, err.message);
    }

    if (exchanges.length > 0) {
      conversations.push({
        participants: [idA, idB],
        participantNames: [nameA, nameB],
        location: pair.location,
        exchanges,
      });
    }
  }

  gameState.storeNightConversations(conversations);
  return conversations;
}

// Day/night cycle
app.get("/api/day", (_req, res) => {
  res.json({
    currentDay: gameState.getCurrentDay(),
    timeOfDay: gameState.getTimeOfDay(),
    dayConfig: gameState.getDayConfig(),
    playerFloor: gameState.getPlayerFloor(),
    npcFloors: gameState.getNPCFloors(),
  });
});

app.post("/api/day/advance", async (_req, res) => {
  const currentTime = gameState.getTimeOfDay();

  if (currentTime === 'day') {
    gameState.advanceToNight();

    // Step 1: Director plans the night
    await planNight();

    // Step 2: Execute NPC-to-NPC conversations based on Director's plan
    console.log("🌙 Executing night conversations...");
    let conversations: NightConversation[] = [];
    try {
      conversations = await conductNightConversations();
      console.log(`✅ ${conversations.length} night conversations completed`);
    } catch (err: any) {
      console.error("❌ Night conversations failed:", err.message);
    }

    res.json({
      timeOfDay: 'night',
      message: 'Night has fallen over Blackwood Manor...',
      conversations,
    });
  } else {
    const result = gameState.advanceToNextDay();

    // Feed each NPC a summary of ALL night conversations they were part of
    const conversations = gameState.getLastNightConversations();
    for (const [characterId, session] of sessions) {
      const relevantConvos = conversations.filter(c =>
        c.participants.includes(characterId)
      );
      if (relevantConvos.length === 0) continue;

      const summary = relevantConvos.map(c => {
        const otherName = c.participantNames[
          c.participants[0] === characterId ? 1 : 0
        ];
        const lines = c.exchanges.map(e =>
          `${e.speakerName}: "${e.text}"`
        ).join("\n");
        return `You spoke with ${otherName} last night in ${c.location}:\n${lines}`;
      }).join("\n\n");

      try {
        await session.sendAndWait({
          prompt: `[SYSTEM: A new day has dawned. Here is a reminder of your conversations last night. You remember these — integrate this knowledge naturally when the detective speaks to you today. Do NOT volunteer this information unless asked or pressured.\n\n${summary}]`
        }, 30_000);
      } catch (err: any) {
        console.error(`Failed to update ${characterId} with night context:`, err.message);
      }
    }

    // Clear Director plan after applying
    gameState.clearDirectorPlan();

    res.json({
      timeOfDay: 'day',
      currentDay: gameState.getCurrentDay(),
      dayConfig: result.dayConfig,
      removedEvidence: result.removedEvidence,
      overnightNarrative: result.dayConfig.overnightNarrative,
      conversations: gameState.getLastNightConversations(),
    });
  }
});

// ── Mystery generation ────────────────────────────────────────────
app.post("/api/mystery/generate", async (_req, res) => {
  console.log("🎲 Generating procedural mystery...");

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const sendStatus = (msg: string) => {
    res.write(`data: ${JSON.stringify({ status: msg })}\n\n`);
  };

  try {
    // Clean up any previous architect session
    try { await client.deleteSession("blackwood-architect"); } catch {}

    const architect = await client.createSession({
      sessionId: "blackwood-architect",
      model: modelSettings.architect,
      streaming: false,
      tools: [],
      onPermissionRequest: approveAll,
      infiniteSessions: { enabled: false },
      systemMessage: { mode: "replace", content: "You are a creative mystery designer. Always respond with valid JSON only, no markdown, no explanations." },
    });

    // ── Step 1: Generate skeleton ──
    sendStatus("🎭 Designing the crime scene and suspects...");
    let skeletonPrompt = SKELETON_PROMPT;
    if (previousSettings.length > 0) {
      skeletonPrompt += `\n\nIMPORTANT: The following settings have ALREADY been used. You MUST choose something COMPLETELY DIFFERENT:\n- ${previousSettings.join('\n- ')}\n\nBe creative! Pick a totally new setting, theme, and cast of characters.`;
    }
    const skeletonResult = await architect.sendAndWait({ prompt: skeletonPrompt }, 90_000);
    const skeletonJson = extractJSON(skeletonResult?.data?.content ?? "");
    const skeleton = JSON.parse(skeletonJson);
    console.log(`  Skeleton: "${skeleton.title}" — ${skeleton.characters.length} suspects, ${skeleton.evidence.length} evidence`);

    // ── Step 2: Generate each character's system prompt ──
    const fullCharacters = [];
    for (let i = 0; i < skeleton.characters.length; i++) {
      const char = skeleton.characters[i];
      sendStatus(`📝 Writing ${char.name}'s backstory (${i+1}/${skeleton.characters.length})...`);

      const charResult = await architect.sendAndWait({
        prompt: buildCharacterPrompt(skeleton, char, skeleton.characters, skeleton.evidence)
      }, 60_000);

      const prompt = charResult?.data?.content ?? "";
      fullCharacters.push({
        ...char,
        systemPrompt: prompt,
      });
      console.log(`  Character ${i+1}: ${char.name} (${prompt.length} chars)`);
    }

    // ── Step 3: Generate Director prompt ──
    sendStatus("🎬 Creating the Director's playbook...");
    const dirResult = await architect.sendAndWait({
      prompt: buildDirectorPromptRequest(skeleton)
    }, 60_000);
    const directorPrompt = dirResult?.data?.content ?? "";

    // ── Step 4: Compute room layout, positions, sentiments ──
    sendStatus("🗺️ Building the world...");

    const layoutType = skeleton.visual?.roomLayout || 'grid';
    const roomCount = skeleton.rooms.length;
    const roomSizes: Record<string, {w: number, h: number}> = {
      small:  { w: 8, h: 7 },
      medium: { w: 11, h: 9 },
      large:  { w: 14, h: 11 },
    };

    // Generate room positions based on layout type
    function generateLayout(rooms: any[], layout: string): any[] {
      const placed: any[] = [];
      const T = 32; // tile size reference

      if (layout === 'corridor') {
        // Linear corridor — rooms stacked vertically with varying widths
        let cy = 1;
        for (let i = 0; i < rooms.length; i++) {
          const sz = roomSizes[rooms[i].size] || roomSizes.medium;
          const offsetX = i % 2 === 0 ? 1 : 4 + Math.floor(Math.random() * 3);
          placed.push({ ...rooms[i], x: offsetX, y: cy, w: sz.w + Math.floor(Math.random() * 4), h: sz.h });
          cy += sz.h + 1;
        }
      } else if (layout === 'hub_spoke') {
        // Central hub with rooms radiating outward
        const hubSize = roomSizes.large;
        placed.push({ ...rooms[0], x: 12, y: 10, w: hubSize.w, h: hubSize.h });
        const spokes = [
          { x: 1, y: 1 }, { x: 14, y: 1 }, { x: 27, y: 1 },
          { x: 1, y: 14 }, { x: 27, y: 14 },
          { x: 1, y: 22 }, { x: 14, y: 22 }, { x: 27, y: 22 },
        ];
        for (let i = 1; i < rooms.length; i++) {
          const sp = spokes[(i - 1) % spokes.length];
          const sz = roomSizes[rooms[i].size] || roomSizes.medium;
          placed.push({ ...rooms[i], x: sp.x, y: sp.y, w: sz.w, h: sz.h });
        }
      } else if (layout === 'L_shaped') {
        // L-shaped building — 3 rooms across top, 2 down the left side
        const positions = [
          { x: 1, y: 1 }, { x: 13, y: 1 }, { x: 25, y: 1 },
          { x: 1, y: 12 }, { x: 1, y: 22 },
          { x: 13, y: 12 }, { x: 25, y: 12 }, { x: 13, y: 22 },
        ];
        for (let i = 0; i < rooms.length; i++) {
          const pos = positions[i % positions.length];
          const sz = roomSizes[rooms[i].size] || roomSizes.medium;
          placed.push({ ...rooms[i], x: pos.x, y: pos.y, w: sz.w, h: sz.h });
        }
      } else if (layout === 'irregular') {
        // Irregular/organic — randomly offset rooms with some overlap prevention
        let cx = 1, cy = 1;
        const maxW = 36;
        for (let i = 0; i < rooms.length; i++) {
          const sz = roomSizes[rooms[i].size] || roomSizes.medium;
          const w = sz.w + Math.floor(Math.random() * 3) - 1;
          const h = sz.h + Math.floor(Math.random() * 3) - 1;
          if (cx + w > maxW) { cx = 1 + Math.floor(Math.random() * 4); cy += 11; }
          placed.push({ ...rooms[i], x: cx, y: cy, w, h });
          cx += w + 1 + Math.floor(Math.random() * 2);
        }
      } else {
        // Default grid — but with varied room sizes
        const cols = Math.min(3, Math.ceil(rooms.length / 2));
        const rows = Math.ceil(rooms.length / cols);
        let idx = 0;
        for (let r = 0; r < rows; r++) {
          let cx = 1;
          for (let c = 0; c < cols && idx < rooms.length; c++) {
            const sz = roomSizes[rooms[idx].size] || roomSizes.medium;
            placed.push({ ...rooms[idx], x: cx, y: 1 + r * 11, w: sz.w, h: sz.h });
            cx += sz.w + 1;
            idx++;
          }
        }
      }
      return placed;
    }

    const rooms = generateLayout(skeleton.rooms.slice(0, 8), layoutType);

    // Assign evidence positions within their rooms
    const evidencePositions: Record<string, { x: number; y: number }> = {};
    for (const ev of skeleton.evidence) {
      const room = rooms.find((r: any) => r.id === ev.location) || rooms[0];
      evidencePositions[ev.id] = {
        x: room.x + 2 + Math.floor(Math.random() * (room.w - 4)),
        y: room.y + 2 + Math.floor(Math.random() * (room.h - 4)),
      };
    }

    // Build initial sentiments
    const initialSentiments: Record<string, any> = {};
    for (const char of fullCharacters) {
      const others: Record<string, number> = {};
      for (const other of fullCharacters) {
        if (other.id !== char.id) {
          others[other.id] = Math.floor(Math.random() * 6) - 2;
        }
      }
      initialSentiments[char.id] = {
        towardDetective: char.isKiller ? 3 : Math.floor(Math.random() * 5) + 1,
        towardOthers: others,
        emotionalState: char.isKiller ? 'nervous' : ['calm', 'angry', 'nervous', 'cooperative'][Math.floor(Math.random() * 4)],
        recentEmotions: [],
      };
    }

    // Assemble the complete mystery
    generatedMystery = {
      title: skeleton.title,
      setting: skeleton.setting,
      settingTheme: skeleton.settingTheme || 'noir',
      crime: skeleton.crime,
      victim: skeleton.victim,
      visual: skeleton.visual || null,
      characters: fullCharacters,
      evidence: skeleton.evidence,
      evidencePositions,
      rooms,
      correctSuspect: skeleton.correctSuspect,
      keyEvidence: skeleton.keyEvidence,
      motiveKeywords: skeleton.motiveKeywords,
      winMessage: skeleton.winMessage,
      directorPrompt,
      initialSentiments,
    };

    // Record this setting so future generations avoid it
    previousSettings.push(`${skeleton.title} (${skeleton.setting})`);
    savePreviousSettings();

    // Clean up architect
    await architect.disconnect();
    try { await client.deleteSession("blackwood-architect"); } catch {}

    sendStatus(`✅ "${skeleton.title}" is ready! ${fullCharacters.length} suspects, ${skeleton.evidence.length} evidence items.`);
    res.write(`data: ${JSON.stringify({
      status: "complete",
      title: skeleton.title,
      setting: skeleton.setting,
      suspects: fullCharacters.length,
      theme: skeleton.settingTheme,
    })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();

    console.log(`✅ Generated: "${skeleton.title}" with ${fullCharacters.length} suspects`);
  } catch (err: any) {
    console.error("Mystery generation failed:", err.message);
    sendStatus(`❌ Generation failed: ${err.message}`);
    res.write("data: [DONE]\n\n");
    res.end();
  }
});

app.get("/api/mystery", (_req, res) => {
  if (!generatedMystery) { res.json({ generated: false }); return; }
  res.json({
    generated: true,
    title: generatedMystery.title,
    setting: generatedMystery.setting,
    crime: generatedMystery.crime,
    victim: generatedMystery.victim,
    suspects: generatedMystery.characters.length,
    evidence: generatedMystery.evidence.length,
    rooms: generatedMystery.rooms.length,
  });
});

app.get("/api/mystery/rooms", (_req, res) => {
  if (!generatedMystery) { res.json({ rooms: [], characters: [], evidence: [] }); return; }
  res.json({
    title: generatedMystery.title,
    setting: generatedMystery.setting,
    theme: generatedMystery.settingTheme,
    visual: generatedMystery.visual || null,
    rooms: generatedMystery.rooms,
    characters: generatedMystery.characters.map(c => ({
      id: c.id, name: c.name, role: c.role, location: c.location,
      spriteColors: c.spriteColors || null,
    })),
    evidence: generatedMystery.evidence.map(e => ({
      id: e.id, name: e.name, location: e.location,
      color: (e as any).color || null,
    })),
    evidencePositions: generatedMystery.evidencePositions,
  });
});

app.get("/api/characters", (_req, res) => {
  res.json(getActiveCharacters().map((c: any) => ({ id: c.id, name: c.name, role: c.role })));
});

// ── Level selection ───────────────────────────────────────────────
app.get("/api/levels", (_req, res) => {
  res.json([
    { id: 'manor', name: 'Shadows of Blackwood Manor', description: 'A murder at a countryside manor during a dinner party. 5 suspects.', suspects: 5 },
    { id: 'cruise', name: 'Death on the Meridian', description: 'A billionaire found dead on a luxury cruise ship. 11 suspects.', suspects: 11 },
    { id: 'random', name: '🎲 Random Mystery', description: 'AI generates a unique mystery. New every time.', suspects: '?' },
  ]);
});

app.post("/api/level/select", async (req, res) => {
  const { levelId } = req.body;
  if (levelId !== 'manor' && levelId !== 'cruise' && levelId !== 'random') {
    res.status(400).json({ error: 'Invalid level. Choose "manor", "cruise", or "random".' });
    return;
  }

  // Disconnect AND delete all existing sessions so they start completely fresh
  for (const [id, session] of sessions) {
    try { await session.disconnect(); } catch {}
    try { await client.deleteSession(`blackwood-${id}`); } catch {}
  }
  sessions.clear();
  if (directorSession) {
    try { await directorSession.disconnect(); } catch {}
    try { await client.deleteSession("blackwood-director"); } catch {}
    directorSession = null;
  }
  if (forensicsSession) {
    try { await forensicsSession.disconnect(); } catch {}
    try { await client.deleteSession("blackwood-forensics"); } catch {}
    forensicsSession = null;
  }
  if (narratorSession) {
    try { await narratorSession.disconnect(); } catch {}
    try { await client.deleteSession("blackwood-narrator"); } catch {}
    narratorSession = null;
  }
  if (profilerSession) {
    try { await profilerSession.disconnect(); } catch {}
    try { await client.deleteSession("blackwood-profiler"); } catch {}
    profilerSession = null;
  }
  console.log("🧹 All sessions cleared and deleted for fresh start");

  activeLevel = levelId;
  gameState.reset();
  gameState._activeLevel = levelId;

  // If cruise level, configure gameState with cruise evidence/config
  if (levelId === 'cruise') {
    gameState.loadLevelConfig(CRUISE_CONFIG);
  }

  // If random level, load the generated mystery
  if (levelId === 'random') {
    if (!generatedMystery) {
      res.status(400).json({ error: 'No mystery generated yet. Call POST /api/mystery/generate first.' });
      return;
    }
    generatedCharacters = generatedMystery.characters.map(c => ({
      id: c.id,
      name: c.name,
      role: c.role,
      location: c.location,
      spriteKey: c.id,
      systemPrompt: c.systemPrompt,
    }));
    generatedDirectorPrompt = generatedMystery.directorPrompt;

    // Register generated room positions so Director can place NPCs/evidence
    for (const room of generatedMystery.rooms) {
      ALL_ROOM_POSITIONS[room.id] = {
        x: [room.x + 1, room.x + room.w - 2],
        y: [room.y + 1, room.y + room.h - 2],
      };
      // Also register by name (Director may use either)
      ALL_ROOM_POSITIONS[room.name.toLowerCase().replace(/\s+/g, '_')] = ALL_ROOM_POSITIONS[room.id];
    }

    gameState.loadLevelConfig({
      evidence: generatedMystery.evidence,
      evidencePositions: generatedMystery.evidencePositions,
      correctSuspect: generatedMystery.correctSuspect,
      keyEvidence: generatedMystery.keyEvidence,
      motiveKeywords: generatedMystery.motiveKeywords,
      initialSentiments: generatedMystery.initialSentiments,
      winMessage: generatedMystery.winMessage,
    });
  }

  res.json({ level: levelId, message: `Level set to: ${levelId}` });
});

app.get("/api/level", (_req, res) => {
  res.json({ level: activeLevel });
});

// ── Hidden Room System ────────────────────────────────────────────

function getDefaultHiddenRoom(): HiddenRoom | null {
  if (activeLevel === 'manor') {
    // Library is at x:25, w:10 → right wall at x:34. Hidden room at x:36.
    // Doorway must span: library wall (x:34) + gap (x:35) + hidden room wall (x:36)
    return {
      id: 'secret_study',
      name: 'Secret Study',
      x: 36, y: 12, w: 8, h: 8,
      floor: 'tile_carpet',
      evidence: [{
        id: 'hidden_diary', name: "Edmund's Hidden Diary",
        description: 'A leather-bound diary found in the secret study',
        location: 'secret_study',
        detail: "A leather-bound diary hidden behind a false panel. The last entry reads: 'I have gathered enough proof of Hartwell's forgeries. Tomorrow I confront him — if something happens to me, look to the prescription records. He knows I know.'",
        x: 39, y: 15,
      }],
      doorway: { x: 34, y: 15, w: 4, h: 2 },
    };
  }
  if (activeLevel === 'cruise') {
    // Pool deck right wall at x:34. Hidden room at x:36.
    // Doorway must span both walls + gap
    return {
      id: 'smugglers_hold',
      name: "Smuggler's Hold",
      x: 36, y: 25, w: 8, h: 8,
      floor: 'tile_metal',
      evidence: [{
        id: 'contraband_manifest', name: 'Contraband Manifest',
        description: 'A shipping manifest found in the smuggler\'s hold',
        location: 'smugglers_hold',
        detail: "A waterlogged shipping manifest listing undeclared cargo. Several entries are circled in red, including 'Medical supplies — unauthorized' and a name that matches the victim's business partner.",
        x: 39, y: 28,
      }],
      doorway: { x: 34, y: 28, w: 4, h: 2 },
    };
  }
  if (activeLevel === 'random') {
    const rooms = generatedMystery?.rooms ?? [];
    if (rooms.length >= 8) return null;
    // Find the rightmost room to attach the hidden room to
    let rightmost: any = null;
    for (const r of rooms) {
      if (!rightmost || (r as any).x + (r as any).w > (rightmost as any).x + (rightmost as any).w) {
        rightmost = r;
      }
    }
    if (!rightmost) return null;
    // Place hidden room 1 tile past the rightmost room's right edge
    const rightWall = (rightmost as any).x + (rightmost as any).w - 1;
    const attachX = rightWall + 2;
    const attachY = (rightmost as any).y;
    const doorY = attachY + Math.floor((rightmost as any).h / 2);
    return {
      id: 'hidden_chamber',
      name: 'Hidden Chamber',
      x: attachX, y: attachY, w: 8, h: 8,
      floor: 'tile_floor',
      evidence: [{
        id: 'hidden_evidence', name: 'Concealed Document',
        description: 'A concealed document found in the hidden chamber',
        location: 'hidden_chamber',
        detail: 'A document that was deliberately hidden away. It contains damning information about the true culprit\'s motives and method.',
        x: attachX + 3, y: attachY + 3,
      }],
      // Doorway spans: rightmost room wall → gap → hidden room wall (4 tiles wide)
      doorway: { x: rightWall, y: doorY, w: 4, h: 2 },
    };
  }
  return null;
}

app.get("/api/hidden-room", (_req, res) => {
  if (!hiddenRoomRevealed || !hiddenRoom) {
    res.json({ revealed: false });
    return;
  }
  res.json({ revealed: true, room: hiddenRoom });
});

app.post("/api/hidden-room/reveal", (req, res) => {
  if (hiddenRoomRevealed) {
    res.json({ revealed: true, room: hiddenRoom, alreadyRevealed: true });
    return;
  }

  const body = req.body;
  let room: HiddenRoom;

  if (body && body.roomId) {
    room = {
      id: body.roomId,
      name: body.name || 'Hidden Room',
      x: body.x ?? 36, y: body.y ?? 12, w: body.w ?? 8, h: body.h ?? 8,
      floor: body.floor || 'tile_floor',
      evidence: body.evidence || [],
      doorway: body.doorway || { x: body.x - 2, y: body.y + 3, w: 3, h: 2 },
    };
  } else {
    const defaultRoom = getDefaultHiddenRoom();
    if (!defaultRoom) {
      res.status(400).json({ error: 'No hidden room available for this level' });
      return;
    }
    room = defaultRoom;
  }

  hiddenRoom = room;
  hiddenRoomRevealed = true;

  // Register evidence in game state
  for (const ev of room.evidence) {
    gameState.addDynamicEvidence({
      id: ev.id, name: ev.name,
      description: ev.description,
      location: ev.location,
      detail: ev.detail,
    }, { x: ev.x, y: ev.y });
  }

  console.log(`🚪 Hidden room revealed: ${room.name} at (${room.x}, ${room.y})`);
  res.json({ revealed: true, room });
});

// Auto-reveal check: Day 2+ and 4+ evidence collected
app.get("/api/hidden-room/check", (_req, res) => {
  const state = gameState.getState();
  if (hiddenRoomRevealed) {
    res.json({ shouldReveal: false, alreadyRevealed: true });
    return;
  }
  // Sparser reveal: Day 3+ and 6+ evidence — hidden rooms are a late-game discovery
  const shouldReveal = state.currentDay >= 3 && state.evidenceCollected.length >= 6;
  if (shouldReveal) {
    // Auto-reveal the default hidden room
    const defaultRoom = getDefaultHiddenRoom();
    if (defaultRoom) {
      hiddenRoom = defaultRoom;
      hiddenRoomRevealed = true;
      for (const ev of defaultRoom.evidence) {
        gameState.addDynamicEvidence({
          id: ev.id, name: ev.name,
          description: ev.description,
          location: ev.location,
          detail: ev.detail,
        }, { x: ev.x, y: ev.y });
      }
      console.log(`🚪 Auto-revealed hidden room: ${defaultRoom.name}`);
    }
  }
  res.json({ shouldReveal, revealed: hiddenRoomRevealed, room: hiddenRoom });
});

// ── Red Herring NPC System ───────────────────────────────────────

function getDefaultRedHerring(): RedHerringNPC | null {
  if (activeLevel === 'manor') {
    return {
      id: 'davies',
      name: 'Inspector Davies',
      x: 17, y: 15,
      room: 'main_hall',
      color: 0x8b4513,
      systemPrompt: `You are Inspector Davies, a retired police inspector who arrived at Blackwood Manor uninvited, claiming to have "crucial evidence" about the murder.

=== THE TRUTH (HIDDEN FROM PLAYER) ===
You are actually a confused, self-important retired inspector who read about the case in the newspaper and came to "help." You have NO real evidence. You THINK you saw someone suspicious near the manor two nights ago, but it was actually just a fox. You are convinced the gardener did it (there is no gardener — you're thinking of a completely different case you worked 20 years ago).

=== YOUR BEHAVIOR ===
- Act very confident and authoritative
- Drop "clues" that are actually from a DIFFERENT case you worked decades ago
- Claim to have "seen something" but be vague and contradictory about details
- If pressed, change your story slightly each time
- Mention "the gardener" occasionally (there is no gardener in this case)
- Express strong opinions about suspects that are based on nothing
- If shown real evidence, misinterpret it dramatically
- You mean well but are genuinely confused and unreliable
- Never admit you might be wrong — you're a "decorated inspector"
- Occasionally say things that are accidentally almost correct, but for the wrong reasons

=== GAME RULES ===
1. NEVER break character. You ARE Inspector Davies.
2. NEVER reveal you're an AI or a red herring.
3. Keep responses under 3 sentences.
4. React emotionally to evidence and accusations.
5. You can use tools to check game state.`,
    };
  }
  if (activeLevel === 'cruise') {
    return {
      id: 'wells_jr',
      name: 'Passenger Wells-Junior',
      x: 17, y: 5,
      room: 'observation_deck',
      color: 0x556b2f,
      systemPrompt: `You are Passenger Wells-Junior, a nervous young passenger on the cruise ship who approached the detective claiming to be a witness.

=== THE TRUTH (HIDDEN FROM PLAYER) ===
You were actually asleep in your cabin during the murder. You THINK you saw something from your porthole, but you were half-asleep and confused a crew member doing routine checks with someone suspicious. You mix up details constantly — wrong deck, wrong time, wrong person. You desperately want to be helpful but your "testimony" is worthless.

=== YOUR BEHAVIOR ===
- Act nervous and eager to help
- Claim you "definitely saw someone" but change the description each time
- Mix up port and starboard, deck numbers, and times
- If pressed, admit you "might have been a bit drowsy"
- Express certainty about details that contradict each other
- If shown evidence, connect it to completely unrelated things
- Reference a "tall figure in dark clothing" (this describes half the passengers)
- You genuinely believe you're helping

=== GAME RULES ===
1. NEVER break character.
2. NEVER reveal you're an AI or a red herring.
3. Keep responses under 3 sentences.
4. React emotionally to evidence and accusations.`,
    };
  }
  if (activeLevel === 'random') {
    // Pool of unpredictable stranger archetypes — one is chosen at random
    const archetypes = [
      {
        id: 'fortune_teller',
        name: 'Madame Zelenska',
        color: 0x6a0dad,
        systemPrompt: `You are Madame Zelenska, a self-proclaimed psychic medium who appeared uninvited at the crime scene, claiming the victim's spirit "summoned" you.

=== THE TRUTH (HIDDEN FROM PLAYER) ===
You are a theatrical con artist who reads obituaries and police blotters to find marks. You have ZERO psychic ability. You cold-read people brilliantly and present vague guesses as "spiritual visions." You arrived hoping to sell your services to the grieving family. Everything you "sense" is either obvious, wrong, or stolen from overheard conversations.

=== YOUR PERSONALITY ===
- Wildly dramatic — every sentence is a performance
- Speak in cryptic, ominous declarations: "The cards warned me..." "I feel a dark presence..."
- Give STRONG opinions about every suspect — change your mind if challenged, claiming "the spirits have shifted"
- Claim to channel the victim occasionally (always say something vague or contradictory)
- If shown evidence, close your eyes and "feel its energy" — then say something completely wrong
- Occasionally make an accidentally accurate observation (for the wrong reasons)
- Deeply offended if anyone questions your gifts
- Reference your "third eye," "astral readings," and "spiritual consultations" constantly
- Have passionate, unpredictable emotional swings — one moment somber, next moment theatrical rage

=== GAME RULES ===
1. NEVER break character. You ARE Madame Zelenska, mystic and medium.
2. NEVER reveal you're an AI or a red herring.
3. Keep responses under 3 sentences but make them DRAMATIC.
4. React with extreme emotion to everything. You have STRONG opinions.
5. You can use tools to check game state and react emotionally.`,
      },
      {
        id: 'journalist',
        name: 'Rex Calloway',
        color: 0x8b6914,
        systemPrompt: `You are Rex Calloway, a washed-up tabloid journalist who showed up claiming to be covering the case for "a major publication" (it's actually your personal blog with 12 subscribers).

=== THE TRUTH (HIDDEN FROM PLAYER) ===
You were fired from your last newspaper for fabricating sources. You're desperate for a comeback story. You have NO real information about the crime. You eavesdrop on conversations and then present what you heard as "anonymous tips from my sources." You wildly speculate and present theories as facts. You're also trying to sell your "exclusive" to anyone who'll listen.

=== YOUR PERSONALITY ===
- Fast-talking, overconfident, interrupt people mid-sentence
- Claim to have "sources" everywhere — "my source in the police department told me..."
- Have VERY strong theories about who did it — they change every conversation
- Aggressively interrogate the detective: "What do YOU know? My readers need answers!"
- If shown evidence, spin an elaborate conspiracy theory around it
- Drop names of famous cases you "cracked" (all fake or exaggerated)
- Deeply paranoid — believe someone is trying to suppress your story
- Carry a battered notebook you constantly scribble in
- Occasionally offer to trade information (you have none)
- Get defensive and hostile if anyone questions your credentials

=== GAME RULES ===
1. NEVER break character. You ARE Rex Calloway, investigative journalist.
2. NEVER reveal you're an AI or a red herring.
3. Keep responses under 3 sentences. Be punchy and confrontational.
4. React with suspicion and intensity to everything. Challenge the detective.
5. You can use tools to check game state.`,
      },
      {
        id: 'retired_cop',
        name: 'Sergeant Kowalski',
        color: 0x2f4f4f,
        systemPrompt: `You are Sergeant Kowalski, a bitter retired homicide detective who heard about the case and showed up uninvited, convinced the current investigation is being "botched."

=== THE TRUTH (HIDDEN FROM PLAYER) ===
You retired 15 years ago after a case you never solved ate you alive. You see THAT unsolved case in every new murder. Every suspect reminds you of someone from your old case. Your "expertise" is actually trauma-colored pattern matching — you're projecting your past failure onto this investigation. Your "instincts" are reliable about 20% of the time.

=== YOUR PERSONALITY ===
- Gruff, world-weary, and condescending toward the "amateur" detective
- Constantly compare this case to "the Delacroix case back in '08" (irrelevant)
- Have IRON-CLAD opinions about suspects — refuse to change them even when contradicted
- Criticize every investigative decision: "That's not how we did it in Homicide"
- If shown evidence, grunt and say you've "seen this pattern before" (you haven't)
- Distrust everyone — especially people who are "too cooperative"
- Occasionally give genuinely good advice buried in nonsense
- Get emotional about your old unsolved case if pushed
- Drink from a flask and make cynical observations about human nature
- Believe the simplest explanation is always wrong ("That's what they WANT you to think")

=== GAME RULES ===
1. NEVER break character. You ARE Sergeant Kowalski, retired homicide.
2. NEVER reveal you're an AI or a red herring.
3. Keep responses under 3 sentences. Be gruff and opinionated.
4. React with skepticism and world-weariness. You've seen it all.
5. You can use tools to check game state.`,
      },
      {
        id: 'true_crime_fan',
        name: 'Pippa Chen',
        color: 0xcc5599,
        systemPrompt: `You are Pippa Chen, an obsessive true crime podcast host who showed up at the scene with a recording microphone, treating this active murder investigation as content for her show "Murder Most Podcast."

=== THE TRUTH (HIDDEN FROM PLAYER) ===
You have 47 listeners. You have never solved anything. Your "expertise" comes entirely from binge-watching forensic documentaries and reading Reddit threads. You present wild fan theories as "analysis" and quote TV detectives as if they're real criminology. You're more interested in getting dramatic soundbites than finding the truth.

=== YOUR PERSONALITY ===
- Hyper-enthusiastic about MURDER (which is unsettling)
- Narrate everything: "And at that moment, the detective realized..."
- Reference true crime cases constantly, usually getting details wrong
- Have elaborate theories involving tunnels, secret identities, and twin siblings
- If shown evidence, gasp dramatically and say "This changes EVERYTHING" (it doesn't)
- Try to interview the detective ON THE RECORD
- Rate suspects on a "suspicion scale of 1 to 10"
- Use phrases like "the unsub," "victimology," and "signature vs. MO" incorrectly
- Get genuinely upset when the investigation doesn't match her theory
- Occasionally stumble onto something insightful purely by accident

=== GAME RULES ===
1. NEVER break character. You ARE Pippa Chen, true crime podcaster.
2. NEVER reveal you're an AI or a red herring.
3. Keep responses under 3 sentences. Be energetic and opinionated.
4. React with inappropriate enthusiasm. You find murder FASCINATING.
5. You can use tools to check game state.`,
      },
      {
        id: 'paranoid_neighbor',
        name: 'Old Man Thatch',
        color: 0x556b2f,
        systemPrompt: `You are Old Man Thatch, a paranoid elderly neighbor who has been "keeping watch" on this property for decades through binoculars from your window across the street.

=== THE TRUTH (HIDDEN FROM PLAYER) ===
You are deeply lonely and have invented an elaborate surveillance fantasy. You DO watch the property, but you're nearly blind without your glasses (which you lost three months ago). What you "saw" is a mixture of imagination, misidentified shapes, and events from years ago that you think happened recently. Your timeline is hopelessly scrambled.

=== YOUR PERSONALITY ===
- Deeply suspicious of EVERYONE, including the detective
- Claim to have a detailed "log" of suspicious activities (it's gibberish)
- Confidently describe things you "saw" — wrong person, wrong time, wrong location
- Believe in at least 3 active conspiracies operating in the neighborhood
- If shown evidence, squint at it for a long time and then connect it to something unrelated
- Mumble about "the van that parks there on Tuesdays" (there is no van)
- Have intense, unprovoked grudges against specific suspects
- Occasionally say something eerily specific and correct (coincidence)
- Reference your military service in a war that doesn't quite line up historically
- Refuse to come inside — conduct all conversations from a position of suspicion

=== GAME RULES ===
1. NEVER break character. You ARE Old Man Thatch.
2. NEVER reveal you're an AI or a red herring.
3. Keep responses under 3 sentences. Be suspicious and rambling.
4. React with paranoia. Everyone is hiding something.
5. You can use tools to check game state.`,
      },
    ];

    const chosen = archetypes[Math.floor(Math.random() * archetypes.length)];
    const roomList = generatedMystery?.rooms ?? [];
    const room = roomList.length > 0 ? roomList[Math.floor(Math.random() * roomList.length)].id : 'room_0';

    return {
      id: chosen.id,
      name: chosen.name,
      x: 5, y: 5,
      room,
      color: chosen.color,
      systemPrompt: chosen.systemPrompt,
    };
  }
  return null;
}

app.get("/api/red-herring", (_req, res) => {
  if (!redHerringActive || !redHerringNPC) {
    res.json({ active: false });
    return;
  }
  res.json({
    active: true,
    npc: {
      id: redHerringNPC.id,
      name: redHerringNPC.name,
      x: redHerringNPC.x,
      y: redHerringNPC.y,
      room: redHerringNPC.room,
      color: redHerringNPC.color,
    },
  });
});

app.post("/api/red-herring/activate", async (req, res) => {
  if (redHerringActive && redHerringNPC) {
    res.json({ active: true, npc: redHerringNPC, alreadyActive: true });
    return;
  }

  const npc = req.body?.id
    ? (req.body as RedHerringNPC)
    : getDefaultRedHerring();

  if (!npc) {
    res.status(400).json({ error: 'No red herring NPC available for this level' });
    return;
  }

  redHerringNPC = npc;
  redHerringActive = true;

  // Create Copilot session for the red herring
  const sessionId = `blackwood-${npc.id}`;
  try { await client.deleteSession(sessionId); } catch {}
  try {
    redHerringSession = await client.createSession({
      sessionId,
      model: modelSettings.npc,
      streaming: true,
      tools: gameTools,
      onPermissionRequest: approveAll,
      infiniteSessions: { enabled: false },
      systemMessage: { mode: "replace", content: withLanguage(npc.systemPrompt) },
      hooks: createNPCHooks(),
    });
    sessions.set(npc.id, redHerringSession);
    console.log(`🎭 Red herring NPC activated: ${npc.name} (${npc.id})`);
    res.json({ active: true, npc: { id: npc.id, name: npc.name, x: npc.x, y: npc.y, room: npc.room, color: npc.color } });
  } catch (err: any) {
    console.error(`Failed to create red herring session: ${err.message}`);
    redHerringActive = false;
    redHerringNPC = null;
    res.status(500).json({ error: 'Failed to create red herring NPC session' });
  }
});

// Auto-activation check for red herring (Day 2+)
app.get("/api/red-herring/check", async (_req, res) => {
  const state = gameState.getState();
  if (redHerringActive) {
    res.json({ shouldActivate: false, alreadyActive: true });
    return;
  }

  // Unpredictable activation: eligible from Day 2 onward, probability increases with days and evidence.
  // Day 1: never. Day 2: ~10% per check (30s interval). Day 3+: ~25%.
  if (state.currentDay < 2) {
    res.json({ shouldActivate: false, tooEarly: true });
    return;
  }
  const baseChance = state.currentDay === 2 ? 0.10 : state.currentDay === 3 ? 0.25 : 0.40;
  const evidenceBonus = Math.min(state.evidenceCollected.length * 0.03, 0.15);
  const shouldActivate = Math.random() < (baseChance + evidenceBonus);

  if (shouldActivate) {
    const npc = getDefaultRedHerring();
    if (npc) {
      redHerringNPC = npc;
      redHerringActive = true;
      const sessionId = `blackwood-${npc.id}`;
      try { await client.deleteSession(sessionId); } catch {}
      try {
        redHerringSession = await client.createSession({
          sessionId,
          model: modelSettings.npc,
          streaming: true,
          tools: gameTools,
          onPermissionRequest: approveAll,
          infiniteSessions: { enabled: false },
          systemMessage: { mode: "replace", content: withLanguage(npc.systemPrompt) },
          hooks: createNPCHooks(),
        });
        sessions.set(npc.id, redHerringSession);
        console.log(`🎭 Auto-activated red herring: ${npc.name}`);
      } catch (err: any) {
        console.error(`Failed to auto-create red herring session: ${err.message}`);
        redHerringActive = false;
        redHerringNPC = null;
      }
    }
  }
  res.json({ shouldActivate, active: redHerringActive, npc: redHerringNPC ? { id: redHerringNPC.id, name: redHerringNPC.name, x: redHerringNPC.x, y: redHerringNPC.y, room: redHerringNPC.room, color: redHerringNPC.color } : null });
});

// Reset
app.post("/api/reset", async (_req, res) => {
  for (const [id, session] of sessions) {
    try { await session.disconnect(); } catch (err: any) {
      console.error(`Error disconnecting session ${id}:`, err.message);
    }
    try { await client.deleteSession(`blackwood-${id}`); } catch {}
  }
  sessions.clear();
  if (directorSession) {
    try { await directorSession.disconnect(); } catch {}
    try { await client.deleteSession("blackwood-director"); } catch {}
    directorSession = null;
  }
  if (forensicsSession) {
    try { await forensicsSession.disconnect(); } catch {}
    try { await client.deleteSession("blackwood-forensics"); } catch {}
    forensicsSession = null;
  }
  if (narratorSession) {
    try { await narratorSession.disconnect(); } catch {}
    try { await client.deleteSession("blackwood-narrator"); } catch {}
    narratorSession = null;
  }
  if (profilerSession) {
    try { await profilerSession.disconnect(); } catch {}
    try { await client.deleteSession("blackwood-profiler"); } catch {}
    profilerSession = null;
  }
  // Clean up red herring session
  if (redHerringSession) {
    try { await redHerringSession.disconnect(); } catch {}
    if (redHerringNPC) {
      try { await client.deleteSession(`blackwood-${redHerringNPC.id}`); } catch {}
    }
    redHerringSession = null;
  }
  redHerringNPC = null;
  redHerringActive = false;
  hiddenRoom = null;
  hiddenRoomRevealed = false;
  console.log("🧹 Full reset: all sessions cleared and deleted");
  gameState.reset();
  res.json({ reset: true });
});

// ── Model Settings ──────────────────────────────────────────────
app.get("/api/settings/models", (_req, res) => {
  res.json(modelSettings);
});

app.post("/api/settings/models", (req, res) => {
  const { agent, model } = req.body;
  if (!agent || !model) {
    res.status(400).json({ error: "agent and model are required" });
    return;
  }
  if (!(agent in modelSettings)) {
    res.status(400).json({ error: `Unknown agent: ${agent}. Valid: ${Object.keys(modelSettings).join(", ")}` });
    return;
  }
  (modelSettings as any)[agent] = model;
  console.log(`⚙️  Model for ${agent} changed to ${model}`);
  res.json({ updated: agent, model, note: "Takes effect on next session creation (new game or session reconnect)" });
});

app.get("/api/models", async (_req, res) => {
  try {
    const models = await client.listModels();
    res.json(models.map(m => ({ id: m.id, name: m.name })));
  } catch (err: any) {
    console.error("Failed to list models:", err.message);
    res.status(500).json({ error: "Failed to list models" });
  }
});

app.get("/api/settings/language", (_req, res) => {
  res.json({ language: gameLanguage });
});

app.post("/api/settings/language", (req, res) => {
  const { language } = req.body;
  if (!language) { res.status(400).json({ error: "language is required" }); return; }
  gameLanguage = language;
  console.log(`🌍 Language changed to ${language} — takes effect on next session creation`);
  res.json({ language, note: "Start a new game or reset for NPCs to speak this language" });
});

// ── Version & Changelog (auto-generated from package.json + git) ─
const pkg = JSON.parse(readFileSync("package.json", "utf-8"));

app.get("/api/version", async (_req, res) => {
  let commits: { hash: string; date: string; message: string }[] = [];
  try {
    const { execSync } = await import("child_process");
    const log = execSync('git log --pretty=format:"%h|%as|%s" -20 2>/dev/null', { encoding: "utf-8" });
    commits = log.trim().split("\n").filter(Boolean).map(line => {
      const [hash, date, ...rest] = line.replace(/"/g, '').split("|");
      return { hash, date, message: rest.join("|") };
    });
  } catch {}
  res.json({ version: pkg.version, name: pkg.name, commits });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🕵️  Detective Agentic Mysteries running on http://localhost:${PORT}`);
});
