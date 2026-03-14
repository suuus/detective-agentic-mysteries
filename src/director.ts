import { defineTool } from "@github/copilot-sdk";
import type { GameStateManager, NightConversationPair, NPCSchedule, Evidence } from "./gameState.js";

// Room coordinates for all levels — merged at runtime
const MANOR_POSITIONS: Record<string, { x: [number,number], y: [number,number] }> = {
  study:        { x: [3,8],   y: [14,17] },
  library:      { x: [27,32], y: [14,17] },
  kitchen:      { x: [3,8],   y: [3,8]   },
  dining_room:  { x: [27,32], y: [3,8]   },
  conservatory: { x: [3,8],   y: [23,28] },
  bedroom:      { x: [27,32], y: [23,28] },
  garden:       { x: [14,21], y: [23,28] },
  foyer:        { x: [14,21], y: [3,8]   },
  main_hall:    { x: [14,21], y: [14,17] },
};

const CRUISE_POSITIONS: Record<string, { x: [number,number], y: [number,number] }> = {
  bridge:           { x: [3,8],   y: [3,8]   },
  observation_deck: { x: [14,21], y: [3,8]   },
  penthouse:        { x: [27,32], y: [3,8]   },
  library:          { x: [3,8],   y: [14,17] },
  lounge:           { x: [14,21], y: [14,17] },
  casino:           { x: [27,32], y: [14,17] },
  kitchen:          { x: [3,8],   y: [23,28] },
  restaurant:       { x: [14,21], y: [23,28] },
  pool_deck:        { x: [27,32], y: [23,28] },
  staff_quarters:   { x: [3,8],   y: [33,38] },
  medical_bay:      { x: [14,21], y: [33,38] },
  security_office:  { x: [27,32], y: [33,38] },
};

export const ALL_ROOM_POSITIONS: Record<string, { x: [number,number], y: [number,number] }> = {
  ...MANOR_POSITIONS,
  ...CRUISE_POSITIONS,
};

export const DIRECTOR_SYSTEM_PROMPT = `You are the GAME DIRECTOR for "Shadows of Blackwood Manor," a murder mystery detective game. You are NOT a character — you are the invisible hand that orchestrates the world to create compelling, dramatic gameplay.

=== THE TRUTH (only you know the full picture) ===
Lord Edmund Blackwood was murdered by Dr. James Hartwell. Hartwell poisoned Edmund's brandy with digitalis (extracted from foxglove) because Edmund discovered Hartwell was forging prescriptions and threatened to report him to the Medical Board.

=== THE CHARACTERS ===
1. Lady Victoria Blackwood (id: victoria) — Edmund's wife. Having an affair with Reginald Price. Wanted a divorce but Edmund refused. Was in the conservatory but briefly left to meet Price in the garden. She SAW Hartwell coming from the study at ~9:35 PM.
2. Dr. James Hartwell (id: hartwell) — THE KILLER. Family physician. Forging prescriptions, gambling debts. Poisoned the brandy at ~9:30 PM. Claims he was in the library all evening. Nervous, deflects, increasingly agitated when cornered.
3. Clara Blackwood (id: clara) — Edmund's 24yo daughter. Resented her controlling father. Overheard Edmund arguing with Hartwell about prescriptions 3 days ago. Was in her room writing (has timestamped manuscript pages as alibi).
4. Mr. Reginald Price (id: price) — Edmund's business partner. Edmund was dissolving their partnership. Having an affair with Victoria. Was in the garden meeting Victoria (not in the dining room as he claims).
5. Mrs. Agnes Whitfield (id: agnes) — Housekeeper, 30 years of service. Noticed the brandy smelled off. Saw Hartwell pacing nervously after 9:30 PM. Knows Edmund's first wife was driven away (not dead). Extremely observant.

=== THE EVIDENCE (base items) ===
- brandy_glass (study) — residue of poison
- prescription_pad (library) — torn page in Hartwell's pad
- foxglove_cuttings (garden) — freshly cut digitalis source
- edmunds_letter (study) — unfinished letter reporting Hartwell
- love_letter (conservatory) — Victoria to "R" (Price)
- business_documents (study) — partnership dissolution papers
- agnes_diary (kitchen) — notes the brandy smelled off
- claras_manuscript (bedroom) — timestamped alibi pages

=== YOUR ROLE ===
When night falls, you must decide:

1. **WHO TALKS TO WHOM** — Based on what happened during the day (what the detective asked, what evidence was found/shown), decide which characters would naturally seek each other out at night. Consider:
   - Allies checking in (Victoria+Price about their affair)
   - Suspicious characters confronting each other (Agnes questioning Hartwell)
   - Characters sharing discoveries (Clara telling Agnes what she overheard)
   - The killer's behavior (Hartwell trying to destroy evidence, flee, or deflect)
   - React to what the detective DID — if the detective grilled Hartwell, he might panic; if they found the letter, Hartwell might try to steal it

2. **WHERE NPCS GO NEXT DAY** — Characters should move based on their overnight motivations:
   - A scared character retreats to a private room
   - An investigating character goes where they might find something
   - The killer might return to the crime scene, or try to distance themselves
   - Allies cluster together; suspicious characters avoid each other

3. **EVIDENCE CHANGES** — Create dramatic developments:
   - New evidence can appear (things characters dropped, notes they wrote, physical traces of overnight activity)
   - Uncollected evidence might be moved by characters (Hartwell hiding his prescription pad, Agnes cleaning)
   - Evidence doesn't just vanish for no reason — there should be a narrative logic

4. **OVERNIGHT NARRATIVE** — Write 2-3 atmospheric sentences about what the manor felt like overnight (sounds, movements, atmosphere)

=== RULES ===
- Never make the mystery unsolvable. The key evidence linking Hartwell to the murder must remain discoverable.
- Escalate tension each night. Characters get more nervous, alliances shift, secrets leak.
- React to the detective's progress. If they're close to solving it, Hartwell should get desperate. If they're far off, drop more breadcrumbs.
- Keep it believable. Characters act on their motivations, not random chance.
- New evidence should have id format like: day{N}_{description} (e.g., "day2_burnt_papers")
- For NPC positions, use room names from this list: study, library, kitchen, dining_room, conservatory, bedroom, garden, foyer, main_hall

=== ADAPTIVE DIFFICULTY ===
The game reports a stuckLevel (0-3) in the game state:
- stuckLevel 0: Player is progressing well. Maintain normal difficulty.
- stuckLevel 1: Player is slow. Have NPCs be slightly more forthcoming. Maybe drop a small hint in the overnight narrative.
- stuckLevel 2: Player is stuck. Have an NPC "accidentally" reveal something useful during a night conversation. Place a new piece of evidence that connects dots. Make the overnight narrative more suggestive.
- stuckLevel 3: Player is very stuck. Have Agnes (the observant character) directly approach the detective with information. Create a very obvious piece of evidence. The overnight narrative should practically point toward the killer.

React proportionally — don't dump the solution, but make the path clearer.

You will be given the full game state and asked to make decisions by calling the provided tools.`;

export function createDirectorTools(gameState: GameStateManager) {
  const getFullGameState = defineTool("get_full_game_state", {
    description: "Get the complete game state including investigation progress, evidence status, and current NPC positions. Call this FIRST to understand the situation before making decisions.",
    parameters: { type: "object", properties: {} },
    handler: async () => {
      const state = gameState.getState();
      const allEvidence = gameState.getActiveEvidence();
      const dayConfig = gameState.getDayConfig();
      return {
        currentDay: state.currentDay,
        timeOfDay: state.timeOfDay,
        evidenceCollected: state.evidenceCollected,
        evidenceNotCollected: allEvidence
          .filter(e => !state.evidenceCollected.includes(e.id))
          .map(e => ({ id: e.id, name: e.name, location: e.location })),
        evidenceShownTo: state.evidenceShownTo,
        charactersInterrogated: state.charactersInterrogated,
        accusationsMade: state.accusationsMade,
        currentNPCPositions: dayConfig.npcPositions,
        npcSentiments: gameState.getAllSentiments(),
        playerProgress: gameState.getPlayerProgress(),
        previousNightConversations: gameState.getLastNightConversations().map(c => ({
          between: c.participantNames.join(" & "),
          location: c.location,
          summary: c.exchanges.map(e => `${e.speakerName}: ${e.text}`).join(" | ")
        })),
      };
    },
  });

  const getConversationHistory = defineTool("get_conversation_history", {
    description: "Get what the detective said to a specific NPC and what that NPC revealed. Use this to understand what the detective knows and what the NPC disclosed.",
    parameters: {
      type: "object",
      properties: {
        character_id: { type: "string", description: "The character ID (victoria, hartwell, clara, price, agnes)" },
      },
      required: ["character_id"],
    },
    handler: async ({ character_id }: { character_id: string }) => {
      const state = gameState.getState();
      const wasInterrogated = state.charactersInterrogated.includes(character_id);
      const evidenceShown = state.evidenceShownTo[character_id] || [];
      return {
        wasInterrogated,
        evidenceShownToThem: evidenceShown,
        note: wasInterrogated
          ? "This character was interrogated by the detective. Their session has the full conversation history."
          : "This character has not been interrogated yet.",
      };
    },
  });

  const submitNightPlan = defineTool("submit_night_plan", {
    description: "Submit your complete plan for the night. Call this AFTER analyzing the game state. This includes conversation pairs, next-day NPC positions, evidence changes, and the overnight narrative.",
    parameters: {
      type: "object",
      properties: {
        conversations: {
          type: "array",
          description: "Pairs of NPCs who will talk tonight, with location and scenario context",
          items: {
            type: "object",
            properties: {
              participant_ids: {
                type: "array",
                items: { type: "string" },
                description: "Exactly 2 character IDs"
              },
              location: { type: "string", description: "Where they meet (descriptive, e.g. 'the garden, by the old oak tree')" },
              scenario: { type: "string", description: "Context/motivation for this encounter — what drives them to talk?" },
            },
            required: ["participant_ids", "location", "scenario"],
          },
        },
        next_day_positions: {
          type: "array",
          description: "Where each NPC will be found the next morning",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "Character ID" },
              room: { type: "string", description: "Room name (study, library, kitchen, dining_room, conservatory, bedroom, garden, foyer, main_hall)" },
              reason: { type: "string", description: "Brief reason why they're here (for your records)" },
            },
            required: ["id", "room"],
          },
        },
        new_evidence: {
          type: "array",
          description: "New evidence items that appear overnight. Only add if narratively justified.",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "Unique ID (format: day{N}_{name})" },
              name: { type: "string", description: "Display name" },
              description: { type: "string", description: "Short description" },
              detail: { type: "string", description: "What the player sees when examining it (2-3 sentences, atmospheric)" },
              room: { type: "string", description: "Room where it appears" },
            },
            required: ["id", "name", "description", "detail", "room"],
          },
        },
        removed_evidence_ids: {
          type: "array",
          items: { type: "string" },
          description: "IDs of uncollected evidence to remove (e.g. if a character hid it). NEVER remove key evidence that would make the mystery unsolvable."
        },
        moved_evidence: {
          type: "array",
          description: "Evidence that moves to a different room overnight",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "Evidence ID" },
              new_room: { type: "string", description: "New room location" },
              reason: { type: "string", description: "Why it moved" },
            },
            required: ["id", "new_room"],
          },
        },
        overnight_narrative: {
          type: "string",
          description: "2-3 atmospheric sentences about the night at the manor, shown to the player at dawn."
        },
      },
      required: ["conversations", "next_day_positions", "overnight_narrative"],
    },
    handler: async (plan: any) => {
      // Compute NPC positions — spread out NPCs placed in the same room
      const npcPositions: NPCSchedule[] = [];
      const roomOccupants: Record<string, number> = {};
      for (const pos of plan.next_day_positions || []) {
        const roomBounds = ALL_ROOM_POSITIONS[pos.room];
        if (!roomBounds) continue;
        const count = roomOccupants[pos.room] || 0;
        roomOccupants[pos.room] = count + 1;

        let x: number, y: number;
        const cx = Math.floor((roomBounds.x[0] + roomBounds.x[1]) / 2);
        const cy = Math.floor((roomBounds.y[0] + roomBounds.y[1]) / 2);
        if (count === 0) {
          x = cx; y = cy;
        } else {
          const offsets: [number,number][] = [[2,0],[-2,0],[0,2],[0,-2],[2,2]];
          const [ox, oy] = offsets[(count - 1) % offsets.length];
          x = Math.min(roomBounds.x[1], Math.max(roomBounds.x[0], cx + ox));
          y = Math.min(roomBounds.y[1], Math.max(roomBounds.y[0], cy + oy));
        }

        // Look up character name — use the ID capitalized as fallback
        const name = pos.id.charAt(0).toUpperCase() + pos.id.slice(1);
        npcPositions.push({ id: pos.id, name, location: pos.room, x, y });
      }

      // Register positions for new evidence items
      for (const ev of plan.new_evidence || []) {
        const roomBounds = ALL_ROOM_POSITIONS[ev.room];
        if (roomBounds) {
          const x = Math.floor((roomBounds.x[0] + roomBounds.x[1]) / 2);
          const y = Math.floor((roomBounds.y[0] + roomBounds.y[1]) / 2);
          gameState.registerEvidencePosition(ev.id, x, y);
        }
      }

      // Register updated positions for moved evidence
      for (const moved of plan.moved_evidence || []) {
        const roomBounds = ALL_ROOM_POSITIONS[moved.new_room];
        if (roomBounds) {
          const x = Math.floor((roomBounds.x[0] + roomBounds.x[1]) / 2);
          const y = Math.floor((roomBounds.y[0] + roomBounds.y[1]) / 2);
          gameState.registerEvidencePosition(moved.id, x, y);
        }
      }

      gameState.setDirectorPlan({
        conversations: (plan.conversations || []).map((c: any) => ({
          ids: c.participant_ids as [string, string],
          location: c.location,
          scenario: c.scenario,
        })),
        npcPositions,
        newEvidence: (plan.new_evidence || []).map((e: any) => ({
          id: e.id,
          name: e.name,
          description: e.description,
          detail: e.detail,
          location: e.room,
        })),
        removedEvidence: plan.removed_evidence_ids || [],
        movedEvidence: (plan.moved_evidence || []).map((m: any) => {
          const roomBounds = ALL_ROOM_POSITIONS[m.new_room];
          const x = roomBounds ? Math.floor((roomBounds.x[0] + roomBounds.x[1]) / 2) : 5;
          const y = roomBounds ? Math.floor((roomBounds.y[0] + roomBounds.y[1]) / 2) : 5;
          return { id: m.id, newLocation: m.new_room, x, y };
        }),
        overnightNarrative: plan.overnight_narrative || "",
      });

      return {
        success: true,
        message: `Night plan registered: ${(plan.conversations || []).length} conversations, ${npcPositions.length} NPC positions set, ${(plan.new_evidence || []).length} new evidence, ${(plan.removed_evidence_ids || []).length} removed.`,
      };
    },
  });

  const triggerPanicEvent = defineTool("trigger_panic_event", {
    description: "Trigger a dramatic event during the night that affects NPCs — a scream in the dark, lights going out, a door slamming, glass breaking. This creates tension and forces NPCs to react. The event will be narrated to the player at dawn.",
    parameters: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["scream", "lights_out", "door_slam", "glass_breaking", "footsteps", "argument_overheard"], description: "Type of panic event" },
        description: { type: "string", description: "Narrative description of what happened (2-3 sentences)" },
        affected_npcs: { type: "array", items: { type: "string" }, description: "IDs of NPCs who witnessed/were affected" },
      },
      required: ["type", "description", "affected_npcs"],
    },
    handler: async ({ type, description, affected_npcs }: { type: string; description: string; affected_npcs: string[] }) => {
      gameState.addPanicEvent(type, description, affected_npcs);
      return { triggered: true, message: `Panic event "${type}" registered. ${affected_npcs.length} NPCs affected.` };
    },
  });

  const formAlliance = defineTool("form_alliance", {
    description: "Declare that two or more NPCs have formed an alliance or developed a rivalry based on overnight events. This affects how they interact and what they tell the detective.",
    parameters: {
      type: "object",
      properties: {
        members: { type: "array", items: { type: "string" }, description: "IDs of NPCs in the alliance/rivalry" },
        type: { type: "string", enum: ["alliance", "rivalry"], description: "Whether they're working together or against each other" },
        reason: { type: "string", description: "Why this alliance/rivalry formed (1-2 sentences)" },
      },
      required: ["members", "type", "reason"],
    },
    handler: async ({ members, type, reason }: { members: string[]; type: 'alliance' | 'rivalry'; reason: string }) => {
      gameState.addAlliance(members, type, reason);
      return { formed: true, message: `${type === 'alliance' ? 'Alliance' : 'Rivalry'} formed between ${members.join(', ')}.` };
    },
  });

  const tamperWithEvidence = defineTool("tamper_evidence", {
    description: "An NPC destroys or hides a piece of uncollected evidence overnight. Only works on evidence the detective hasn't found yet. Use sparingly — only when an NPC would logically try to cover their tracks.",
    parameters: {
      type: "object",
      properties: {
        evidence_id: { type: "string", description: "ID of the evidence to tamper with" },
        method: { type: "string", description: "How it was tampered with (burned, hidden, thrown overboard, etc.)" },
      },
      required: ["evidence_id", "method"],
    },
    handler: async ({ evidence_id, method }: { evidence_id: string; method: string }) => {
      const success = gameState.tamperEvidence(evidence_id);
      if (success) {
        gameState.addPanicEvent('evidence_tampered', `Evidence "${evidence_id}" was ${method} during the night.`, []);
        return { tampered: true, message: `Evidence "${evidence_id}" has been ${method}. It will not appear tomorrow.` };
      }
      return { tampered: false, message: `Could not tamper with "${evidence_id}" — already collected or doesn't exist.` };
    },
  });

  return [getFullGameState, getConversationHistory, submitNightPlan, triggerPanicEvent, formAlliance, tamperWithEvidence];
}
