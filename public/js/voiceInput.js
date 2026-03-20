/**
 * voiceInput.js — Speech-to-text input for NPC interrogation.
 * Uses the Web Speech API (SpeechRecognition) for browser-native STT.
 * Push-to-talk: hold the mic button (or press V) to record, release to send.
 *
 * TO REMOVE: Delete this file and remove from main.js + dialog.js references.
 */

export class VoiceInputManager {
  constructor() {
    /** @type {SpeechRecognition|null} */
    this.recognition = null;
    this.supported = false;
    this.listening = false;
    this.voiceMode = false;
    this.transcript = '';

    // Callbacks — set by DialogManager
    /** @type {((text: string) => void)|null} */
    this.onResult = null;
    /** @type {((listening: boolean) => void)|null} */
    this.onListeningChange = null;
    /** @type {((text: string) => void)|null} */
    this.onInterimResult = null;

    this._init();
  }

  _init() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.log('[Voice] SpeechRecognition not supported in this browser');
      return;
    }

    this.supported = true;
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';
    this.recognition.maxAlternatives = 1;

    this.recognition.addEventListener('result', (event) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (final) {
        this.transcript = final.trim();
        this.onResult?.(this.transcript);
        this._setListening(false);
      } else if (interim) {
        this.onInterimResult?.(interim);
      }
    });

    this.recognition.addEventListener('end', () => {
      // If we were still listening (no final result received), send whatever we have
      if (this.listening) {
        if (this.transcript) {
          this.onResult?.(this.transcript);
        }
        this._setListening(false);
      }
    });

    this.recognition.addEventListener('error', (event) => {
      if (event.error === 'not-allowed') {
        console.warn('[Voice] Microphone permission denied');
      } else if (event.error !== 'aborted' && event.error !== 'no-speech') {
        console.warn('[Voice] Recognition error:', event.error);
      }
      this._setListening(false);
    });
  }

  /** Start listening for speech input. */
  startListening() {
    if (!this.supported || !this.recognition || this.listening) return;
    this.transcript = '';
    this._setListening(true);
    try {
      this.recognition.start();
    } catch {
      // Already started — ignore
      this._setListening(false);
    }
  }

  /** Stop listening and process any pending result. */
  stopListening() {
    if (!this.recognition || !this.listening) return;
    try {
      this.recognition.stop();
    } catch {
      // Not started — ignore
    }
  }

  /** Toggle voice mode on/off. */
  toggleVoiceMode() {
    this.voiceMode = !this.voiceMode;
    if (!this.voiceMode && this.listening) {
      this.stopListening();
    }
    return this.voiceMode;
  }

  /** Set voice mode explicitly. */
  setVoiceMode(on) {
    this.voiceMode = on;
    if (!on && this.listening) {
      this.stopListening();
    }
  }

  /** Check if the browser supports speech recognition. */
  isSupported() {
    return this.supported;
  }

  _setListening(flag) {
    this.listening = flag;
    this.onListeningChange?.(flag);
  }
}

/**
 * Create and wire up the voice UI elements in the dialog panel.
 * Returns the manager instance.
 */
export function initVoiceInput() {
  const manager = new VoiceInputManager();

  // ── Create UI elements ──
  const inputRow = document.querySelector('.dialog-input-row');
  if (!inputRow) return manager;

  // Mic button (push-to-talk)
  const micBtn = document.createElement('button');
  micBtn.id = 'dialog-mic-btn';
  micBtn.className = 'gold-btn outline voice-btn';
  micBtn.title = manager.supported ? 'Hold to speak (V)' : 'Voice input not supported';
  micBtn.innerHTML = '🎤';
  micBtn.disabled = !manager.supported;

  // Voice mode toggle
  const voiceToggle = document.createElement('button');
  voiceToggle.id = 'dialog-voice-toggle';
  voiceToggle.className = 'gold-btn outline voice-btn voice-toggle';
  voiceToggle.title = 'Toggle voice mode';
  voiceToggle.innerHTML = '🔇';
  voiceToggle.style.display = manager.supported ? '' : 'none';

  // Visual feedback container (waveform)
  const waveform = document.createElement('div');
  waveform.id = 'voice-waveform';
  waveform.className = 'voice-waveform hidden';
  waveform.innerHTML = '<span></span><span></span><span></span><span></span><span></span>';

  // Insert mic button before Send button
  const sendBtn = document.getElementById('dialog-send-btn');
  if (sendBtn) {
    inputRow.insertBefore(micBtn, sendBtn);
  }

  // Insert voice toggle after Show Evidence button
  const evidenceBtn = document.getElementById('dialog-evidence-btn');
  if (evidenceBtn) {
    evidenceBtn.after(voiceToggle);
  }

  // Insert waveform above input row
  inputRow.parentElement.insertBefore(waveform, inputRow);

  // ── Wire up mic button (push-to-talk) ──
  micBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    manager.startListening();
  });
  micBtn.addEventListener('mouseup', () => manager.stopListening());
  micBtn.addEventListener('mouseleave', () => {
    if (manager.listening) manager.stopListening();
  });

  // Touch support
  micBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    manager.startListening();
  });
  micBtn.addEventListener('touchend', () => manager.stopListening());

  // ── Wire up voice toggle ──
  voiceToggle.addEventListener('click', () => {
    const on = manager.toggleVoiceMode();
    voiceToggle.innerHTML = on ? '🔊' : '🔇';
    voiceToggle.title = on ? 'Voice mode ON (click to disable)' : 'Toggle voice mode';
    voiceToggle.classList.toggle('active', on);
  });

  // ── Visual feedback ──
  manager.onListeningChange = (listening) => {
    micBtn.classList.toggle('recording', listening);
    waveform.classList.toggle('hidden', !listening);
    micBtn.innerHTML = listening ? '⏺️' : '🎤';
  };

  // Show interim transcript in the input field
  const input = document.getElementById('dialog-input');
  manager.onInterimResult = (text) => {
    if (input) {
      input.value = text;
      input.placeholder = 'Listening…';
    }
  };

  // On final result, restore placeholder
  const originalOnResult = manager.onResult;
  manager.onResult = (text) => {
    if (input) {
      input.value = text;
      input.placeholder = 'Ask a question…';
    }
    originalOnResult?.(text);
  };

  // ── Keyboard shortcut: V key for push-to-talk ──
  // Only when dialog is open and input is not focused
  document.addEventListener('keydown', (e) => {
    if (e.key === 'v' || e.key === 'V') {
      const dialogOverlay = document.getElementById('dialog-overlay');
      if (!dialogOverlay || dialogOverlay.classList.contains('hidden')) return;
      // Don't trigger if typing in the input field
      if (document.activeElement === input) return;
      if (!manager.listening) {
        e.preventDefault();
        manager.startListening();
      }
    }
  });
  document.addEventListener('keyup', (e) => {
    if ((e.key === 'v' || e.key === 'V') && manager.listening) {
      manager.stopListening();
    }
  });

  return manager;
}
