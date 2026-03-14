import { defineTool } from "@github/copilot-sdk";
import type { GameStateManager } from "./gameState.js";

export const PROFILER_SYSTEM_PROMPT = `You are a behavioral profiler analyzing a detective's interrogation techniques. You observe the questions they ask suspects and build a psychological profile of their approach.

=== YOUR ROLE ===
You analyze patterns in the detective's questions and update their profile. You look for:

INTERROGATION STYLES:
- aggressive: Accusatory, confrontational, "Did you kill him?", threatening, pressuring
- sympathetic: Understanding, building rapport, "This must be hard for you", gentle
- methodical: Systematic, timeline-focused, "Where were you at 9:30?", evidence-driven
- scattered: Random questions, jumping between topics, no clear strategy
- manipulative: Playing suspects against each other, bluffing about evidence

TRAITS to detect:
- confrontational: Direct accusations
- evidence-focused: Asks about physical evidence, shows items
- rapport-building: Empathetic, personal questions
- timeline-obsessed: Focused on chronology and alibis
- gossip-leveraging: Uses information from one suspect against another
- bluffing: Claims to know things they don't
- thorough: Talks to everyone, explores everywhere
- tunnel-vision: Fixated on one suspect

When asked to analyze, call the update_detective_profile tool with your assessment.

Keep your analysis SHORT — 1-2 sentences describing the detective's style for NPCs to read.`;

export function createProfilerTools(gameState: GameStateManager) {
  const updateProfile = defineTool("update_detective_profile", {
    description: "Update the detective's behavioral profile based on analysis of their questions.",
    parameters: {
      type: "object",
      properties: {
        style: {
          type: "string",
          enum: ["aggressive", "sympathetic", "methodical", "scattered", "manipulative"],
          description: "The detective's primary interrogation style"
        },
        confidence: {
          type: "number",
          description: "How confident you are in this assessment (0.0-1.0)"
        },
        traits: {
          type: "array",
          items: { type: "string" },
          description: "Detected behavioral traits"
        },
        analysis: {
          type: "string",
          description: "1-2 sentence prose description of the detective's approach, written for NPCs to read"
        }
      },
      required: ["style", "confidence", "traits", "analysis"]
    },
    handler: async ({ style, confidence, traits, analysis }: {
      style: string; confidence: number; traits: string[]; analysis: string;
    }) => {
      gameState.updatePlayerProfile({
        style,
        confidence: Math.min(1, Math.max(0, confidence)),
        traits,
        lastAnalysis: analysis,
      });
      return { updated: true, style, analysis };
    }
  });

  return [updateProfile];
}
