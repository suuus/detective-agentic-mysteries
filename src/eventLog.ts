/**
 * eventLog.ts — Session replay and analytics event logging.
 *
 * Records timestamped game events for replay, analytics,
 * and exportable session files.
 */

export interface GameEvent {
  timestamp: string;
  elapsed: number;   // ms since session start
  day: number;
  timeOfDay: 'day' | 'night';
  type: EventType;
  actor: string;     // 'player' | characterId | 'system'
  action: string;
  details: Record<string, unknown>;
}

export type EventType =
  | 'talk'
  | 'evidence_collect'
  | 'evidence_show'
  | 'day_advance'
  | 'accusation'
  | 'hidden_room'
  | 'red_herring'
  | 'murder_event'
  | 'sentiment_change'
  | 'contradiction'
  | 'clue'
  | 'game_start'
  | 'game_end';

export interface SessionAnalytics {
  sessionDuration: number;
  totalEvents: number;
  evidenceCollected: number;
  evidenceCollectionOrder: string[];
  npcInteractionCounts: Record<string, number>;
  totalQuestions: number;
  accusationsMade: number;
  daysPlayed: number;
  outcome: 'won' | 'lost' | 'in_progress';
  contradictionsFound: number;
  cluesDiscovered: number;
  mostQuestionedNPC: string | null;
}

export class EventLog {
  private events: GameEvent[] = [];
  private sessionStart: number = Date.now();

  /** Record a game event. */
  log(
    day: number,
    timeOfDay: 'day' | 'night',
    type: EventType,
    actor: string,
    action: string,
    details: Record<string, unknown> = {},
  ): void {
    this.events.push({
      timestamp: new Date().toISOString(),
      elapsed: Date.now() - this.sessionStart,
      day,
      timeOfDay,
      type,
      actor,
      action,
      details,
    });
  }

  /** Return the full event log for replay. */
  getEvents(): GameEvent[] {
    return this.events;
  }

  /** Compute aggregated analytics from the event log. */
  getAnalytics(): SessionAnalytics {
    const npcCounts: Record<string, number> = {};
    const evidenceOrder: string[] = [];
    let accusations = 0;
    let contradictions = 0;
    let clues = 0;
    let maxDay = 1;
    let outcome: 'won' | 'lost' | 'in_progress' = 'in_progress';

    for (const ev of this.events) {
      if (ev.day > maxDay) maxDay = ev.day;

      switch (ev.type) {
        case 'talk':
          npcCounts[ev.details.characterId as string] =
            (npcCounts[ev.details.characterId as string] || 0) + 1;
          break;
        case 'evidence_collect':
          evidenceOrder.push(ev.details.evidenceId as string);
          break;
        case 'accusation':
          accusations++;
          if (ev.details.correct) outcome = 'won';
          else if (ev.details.attemptsLeft === 0) outcome = 'lost';
          break;
        case 'contradiction':
          contradictions++;
          break;
        case 'clue':
          clues++;
          break;
        case 'game_end':
          if (ev.details.won) outcome = 'won';
          else outcome = 'lost';
          break;
      }
    }

    let mostQueried: string | null = null;
    let maxCount = 0;
    for (const [npc, count] of Object.entries(npcCounts)) {
      if (count > maxCount) {
        maxCount = count;
        mostQueried = npc;
      }
    }

    const talkEvents = this.events.filter(e => e.type === 'talk');

    return {
      sessionDuration: Date.now() - this.sessionStart,
      totalEvents: this.events.length,
      evidenceCollected: evidenceOrder.length,
      evidenceCollectionOrder: evidenceOrder,
      npcInteractionCounts: npcCounts,
      totalQuestions: talkEvents.length,
      accusationsMade: accusations,
      daysPlayed: maxDay,
      outcome,
      contradictionsFound: contradictions,
      cluesDiscovered: clues,
      mostQuestionedNPC: mostQueried,
    };
  }

  /** Reset the log (on game reset). */
  reset(): void {
    this.events = [];
    this.sessionStart = Date.now();
  }
}
