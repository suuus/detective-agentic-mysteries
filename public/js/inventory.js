/**
 * InventoryManager — evidence collection and notebook clues.
 */
export class InventoryManager {
  /** @param {import('./api.js').GameAPI} api */
  constructor(api) {
    this.api = api;
    this.evidence = [];     // all evidence items from server
    this.clues = [];        // discovered clues / notebook entries
    this.contradictions = []; // detected NPC contradictions

    // DOM
    this.panel       = document.getElementById('inventory-panel');
    this.listEl      = document.getElementById('inventory-list');
    this.notebook    = document.getElementById('notebook-panel');
    this.notebookList = document.getElementById('notebook-list');
    this.evidenceDialogList = document.getElementById('dialog-evidence-list');
  }

  // ── Public API ─────────────────────────────────────────────────

  async refresh() {
    try {
      const data = await this.api.getEvidence();
      this.evidence = Array.isArray(data) ? data : data.evidence ?? [];
      await this._loadNotebook();
      this.renderInventory();
    } catch (err) {
      console.warn('Failed to refresh evidence:', err);
    }
  }

  toggle() {
    this.panel.classList.toggle('hidden');
    if (!this.panel.classList.contains('hidden')) {
      this.refresh();
    }
  }

  toggleNotebook() {
    this.notebook.classList.toggle('hidden');
    if (!this.notebook.classList.contains('hidden')) {
      this._loadNotebook();
    }
  }

  getCollected() {
    return this.evidence.filter((e) => e.collected);
  }

  renderInventory() {
    this.listEl.innerHTML = '';
    const collected = this.getCollected();

    if (collected.length === 0) {
      this.listEl.innerHTML = '<li class="empty-msg">No evidence collected yet.</li>';
      return;
    }

    for (const item of collected) {
      const li = document.createElement('li');
      li.style.display = 'flex';
      li.style.alignItems = 'center';
      li.innerHTML = `
        <span class="item-icon">${item.icon ?? '🔎'}</span>
        <span>
          <span class="item-name">${item.name}</span>
          <div class="item-desc">${item.description ?? ''}</div>
        </span>
      `;
      const analyzeBtn = document.createElement('button');
      analyzeBtn.className = 'gold-btn outline';
      analyzeBtn.style.cssText = 'font-size:0.7rem;padding:3px 8px;margin-left:auto';
      analyzeBtn.textContent = '🔬 Analyze';
      analyzeBtn.addEventListener('click', () => this._analyzeEvidence(item));
      li.appendChild(analyzeBtn);
      this.listEl.appendChild(li);
    }
  }

  renderNotebook() {
    this.notebookList.innerHTML = '';

    if (this.clues.length === 0 && this.contradictions.length === 0) {
      this.notebookList.innerHTML = '<li class="empty-msg">No clues recorded yet.</li>';
      return;
    }

    for (const clue of this.clues) {
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="item-icon">${clue.icon || '📝'}</span>
        <span>
          <span class="item-name">${clue.name}</span>
          <div class="item-desc">${clue.desc}${clue.day ? ` <small style="opacity:0.4">(Day ${clue.day})</small>` : ''}</div>
        </span>
      `;
      this.notebookList.appendChild(li);
    }

    // Contradictions section
    if (this.contradictions.length > 0) {
      const header = document.createElement('li');
      header.className = 'notebook-section-header';
      header.innerHTML = '<span class="item-icon">🔍</span><span class="item-name" style="color:#ff6b6b;font-weight:bold;">Contradictions</span>';
      this.notebookList.appendChild(header);

      for (const c of this.contradictions) {
        const li = document.createElement('li');
        li.style.borderLeft = '3px solid #ff6b6b';
        li.style.paddingLeft = '8px';
        li.innerHTML = `
          <span class="item-icon">⚠️</span>
          <span>
            <span class="item-name" style="color:#ff6b6b;">${c.npc1} and ${c.npc2} disagree about ${c.topic}</span>
            <div class="item-desc" style="color:#ffaaaa;">${c.detail}</div>
          </span>
        `;
        this.notebookList.appendChild(li);
      }
    }
  }

  async _loadNotebook() {
    try {
      const data = await (await fetch('/api/notebook')).json();
      this.clues = (data.clues || []).map(c => ({ icon: '📝', name: c.source, desc: c.text, day: c.day }));
      const previousContradictionCount = this.contradictions.length;
      this.contradictions = data.contradictions || [];
      // Play sting if new contradictions were detected
      if (this.contradictions.length > previousContradictionCount) {
        window.playSting?.('contradiction');
      }
      this.renderNotebook();
    } catch (err) {
      console.warn('Failed to load notebook:', err);
    }
  }

  async _analyzeEvidence(item) {
    const panel = document.getElementById('forensics-panel');
    const titleEl = document.getElementById('forensics-title');
    const textEl = document.getElementById('forensics-text');
    if (!panel || !titleEl || !textEl) return;
    
    titleEl.textContent = `🔬 Analyzing: ${item.name}`;
    textEl.textContent = 'Running forensic analysis...';
    panel.classList.remove('hidden');
    
    let fullText = '';
    try {
      for await (const chunk of this.api.analyzeEvidence(item.id)) {
        fullText += chunk;
        textEl.textContent = fullText;
      }
    } catch (err) {
      textEl.textContent = `Analysis failed: ${err.message}`;
    }
  }

  /** Render evidence list inside the dialog's "show evidence" sub-panel */
  renderEvidenceForDialog() {
    this.evidenceDialogList.innerHTML = '';
    const collected = this.getCollected();

    if (collected.length === 0) {
      this.evidenceDialogList.innerHTML = '<li>No evidence to present.</li>';
      return;
    }

    for (const item of collected) {
      const li = document.createElement('li');
      li.textContent = `${item.icon ?? '🔎'} ${item.name}`;
      li.addEventListener('click', () => {
        window.dialogManager?.presentEvidence(item.id);
      });
      this.evidenceDialogList.appendChild(li);
    }
  }

  /** Populate accusation modal evidence checkboxes */
  populateAccusationEvidence(container) {
    container.innerHTML = '';
    const collected = this.getCollected();

    if (collected.length === 0) {
      const msg = document.createElement('p');
      msg.style.cssText = 'color:#ef9a9a;font-style:italic;font-size:0.85rem;margin:8px 0';
      msg.textContent = 'No evidence collected yet. Explore the map and pick up evidence before making an accusation.';
      container.appendChild(msg);
      return;
    }

    for (const item of collected) {
      const label = document.createElement('label');
      label.innerHTML = `
        <input type="checkbox" value="${item.id}" />
        ${item.icon ?? '🔎'} ${item.name}
      `;
      container.appendChild(label);
    }
  }
}
