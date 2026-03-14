/**
 * Crime Reconstruction — cinematic narration overlay after a win.
 * Fetches AI-generated reconstruction from the Director, then plays
 * each paragraph with typewriter text, background fades, and TTS.
 */

const CHAR_DELAY = 15;         // ms per character in typewriter
const PAUSE_BETWEEN = 1000;    // ms pause ("...") between paragraphs
const TTS_MAX_WAIT = 8000;     // max ms to wait for TTS to finish
const BG_COLORS = [
  'rgba(0,0,0,0.97)',
  'rgba(40,8,8,0.97)',
  'rgba(0,0,0,0.97)',
  'rgba(25,5,15,0.97)',
  'rgba(0,0,0,0.97)',
  'rgba(40,8,8,0.97)',
  'rgba(0,0,0,0.97)',
];

/**
 * Play the full reconstruction sequence.
 * Resolves when the player clicks "Continue" at the end.
 * Rejects (gracefully) if the API call fails.
 * @param {import('./api.js').GameAPI} api
 * @returns {Promise<void>}
 */
export async function playReconstruction(api) {
  const overlay  = document.getElementById('reconstruction-overlay');
  const titleEl  = document.getElementById('reconstruction-title');
  const textEl   = document.getElementById('reconstruction-text');
  const progEl   = document.getElementById('reconstruction-progress');

  if (!overlay || !textEl) throw new Error('Reconstruction DOM missing');

  // Fetch AI narration
  const { reconstruction } = await api.reconstruct();
  if (!reconstruction) throw new Error('Empty reconstruction');

  // Split into paragraphs (skip blanks)
  const paragraphs = reconstruction
    .split(/\n\n+|\n/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  if (paragraphs.length === 0) throw new Error('No paragraphs');

  // Show overlay
  overlay.classList.remove('hidden');

  // State for skip-click handling
  let skipRequested = false;
  let resolveSkip = null;

  const onSkipClick = () => { skipRequested = true; resolveSkip?.(); };
  textEl.addEventListener('click', onSkipClick);
  overlay.addEventListener('click', onSkipClick);

  try {
    for (let i = 0; i < paragraphs.length; i++) {
      const para = paragraphs[i];

      // Background color transition
      overlay.style.background = BG_COLORS[i % BG_COLORS.length];

      // Progress indicator
      progEl.textContent = `${i + 1} / ${paragraphs.length}`;

      // Typewriter effect (cancelable)
      skipRequested = false;
      await typewrite(textEl, para, () => skipRequested);

      // TTS narration
      if (window.speakNarration) {
        window.speakNarration(para);
        await waitForTTS();
      }

      // Pause between paragraphs
      if (i < paragraphs.length - 1) {
        textEl.textContent += '\n\n...';
        await delay(PAUSE_BETWEEN);
      }
    }
  } finally {
    textEl.removeEventListener('click', onSkipClick);
    overlay.removeEventListener('click', onSkipClick);
  }

  // Finale: "Case Closed" title + continue button
  overlay.style.background = 'rgba(0,0,0,0.97)';
  titleEl.textContent = '⚖️ Case Closed';
  titleEl.style.animation = 'none';
  void titleEl.offsetHeight;          // reflow to restart animation
  titleEl.style.animation = 'reconFadeIn 1s ease-out forwards';
  textEl.style.cursor = 'default';
  progEl.textContent = '';

  const btn = document.createElement('button');
  btn.className = 'gold-btn';
  btn.textContent = 'Continue';
  btn.style.marginTop = '24px';

  const contentEl = document.getElementById('reconstruction-content');
  contentEl.appendChild(btn);

  await new Promise(resolve => btn.addEventListener('click', resolve, { once: true }));

  // Cleanup
  btn.remove();
  overlay.classList.add('hidden');
  textEl.textContent = '';
  titleEl.textContent = '🔍 Crime Reconstruction';
}

// ── Helpers ──────────────────────────────────────────────────────

function typewrite(el, text, shouldSkip) {
  return new Promise(resolve => {
    el.textContent = '';
    let idx = 0;

    const tick = () => {
      if (shouldSkip() || idx >= text.length) {
        el.textContent = text;        // show full text immediately
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

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}
