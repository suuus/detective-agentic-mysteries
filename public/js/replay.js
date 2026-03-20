/**
 * replay.js — Session replay timeline and analytics viewer.
 * Renders game events as a decision-tree timeline and shows analytics stats.
 */

export class ReplayViewer {
  constructor(api) {
    this.api = api;
    this.overlay = document.getElementById('replay-overlay');
    this.timeline = document.getElementById('replay-timeline');
    this.stats = document.getElementById('replay-stats');
    this.closeBtn = document.getElementById('replay-close');
    this.exportBtn = document.getElementById('replay-export');
    this.tabBtns = this.overlay?.querySelectorAll('.replay-tab') || [];

    this._bindEvents();
  }

  _bindEvents() {
    this.closeBtn?.addEventListener('click', () => this.close());
    this.exportBtn?.addEventListener('click', () => this._export());
    for (const tab of this.tabBtns) {
      tab.addEventListener('click', () => this._switchTab(tab.dataset.tab));
    }
  }

  async open() {
    this.overlay?.classList.remove('hidden');
    this._switchTab('timeline');
    await this._loadData();
  }

  close() {
    this.overlay?.classList.add('hidden');
  }

  isOpen() {
    return this.overlay && !this.overlay.classList.contains('hidden');
  }

  _switchTab(tabId) {
    for (const tab of this.tabBtns) {
      tab.classList.toggle('active', tab.dataset.tab === tabId);
    }
    if (this.timeline) this.timeline.classList.toggle('hidden', tabId !== 'timeline');
    if (this.stats) this.stats.classList.toggle('hidden', tabId !== 'analytics');
  }

  async _loadData() {
    try {
      const [replayData, analyticsData] = await Promise.all([
        this.api.getReplay(),
        this.api.getAnalytics(),
      ]);
      this._renderTimeline(replayData.events || []);
      this._renderAnalytics(analyticsData);
    } catch (err) {
      if (this.timeline) this.timeline.innerHTML = '<p class="replay-empty">No session data available yet. Start playing to record events.</p>';
      if (this.stats) this.stats.innerHTML = '';
      console.error('Replay data load failed:', err);
    }
  }

  _renderTimeline(events) {
    if (!this.timeline) return;
    if (events.length === 0) {
      this.timeline.innerHTML = '<p class="replay-empty">No events recorded yet. Start playing to record your session.</p>';
      return;
    }

    // Group events by day
    const days = {};
    for (const ev of events) {
      const key = `Day ${ev.day}`;
      if (!days[key]) days[key] = [];
      days[key].push(ev);
    }

    let html = '';
    for (const [dayLabel, dayEvents] of Object.entries(days)) {
      html += `<div class="replay-day">`;
      html += `<div class="replay-day-header">${dayLabel}</div>`;
      html += `<div class="replay-day-events">`;

      for (const ev of dayEvents) {
        const icon = this._eventIcon(ev.type);
        const time = this._formatTime(ev.elapsed);
        const detail = this._eventDetail(ev);
        html += `<div class="replay-event replay-event-${ev.type}">`;
        html += `  <span class="replay-event-icon">${icon}</span>`;
        html += `  <span class="replay-event-time">${time}</span>`;
        html += `  <span class="replay-event-action">${ev.action}</span>`;
        if (detail) {
          html += `<div class="replay-event-detail">${detail}</div>`;
        }
        html += `</div>`;
      }

      html += `</div></div>`;
    }

    this.timeline.innerHTML = html;
  }

  _renderAnalytics(data) {
    if (!this.stats) return;
    const duration = this._formatDuration(data.sessionDuration);
    const outcome = data.outcome === 'won' ? '🏆 Solved' : data.outcome === 'lost' ? '💀 Unsolved' : '🔍 In Progress';

    let npcRows = '';
    const sortedNPCs = Object.entries(data.npcInteractionCounts || {}).sort((a, b) => b[1] - a[1]);
    for (const [npc, count] of sortedNPCs) {
      const bar = '█'.repeat(Math.min(count, 20));
      npcRows += `<div class="replay-stat-row"><span class="replay-stat-label">${npc}</span><span class="replay-stat-bar">${bar}</span><span class="replay-stat-value">${count}</span></div>`;
    }

    let evidenceList = '';
    for (const [i, eid] of (data.evidenceCollectionOrder || []).entries()) {
      evidenceList += `<span class="replay-evidence-item">${i + 1}. ${eid}</span>`;
    }

    this.stats.innerHTML = `
      <div class="replay-analytics-grid">
        <div class="replay-analytics-card">
          <div class="replay-analytics-value">${outcome}</div>
          <div class="replay-analytics-label">Outcome</div>
        </div>
        <div class="replay-analytics-card">
          <div class="replay-analytics-value">${duration}</div>
          <div class="replay-analytics-label">Session Duration</div>
        </div>
        <div class="replay-analytics-card">
          <div class="replay-analytics-value">${data.daysPlayed}</div>
          <div class="replay-analytics-label">Days Played</div>
        </div>
        <div class="replay-analytics-card">
          <div class="replay-analytics-value">${data.totalQuestions}</div>
          <div class="replay-analytics-label">Questions Asked</div>
        </div>
        <div class="replay-analytics-card">
          <div class="replay-analytics-value">${data.evidenceCollected}</div>
          <div class="replay-analytics-label">Evidence Collected</div>
        </div>
        <div class="replay-analytics-card">
          <div class="replay-analytics-value">${data.contradictionsFound}</div>
          <div class="replay-analytics-label">Contradictions</div>
        </div>
        <div class="replay-analytics-card">
          <div class="replay-analytics-value">${data.accusationsMade}</div>
          <div class="replay-analytics-label">Accusations Made</div>
        </div>
        <div class="replay-analytics-card">
          <div class="replay-analytics-value">${data.mostQuestionedNPC || '—'}</div>
          <div class="replay-analytics-label">Most Questioned</div>
        </div>
      </div>

      ${sortedNPCs.length > 0 ? `
        <h4 class="replay-section-title">NPC Interactions</h4>
        <div class="replay-stat-chart">${npcRows}</div>
      ` : ''}

      ${evidenceList ? `
        <h4 class="replay-section-title">Evidence Discovery Order</h4>
        <div class="replay-evidence-order">${evidenceList}</div>
      ` : ''}
    `;
  }

  async _export() {
    try {
      const data = await this.api.exportReplay();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `detective-replay-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
  }

  _eventIcon(type) {
    const icons = {
      talk: '💬',
      evidence_collect: '📦',
      evidence_show: '👁️',
      day_advance: '🌙',
      accusation: '⚖️',
      hidden_room: '🚪',
      red_herring: '🎭',
      murder_event: '💀',
      sentiment_change: '💭',
      contradiction: '⚠️',
      clue: '📝',
      game_start: '🎬',
      game_end: '🏁',
    };
    return icons[type] || '•';
  }

  _eventDetail(ev) {
    switch (ev.type) {
      case 'talk':
        return ev.details?.question ? `"${ev.details.question}"` : '';
      case 'evidence_collect':
        return ev.details?.evidenceName || '';
      case 'evidence_show':
        return `${ev.details?.evidenceId} → ${ev.details?.characterId}`;
      case 'accusation':
        return ev.details?.correct ? '✓ Correct' : '✗ Wrong';
      case 'day_advance':
        return ev.details?.phase === 'night' ? 'Night fell' : `Day ${ev.details?.day}`;
      default:
        return '';
    }
  }

  _formatTime(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
  }

  _formatDuration(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes === 0) return `${seconds}s`;
    return `${minutes}m ${seconds}s`;
  }
}
