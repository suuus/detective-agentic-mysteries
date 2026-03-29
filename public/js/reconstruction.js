/**
 * Crime Reconstruction — chapter-based replay inside the accusation modal.
 * After a correct accusation, the modal transforms to show AI-generated
 * reconstruction chapters one at a time with "Next" navigation.
 */

const CHAR_DELAY = 15;         // ms per character in typewriter
const TTS_MAX_WAIT = 8000;     // max ms to wait for TTS to finish

/**
 * Play reconstruction inside the accusation modal.
 * Shows a loading state, fetches AI narration, then lets the player
 * step through chapters with a "Next" button.
 * Resolves when the player finishes the last chapter.
 * @param {import('./api.js').GameAPI} api
 * @returns {Promise<void>}
 */
export async function playReconstruction(api) {
  const replayEl    = document.getElementById('accusation-replay');
  const titleEl     = document.getElementById('replay-chapter-title');
  const textEl      = document.getElementById('replay-chapter-text');
  const progressEl  = document.getElementById('replay-progress');
  const nextBtn     = document.getElementById('replay-next');

  if (!replayEl || !textEl) throw new Error('Reconstruction DOM missing');

  // Show replay section with loading state
  replayEl.classList.remove('hidden');
  titleEl.textContent = '🔍 Crime Reconstruction';
  textEl.innerHTML = '';
  progressEl.textContent = '';
  nextBtn.classList.add('hidden');

  // Loading indicator
  const loadingEl = document.createElement('div');
  loadingEl.className = 'replay-loading';
  loadingEl.innerHTML = '<div class="replay-spinner"></div><span>Generating crime replay…</span>';
  replayEl.appendChild(loadingEl);

  // Fetch AI narration
  const { reconstruction } = await api.reconstruct();
  if (!reconstruction) throw new Error('Empty reconstruction');

  // Remove loading indicator
  loadingEl.remove();

  // Split into paragraphs (skip blanks)
  const paragraphs = reconstruction
    .split(/\n\n+|\n/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  if (paragraphs.length === 0) throw new Error('No paragraphs');

  // Step through chapters one at a time
  for (let i = 0; i < paragraphs.length; i++) {
    const isLast = i === paragraphs.length - 1;

    titleEl.textContent = isLast
      ? '🕵️ Detective Assessment'
      : `Chapter ${i + 1}`;
    progressEl.textContent = `${i + 1} / ${paragraphs.length}`;

    // Typewriter effect
    await typewrite(textEl, paragraphs[i]);

    // TTS narration
    if (window.speakNarration) {
      window.speakNarration(paragraphs[i]);
      await waitForTTS();
    }

    // Show navigation button and wait for click
    nextBtn.textContent = isLast ? 'Continue' : 'Next';
    nextBtn.classList.remove('hidden');
    await new Promise(resolve => {
      nextBtn.addEventListener('click', resolve, { once: true });
    });
    nextBtn.classList.add('hidden');
  }

  // Cleanup
  replayEl.classList.add('hidden');
  titleEl.textContent = '';
  textEl.textContent = '';
  progressEl.textContent = '';
}

// ── Helpers ──────────────────────────────────────────────────────

function typewrite(el, text) {
  return new Promise(resolve => {
    el.textContent = '';
    let idx = 0;

    const tick = () => {
      if (idx >= text.length) {
        el.textContent = text;
        resolve();
        return;
      }
      el.textContent += text[idx++];
      setTimeout(tick, CHAR_DELAY);
    };

    tick();
  });
}

function waitForTTS() {
  return new Promise(resolve => {
    const start = Date.now();

    const check = () => {
      if (!window.speechSynthesis?.speaking || Date.now() - start > TTS_MAX_WAIT) {
        resolve();
        return;
      }
      setTimeout(check, 200);
    };

    // Small initial delay so speechSynthesis.speaking becomes true
    setTimeout(check, 300);
  });
}
