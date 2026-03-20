/**
 * DialogManager — controls the interrogation / conversation UI.
 */
export class DialogManager {
  /** @param {import('./api.js').GameAPI} api */
  constructor(api) {
    this.api = api;
    this.currentCharacter = null;
    this.currentCharacterName = '';
    this.responding = false;

    /** @type {import('./voiceInput.js').VoiceInputManager|null} */
    this.voiceInput = null;

    // Per-character conversation memory { characterId: [{role,text}] }
    this.history = {};

    // DOM references
    this.overlay       = document.getElementById('dialog-overlay');
    this.portrait      = document.getElementById('dialog-portrait');
    this.nameEl        = document.getElementById('dialog-character-name');
    this.historyEl     = document.getElementById('dialog-history');
    this.typingEl      = document.getElementById('typing-indicator');
    this.input         = document.getElementById('dialog-input');
    this.sendBtn       = document.getElementById('dialog-send-btn');
    this.evidenceBtn   = document.getElementById('dialog-evidence-btn');
    this.evidencePanel = document.getElementById('dialog-evidence-panel');
    this.evidenceList  = document.getElementById('dialog-evidence-list');
    this.closeBtn      = document.getElementById('dialog-close-btn');

    this._bindEvents();
  }

  /** Attach a VoiceInputManager and wire its callbacks to the dialog flow. */
  setVoiceInput(manager) {
    this.voiceInput = manager;
    if (!manager) return;

    // When a final transcript is received, auto-send it
    const prevOnResult = manager.onResult;
    manager.onResult = (text) => {
      prevOnResult?.(text);
      if (text && text.trim() && !this.responding) {
        this.sendMessage(text);
      }
    };
  }

  // ── Public API ─────────────────────────────────────────────────

  open(characterId, characterName) {
    this.currentCharacter = characterId;
    this.currentCharacterName = characterName;
    this.nameEl.textContent = characterName;
    this.portrait.style.backgroundImage = `url('assets/portraits/${characterId}.png')`;

    // Render previous messages for this character
    this._renderHistory();

    this.overlay.classList.remove('hidden');
    this.evidencePanel.classList.add('hidden');
    this.input.focus();

    // Show sentiment indicator
    this._updateSentimentIndicator();
    window.setMusicMood?.('tense');
  }

  // Open dialog with the NPC speaking first (used when NPC approaches the player)
  openWithPrompt(characterId, characterName) {
    this.open(characterId, characterName);
    // Auto-send a prompt so the NPC speaks first
    this.sendMessage('[The detective listens attentively. You approached the detective because you have something important to say. Speak now — what do you want to tell them?]');
  }

  close() {
    this.overlay.classList.add('hidden');
    this.currentCharacter = null;
    this.evidencePanel.classList.add('hidden');
    if (window.speechSynthesis) speechSynthesis.cancel();
    if (this.voiceInput?.listening) this.voiceInput.stopListening();
    const moodEl = document.getElementById('dialog-mood');
    if (moodEl) moodEl.classList.add('hidden');
    // Release focus so Phaser can receive keyboard events again
    this.input.blur();
    const canvas = document.querySelector('#game-container canvas');
    if (canvas) canvas.focus();
    else document.body.focus();
    window.setMusicMood?.('calm');
  }

  isOpen() {
    return this.currentCharacter !== null;
  }

  async sendMessage(text) {
    if (!text.trim() || !this.currentCharacter || this.responding) return;

    const charId = this.currentCharacter;

    // Ensure history array
    if (!this.history[charId]) this.history[charId] = [];

    // Append player message
    this.history[charId].push({ role: 'player', text });
    this._appendBubble('player', text);
    this.input.value = '';
    this._setResponding(true);

    // Stream NPC response
    let fullResponse = '';
    const npcBubble = this._appendBubble('npc', '');

    try {
      for await (const chunk of this.api.talkTo(charId, text)) {
        fullResponse += chunk;
        // Render body language markers inline during streaming
        const processed = fullResponse.replace(/\*\[([^\]]+)\]\*/g, '<span class="body-language">$1</span>');
        npcBubble.innerHTML = processed;
        this._scrollToBottom();
      }
    } catch (err) {
      fullResponse = `[Error: ${err.message}]`;
      npcBubble.textContent = fullResponse;
    }

    this.history[charId].push({ role: 'npc', text: fullResponse });
    this._setResponding(false);
    if (window.speakNPC) window.speakNPC(charId, fullResponse);

    // Update sentiment indicator
    this._updateSentimentIndicator();
  }

  showEvidencePanel() {
    this.evidencePanel.classList.toggle('hidden');
    if (!this.evidencePanel.classList.contains('hidden')) {
      window.inventoryManager?.renderEvidenceForDialog();
    }
  }

  async presentEvidence(evidenceId) {
    if (!this.currentCharacter || this.responding) return;

    const charId = this.currentCharacter;
    if (!this.history[charId]) this.history[charId] = [];

    // First, register the evidence as shown on the server
    try {
      await this.api.showEvidence(evidenceId, charId);
    } catch (err) {
      console.warn('Failed to register evidence:', err);
    }

    // Then send a message to the AI about it so they react
    const evidenceName = evidenceId.replace(/_/g, ' ');
    const prompt = `*The detective presents evidence: ${evidenceName}* What do you have to say about this?`;

    this.history[charId].push({ role: 'player', text: `[Shows evidence: ${evidenceName}]` });
    this._appendBubble('player', `📋 Shows: ${evidenceName}`);
    this._setResponding(true);
    this.evidencePanel.classList.add('hidden');

    let fullResponse = '';
    const npcBubble = this._appendBubble('npc', '');

    try {
      for await (const chunk of this.api.talkTo(charId, prompt)) {
        fullResponse += chunk;
        const processed = fullResponse.replace(/\*\[([^\]]+)\]\*/g, '<span class="body-language">$1</span>');
        npcBubble.innerHTML = processed;
        this._scrollToBottom();
      }
    } catch (err) {
      fullResponse = `[Error: ${err.message}]`;
      npcBubble.textContent = fullResponse;
    }

    this.history[charId].push({ role: 'npc', text: fullResponse });
    this._setResponding(false);
    if (window.speakNPC) window.speakNPC(charId, fullResponse);
    this._scrollToBottom();

    // Update sentiment indicator
    this._updateSentimentIndicator();
  }

  // ── Internal ───────────────────────────────────────────────────

  _bindEvents() {
    this.sendBtn.addEventListener('click', () => this.sendMessage(this.input.value));
    this.input.addEventListener('keydown', (e) => {
      if (this.isOpen()) e.stopPropagation(); // Only block when dialog is visible
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage(this.input.value);
      }
    });
    this.input.addEventListener('keyup', (e) => { if (this.isOpen()) e.stopPropagation(); });
    this.input.addEventListener('keypress', (e) => { if (this.isOpen()) e.stopPropagation(); });
    this.evidenceBtn.addEventListener('click', () => this.showEvidencePanel());
    this.closeBtn.addEventListener('click', () => this.close());
  }

  _setResponding(flag) {
    this.responding = flag;
    this.input.disabled = flag;
    this.sendBtn.disabled = flag;
    const micBtn = document.getElementById('dialog-mic-btn');
    if (micBtn) micBtn.disabled = flag;
    this.typingEl.classList.toggle('hidden', !flag);
    if (!flag) this.input.focus();
  }

  _renderHistory() {
    this.historyEl.innerHTML = '';
    const msgs = this.history[this.currentCharacter] ?? [];
    for (const msg of msgs) {
      this._appendBubble(msg.role, msg.text);
    }
    this._scrollToBottom();
  }

  _appendBubble(role, text) {
    const div = document.createElement('div');
    div.className = `msg ${role}`;

    if (role === 'npc') {
      // Detect body language markers: *[action]*
      const processed = text.replace(/\*\[([^\]]+)\]\*/g, '<span class="body-language">$1</span>');
      div.innerHTML = processed;
    } else {
      div.textContent = text;
    }

    this.historyEl.appendChild(div);
    this._scrollToBottom();
    return div;
  }

  _scrollToBottom() {
    this.historyEl.scrollTop = this.historyEl.scrollHeight;
  }

  async _updateSentimentIndicator() {
    if (!this.currentCharacter) return;
    try {
      const sentiment = await this.api.getSentiment(this.currentCharacter);
      const moodEl = document.getElementById('dialog-mood');
      if (!moodEl) return;

      const stateIcons = {
        calm: '😐', nervous: '😰', angry: '😠', scared: '😨',
        defensive: '🛡️', cooperative: '🤝', hostile: '😤', desperate: '😱'
      };
      const icon = stateIcons[sentiment.emotionalState] || '😐';

      // Trust bar: -10 to +10 mapped to 0-100%
      const trust = ((sentiment.towardDetective + 10) / 20) * 100;
      const trustColor = trust > 60 ? '#4a9' : trust > 40 ? '#c9a84c' : '#c44';

      moodEl.innerHTML = `
        <span class="mood-icon">${icon}</span>
        <span class="mood-label">${sentiment.emotionalState}</span>
        <div class="mood-bar" title="Trust in detective: ${sentiment.towardDetective}">
          <div class="mood-bar-fill" style="width:${trust}%;background:${trustColor}"></div>
        </div>
      `;
      moodEl.classList.remove('hidden');
    } catch(err) {
      console.warn('Sentiment fetch failed:', err);
    }
  }
}
