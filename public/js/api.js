/**
 * GameAPI — backend communication for Shadows of Blackwood Manor.
 * All methods return parsed JSON unless streaming (talkTo).
 */
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

  // ── Contradictions ──────────────────────────────────────────────
  async getContradictions() {
    const res = await fetch(`${this.baseUrl}/api/contradictions`);
    if (!res.ok) throw new Error(`Failed to fetch contradictions (${res.status})`);
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

  // ── Hidden Room ────────────────────────────────────────────────
  async getHiddenRoom() {
    const res = await fetch(`${this.baseUrl}/api/hidden-room`);
    if (!res.ok) throw new Error(`Failed to fetch hidden room (${res.status})`);
    return res.json();
  }

  async checkHiddenRoom() {
    const res = await fetch(`${this.baseUrl}/api/hidden-room/check`);
    if (!res.ok) throw new Error(`Failed to check hidden room (${res.status})`);
    return res.json();
  }

  async revealHiddenRoom(data = {}) {
    const res = await fetch(`${this.baseUrl}/api/hidden-room/reveal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to reveal hidden room (${res.status})`);
    return res.json();
  }

  // ── Red Herring NPC ────────────────────────────────────────────
  async getRedHerring() {
    const res = await fetch(`${this.baseUrl}/api/red-herring`);
    if (!res.ok) throw new Error(`Failed to fetch red herring (${res.status})`);
    return res.json();
  }

  async checkRedHerring() {
    const res = await fetch(`${this.baseUrl}/api/red-herring/check`);
    if (!res.ok) throw new Error(`Failed to check red herring (${res.status})`);
    return res.json();
  }

  async activateRedHerring(data = {}) {
    const res = await fetch(`${this.baseUrl}/api/red-herring/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to activate red herring (${res.status})`);
    return res.json();
  }

  async reconstruct() {
    const res = await fetch(`${this.baseUrl}/api/reconstruct`, { method: 'POST' });
    if (!res.ok) throw new Error(`Reconstruction failed (${res.status})`);
    return res.json();
  }

  async adjustSentiment(characterId, amount) {
    const res = await fetch(`${this.baseUrl}/api/sentiments/${characterId}/adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount }),
    });
    if (!res.ok) throw new Error(`Failed to adjust sentiment (${res.status})`);
    return res.json();
  }
}
