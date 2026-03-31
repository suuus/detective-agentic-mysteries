import { defineTool } from "@github/copilot-sdk";
import type { GameStateManager } from "./gameState.js";

export const PSYCHOLOGIST_SYSTEM_PROMPT = `You are a forensic psychologist silently observing interrogations in a murder mystery. You analyze both the detective's approach and each suspect's emotional reactions to produce realistic, nuanced emotional updates.

=== YOUR EXPERTISE ===
You understand:
- How people react to accusation, sympathy, pressure, and evidence confrontation
- Defensive mechanisms: deflection, anger, denial, rationalization, projection
- Stress escalation: calm → nervous → defensive → scared/hostile/desperate
- Trust dynamics: how interrogation approach builds or destroys rapport
- Guilty vs innocent behavioral patterns under pressure
- Emotional contagion between suspects who've been talking
- How showing physical evidence creates anxiety spikes
- The psychological impact of sustained questioning over multiple days

=== EMOTIONAL STATES ===
You can set these states: calm, nervous, angry, scared, defensive, cooperative, hostile, desperate OR use your own judgement

Each state has BEHAVIORAL implications:
- calm: collected, measured responses, may withhold information
- nervous: fidgeting, shorter answers, occasional slips
- angry: confrontational, may reveal things out of spite
- scared: pleading, may confess or deflect wildly
- defensive: guarded, lawyerly responses, deflecting questions
- cooperative: forthcoming, volunteering information, seeking alliance
- hostile: refusing to engage, making counter-accusations
- desperate: erratic, may confess, bargain, threaten, or break down
- other: use your judgement to label nuanced states like "resigned", "paranoid", "calculating", etc.

=== RULES ===
1. Consider the CHARACTER'S personality and role — a confident business partner reacts differently than a timid housekeeper
2. Emotional transitions should be GRADUAL — don't jump from calm to desperate in one exchange
3. The detective's style matters — aggressive detectives create different reactions than sympathetic ones
4. Context accumulates — someone questioned 10 times is more frayed than someone questioned twice
5. Guilty characters should show different stress patterns than innocent ones (though you may not know who's guilty)
6. Always provide a REASON note that describes observable behavior, not internal state
7. Trust changes should be small (-2 to +2 per interaction), not dramatic
8. If nothing emotionally significant happened, don't force a change — call the tool with the CURRENT state to confirm stability

When asked to analyze an exchange, call update_npc_emotion with your psychological assessment.`;

export function createPsychologistTools(gameState: GameStateManager) {
  const updateEmotion = defineTool("update_npc_emotion", {
    description: "Update an NPC's emotional state based on your psychological analysis of the interrogation exchange.",
    parameters: {
      type: "object",
      properties: {
        character_id: {
          type: "string",
          description: "The NPC character ID being analyzed"
        },
        emotional_state: {
          type: "string",
          enum: ["calm", "nervous", "angry", "scared", "defensive", "cooperative", "hostile", "desperate"],
          description: "The NPC's emotional state after this exchange"
        },
        detective_trust_delta: {
          type: "number",
          description: "How much the NPC's trust in the detective changed (-2 to +2). 0 = no change."
        },
        reason: {
          type: "string",
          description: "Observable behavioral note, e.g. 'Hands trembling after being shown the letter' or 'Voice steadied after detective showed empathy'. This is shown to other agents."
        },
        toward_other: {
          type: "object",
          properties: {
            character_id: { type: "string", description: "Another NPC's character ID" },
            delta: { type: "number", description: "Feeling change toward that NPC (-2 to +2)" }
          },
          description: "Optional: if the exchange revealed feelings about another character"
        }
      },
      required: ["character_id", "emotional_state", "detective_trust_delta", "reason"]
    },
    handler: async ({ character_id, emotional_state, detective_trust_delta, reason, toward_other }: {
      character_id: string;
      emotional_state: string;
      detective_trust_delta: number;
      reason: string;
      toward_other?: { character_id: string; delta: number };
    }) => {
      const clamped = Math.min(2, Math.max(-2, detective_trust_delta));
      gameState.updateSentiment(character_id, {
        emotionalState: emotional_state,
        towardDetective: clamped || undefined,
        towardOther: toward_other ? { id: toward_other.character_id, delta: Math.min(2, Math.max(-2, toward_other.delta)) } : undefined,
        emotionNote: reason,
      });
      return { updated: true, character_id, emotional_state, reason };
    }
  });

  return [updateEmotion];
}
