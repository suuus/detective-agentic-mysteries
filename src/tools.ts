import { defineTool } from "@github/copilot-sdk";
import { GameStateManager } from "./gameState.js";

export function createGameTools(gameState: GameStateManager) {
  const checkEvidenceShown = defineTool("check_evidence_shown", {
    description:
      "Check what evidence the detective has shown to a specific character. Call this to know what evidence has been presented to you during interrogation.",
    parameters: {
      type: "object",
      properties: {
        characterId: {
          type: "string",
          description: "The ID of the character to check evidence for",
        },
      },
      required: ["characterId"],
    },
    handler: async ({ characterId }: { characterId: string }) => {
      const state = gameState.getState();
      const shownIds = state.evidenceShownTo[characterId] || [];
      const nightContext = gameState.getNPCNightContext(characterId);

      if (shownIds.length === 0) {
        return {
          shown: false,
          message: "No evidence has been shown to this character yet.",
          ...(nightContext ? { nightContext } : {}),
        };
      }
      const evidenceDetails = shownIds
        .map((id) => gameState.getEvidence(id))
        .filter(Boolean)
        .map((e) => ({ name: e!.name, description: e!.detail }));
      return {
        shown: true,
        evidence: evidenceDetails,
        ...(nightContext ? { nightContext } : {}),
      };
    },
  });

  const getInvestigationProgress = defineTool("get_investigation_progress", {
    description:
      "Get the current progress of the detective's investigation. Returns counts only, not specifics, to avoid meta-gaming.",
    parameters: {
      type: "object",
      properties: {},
    },
    handler: async () => {
      const state = gameState.getState();
      return {
        charactersInterrogated: state.charactersInterrogated.length,
        evidenceCollected: state.evidenceCollected.length,
        totalEvidence: gameState.getAllEvidence().length,
        accusationsMade: state.accusationsMade,
        accusationsRemaining: 3 - state.accusationsMade,
      };
    },
  });

  const revealClue = defineTool("reveal_clue", {
    description:
      "Formally reveal a clue to the detective during conversation. Use this when your character would share important information based on the interrogation.",
    parameters: {
      type: "object",
      properties: {
        clue: {
          type: "string",
          description: "The clue text to reveal to the detective",
        },
        importance: {
          type: "string",
          enum: ["low", "medium", "high"],
          description: "How important this clue is to solving the case",
        },
      },
      required: ["clue", "importance"],
    },
    handler: async ({
      clue,
      importance,
    }: {
      clue: string;
      importance: "low" | "medium" | "high";
    }) => {
      return {
        revealed: true,
        clue,
        importance,
        message: `Clue revealed to the detective: "${clue}" [${importance} importance]`,
      };
    },
  });

  const getDayInfo = defineTool("get_day_info", {
    description:
      "Get current day number and time of day in the investigation.",
    parameters: {
      type: "object",
      properties: {},
    },
    handler: async () => {
      return {
        currentDay: gameState.getCurrentDay(),
        timeOfDay: gameState.getTimeOfDay(),
      };
    },
  });

  const updateSentiment = defineTool("update_sentiment", {
    description: "Update your emotional state and feelings. Call this when your emotions shift during the conversation — when you feel threatened, relieved, angry, scared, suspicious of someone, or when your trust in the detective changes. This helps you stay consistent.",
    parameters: {
      type: "object",
      properties: {
        emotional_state: {
          type: "string",
          enum: ["calm", "nervous", "angry", "scared", "defensive", "cooperative", "hostile", "desperate"],
          description: "Your current overall emotional state"
        },
        detective_trust_change: {
          type: "number",
          description: "How much your trust in the detective changed (-3 to +3). Negative = less trusting, positive = more trusting."
        },
        toward_other: {
          type: "object",
          properties: {
            character_id: { type: "string", description: "Another character's ID" },
            change: { type: "number", description: "How your feeling toward them changed (-3 to +3)" }
          }
        },
        reason: {
          type: "string",
          description: "Brief note about why your feelings changed (e.g. 'became defensive when shown the letter')"
        }
      },
      required: ["emotional_state"],
    },
    handler: async ({ emotional_state, detective_trust_change, toward_other, reason }: {
      emotional_state: string;
      detective_trust_change?: number;
      toward_other?: { character_id: string; change: number };
      reason?: string;
    }, invocation: any) => {
      const sessionId = invocation?.sessionId ?? '';
      const characterId = sessionId.replace('blackwood-', '');

      gameState.updateSentiment(characterId, {
        emotionalState: emotional_state,
        towardDetective: detective_trust_change,
        towardOther: toward_other ? { id: toward_other.character_id, delta: toward_other.change } : undefined,
        emotionNote: reason,
      });

      return {
        updated: true,
        message: `Emotional state updated to: ${emotional_state}`,
      };
    }
  });

  const getSelfSentiment = defineTool("get_my_sentiment", {
    description: "Check your current emotional state and feelings toward others. Call this to remember how you feel before responding to the detective.",
    parameters: {
      type: "object",
      properties: {},
    },
    handler: async (_args: any, invocation: any) => {
      const sessionId = invocation?.sessionId ?? '';
      const characterId = sessionId.replace('blackwood-', '');
      const desc = gameState.getSentimentDescription(characterId);
      return { sentiment: desc };
    }
  });

  const createEvidence = defineTool("create_evidence", {
    description: "During a private night conversation, create a physical trace or object that the detective might find tomorrow. Use this when your character would write a note, drop something, leave traces of activity (muddy footprints, scratches on a lock, a hidden message). Only call this during night scenes, not during detective interrogations.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Name of the evidence item (e.g., 'Hastily Written Warning Note')" },
        description: { type: "string", description: "Short one-line description" },
        detail: { type: "string", description: "What the detective sees when examining it (2-3 atmospheric sentences)" },
        room: { type: "string", description: "Room where it should appear (study, library, kitchen, etc.)" }
      },
      required: ["name", "description", "detail", "room"]
    },
    handler: async ({ name, description, detail, room }: { name: string; description: string; detail: string; room: string }, invocation: any) => {
      const sessionId = invocation?.sessionId ?? '';
      const characterId = sessionId.replace('blackwood-', '');
      const day = gameState.getCurrentDay();
      const id = `night${day}_${characterId}_${Date.now().toString(36)}`;
      
      const evidence = { id, name, description, detail, location: room };
      gameState.addDynamicEvidence(evidence);
      
      return {
        created: true,
        message: `Evidence created: "${name}" will appear in the ${room} tomorrow morning.`,
      };
    }
  });

  const expressBodyLanguage = defineTool("show_body_language", {
    description: "Express visible body language that the detective can observe. Call this when your character would show physical signs of emotion — fidgeting, avoiding eye contact, clenching fists, sighing, etc. This appears as a visible action in the conversation.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          description: "The visible body language action (e.g., 'avoids eye contact', 'hands trembling slightly', 'straightens up defensively', 'glances nervously at the door')"
        }
      },
      required: ["action"]
    },
    handler: async ({ action }: { action: string }) => {
      return {
        displayed: true,
        action,
        message: `[Body language displayed: ${action}]`
      };
    }
  });

  const getDetectiveProfile = defineTool("get_detective_profile", {
    description: "Get the behavioral profile of the detective you're speaking with. This tells you their interrogation style so you can adapt. An aggressive detective might need to be met with firmness; a sympathetic one might get you to open up more.",
    parameters: { type: "object", properties: {} },
    handler: async () => {
      const profile = gameState.getPlayerProfile();
      const rep = gameState.getReputation();
      return {
        style: profile.style,
        confidence: profile.confidence,
        traits: profile.traits,
        description: profile.lastAnalysis,
        reputation: rep.style,
        gossip: rep.gossipLog.slice(-3),
        tip: profile.style === 'aggressive' ? 'This detective is confrontational. Stand your ground, deflect, or lawyer up.' :
             profile.style === 'sympathetic' ? 'This detective builds rapport. Be careful not to reveal too much in moments of emotional vulnerability.' :
             profile.style === 'methodical' ? 'This detective is systematic and evidence-focused. Inconsistencies in your timeline will be caught.' :
             profile.style === 'manipulative' ? 'This detective plays people against each other. Verify any claims they make about what others said.' :
             'The detective\'s approach is still developing. Stay cautious.',
      };
    }
  });

  const getOverheardInfo = defineTool("get_overheard_info", {
    description: "Check if you overheard anything from nearby interrogations. NPCs near the detective's conversations may have overheard useful or concerning information.",
    parameters: { type: "object", properties: {} },
    handler: async (_args: any, invocation: any) => {
      const sessionId = invocation?.sessionId ?? '';
      const characterId = sessionId.replace('blackwood-', '');
      const overheard = gameState.getEavesdroppedInfo(characterId);
      const alliances = gameState.getAlliances().filter(a => a.members.includes(characterId));
      return {
        overheard: overheard.length > 0 ? overheard : ['Nothing overheard yet.'],
        alliances: alliances.map(a => ({ with: a.members.filter(m => m !== characterId), type: a.type, reason: a.reason })),
        recentPanicEvents: gameState.getRecentPanicEvents().map(e => e.description),
      };
    }
  });

  const gossipAboutDetective = defineTool("gossip_about_detective", {
    description: "Share your impression of the detective with other characters during night conversations. This spreads your assessment of the detective's personality and approach.",
    parameters: {
      type: "object",
      properties: {
        impression: { type: "string", description: "Your impression of the detective to share with others (e.g., 'Be careful, the detective is aggressive and tries to trick you')" },
        tone: { type: "string", enum: ["aggressive", "sympathetic", "neutral"], description: "How the detective treated you" },
      },
      required: ["impression", "tone"],
    },
    handler: async ({ impression, tone }: { impression: string; tone: 'aggressive' | 'sympathetic' | 'neutral' }, invocation: any) => {
      const sessionId = invocation?.sessionId ?? '';
      const characterId = sessionId.replace('blackwood-', '');
      gameState.addGossip(`${characterId} says: "${impression}"`);
      gameState.updateReputation(tone);
      return { shared: true, message: `Your impression has been shared. Other characters will hear about this.` };
    }
  });

  return [checkEvidenceShown, getInvestigationProgress, revealClue, getDayInfo, updateSentiment, getSelfSentiment, createEvidence, expressBodyLanguage, getDetectiveProfile, getOverheardInfo, gossipAboutDetective];
}
