/**
 * speechRecognition.js — Mobile & Desktop Robust Web Speech API Service
 *
 * Designed to eliminate Android/iOS speech duplication during continuous recognition,
 * preserve legitimate user word repetitions (e.g. "really really"),
 * and handle seamless background restarts without corrupting or duplicating transcript history.
 */

class SpeechRecognitionService {
  constructor() {
    this.recognition = null;

    this.isListening = false;
    this.isStarting = false;
    this.shouldRestart = false;

    this.finalizedTranscript = '';
    this.interimTranscript = '';
    this.transcript = '';

    this.onTranscriptCallback = null;
    this.onErrorCallback = null;

    this.restartTimer = null;
    this.restartCount = 0;

    const SpeechRecognition =
      typeof window !== 'undefined'
        ? (window.SpeechRecognition || window.webkitSpeechRecognition)
        : null;

    if (!SpeechRecognition) {
      console.warn('Web Speech API is not supported in this browser environment.');
      return;
    }

    this.recognition = new SpeechRecognition();

    // Standard SpeechRecognition configuration
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';
    this.recognition.maxAlternatives = 1;

    // ----------------------------------------
    // Recognition start event
    // ----------------------------------------
    this.recognition.onstart = () => {
      this.isStarting = false;
      if (process.env.NODE_ENV === 'development') {
        console.log('🎤 Speech recognition active. Session count:', this.restartCount);
      }
    };

    // ----------------------------------------
    // Speech results processing
    // ----------------------------------------
    this.recognition.onresult = (event) => {
      let newlyFinalizedChunk = '';
      let currentInterim = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result || !result[0]) continue;

        const piece = (result[0].transcript || '').trim();
        if (!piece) continue;

        if (result.isFinal) {
          newlyFinalizedChunk += (newlyFinalizedChunk ? ' ' : '') + piece;
        } else {
          currentInterim += (currentInterim ? ' ' : '') + piece;
        }
      }

      // Process newly finalized speech with boundary overlap deduplication
      if (newlyFinalizedChunk) {
        const cleanChunk = newlyFinalizedChunk.trim();
        this.finalizedTranscript = this._mergeTailOverlap(this.finalizedTranscript, cleanChunk);
        this.interimTranscript = '';
      } else {
        // Update live interim speech (transient, never permanently baked until finalized)
        this.interimTranscript = currentInterim.trim();
      }

      this.updateTranscript();
    };

    // ----------------------------------------
    // Recognition error handling
    // ----------------------------------------
    this.recognition.onerror = (event) => {
      // Normal harmless WebSpeech events
      if (event.error === 'no-speech' || event.error === 'aborted') {
        return;
      }

      console.warn('🎤 Speech recognition error:', event.error);

      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        this.isListening = false;
        this.shouldRestart = false;

        if (this.onErrorCallback) {
          this.onErrorCallback('Microphone access denied. Please enable microphone permissions in your browser settings.');
        }
        return;
      }

      if (event.error === 'audio-capture') {
        if (this.onErrorCallback) {
          this.onErrorCallback('Microphone could not be accessed. Please check that your microphone is properly connected.');
        }
        return;
      }

      // Network errors on mobile: let onend trigger a safe restart
      if (event.error === 'network') {
        console.warn('Speech recognition network blip. Will restart automatically...');
      }
    };

    // ----------------------------------------
    // Recognition stopped / session ended
    // ----------------------------------------
    this.recognition.onend = () => {
      this.isStarting = false;

      // DO NOT bake interimTranscript into finalizedTranscript during automatic restarts!
      // On mobile Android/iOS, automatic onend occurs between pauses.
      // Baking interim text here was the primary cause of duplicated words on mobile.
      this.interimTranscript = '';

      // Automatically restart while user recording is active
      if (this.isListening && this.shouldRestart) {
        this.restartCount += 1;
        this.scheduleRestart();
      }
    };
  }

  /**
   * Overlapping tail deduplication across WebSpeech restarts.
   * Prevents boundary duplication on mobile/Chrome restarts while preserving intentional speech repetitions.
   */
  _mergeTailOverlap(existingText, incomingText) {
    if (!existingText || !existingText.trim()) return incomingText.trim();
    if (!incomingText || !incomingText.trim()) return existingText.trim();

    const existing = existingText.trim();
    const incoming = incomingText.trim();

    const eWords = existing.split(/\s+/);
    const iWords = incoming.split(/\s+/);

    const eLower = eWords.map(w => w.toLowerCase().replace(/[^\w]/g, ''));
    const iLower = iWords.map(w => w.toLowerCase().replace(/[^\w]/g, ''));

    let maxOverlap = 0;
    const maxCheck = Math.min(eWords.length, iWords.length);

    for (let len = maxCheck; len >= 1; len--) {
      let match = true;
      for (let k = 0; k < len; k++) {
        const eWord = eLower[eLower.length - len + k];
        const iWord = iLower[k];
        if (eWord !== iWord && eWord !== '' && iWord !== '') {
          match = false;
          break;
        }
      }
      if (match) {
        maxOverlap = len;
        break;
      }
    }

    if (maxOverlap > 0) {
      if (maxOverlap === iWords.length) {
        return existing;
      }
      const remainder = iWords.slice(maxOverlap).join(' ');
      return `${existing} ${remainder}`;
    }

    return `${existing} ${incoming}`;
  }

  /**
   * Helper to prevent boundary double-appending across mobile engine restarts
   */
  _isDuplicateTail(existingText, newChunk) {
    if (!existingText || !newChunk) return false;
    const existing = existingText.toLowerCase().trim();
    const incoming = newChunk.toLowerCase().trim();

    if (existing === incoming) return true;
    if (existing.endsWith(incoming)) {
      const prevChar = existing[existing.length - incoming.length - 1];
      if (prevChar === undefined || prevChar === ' ' || prevChar === '.' || prevChar === ',') {
        return true;
      }
    }
    return false;
  }

  // ----------------------------------------
  // Combine final + live interim transcript
  // ----------------------------------------
  updateTranscript() {
    const finalPart = this.finalizedTranscript.trim();
    const interimPart = this.interimTranscript.trim();

    if (finalPart && interimPart) {
      this.transcript = `${finalPart} ${interimPart}`;
    } else if (finalPart) {
      this.transcript = finalPart;
    } else {
      this.transcript = interimPart;
    }

    if (this.onTranscriptCallback) {
      this.onTranscriptCallback(this.transcript);
    }
  }

  // ----------------------------------------
  // Schedule safe recognition restart
  // ----------------------------------------
  scheduleRestart() {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
    }

    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      if (this.isListening && this.shouldRestart) {
        this.startRecognition();
      }
    }, 200);
  }

  // ----------------------------------------
  // Safely start recognition instance
  // ----------------------------------------
  startRecognition() {
    if (!this.recognition) return;
    if (!this.isListening) return;
    if (this.isStarting) return;

    try {
      this.isStarting = true;
      this.recognition.start();
    } catch (error) {
      this.isStarting = false;
      if (this.isListening && this.shouldRestart) {
        this.scheduleRestart();
      }
    }
  }

  // ----------------------------------------
  // Browser support check
  // ----------------------------------------
  isSupported() {
    return !!this.recognition;
  }

  // ----------------------------------------
  // Start a NEW user recording session
  // ----------------------------------------
  start(onTranscript, onError) {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }

    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch (error) {}
    }

    this.finalizedTranscript = '';
    this.interimTranscript = '';
    this.transcript = '';
    this.restartCount = 0;

    this.onTranscriptCallback = onTranscript;
    this.onErrorCallback = onError;

    this.isListening = true;
    this.shouldRestart = true;
    this.isStarting = false;

    if (!this.recognition) {
      if (onError) {
        onError('Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.');
      }
      return;
    }

    setTimeout(() => {
      if (this.isListening && this.shouldRestart) {
        this.startRecognition();
      }
    }, 120);
  }

  // ----------------------------------------
  // Stop user recording session
  // ----------------------------------------
  stop() {
    this.isListening = false;
    this.shouldRestart = false;
    this.isStarting = false;

    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }

    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (error) {}
    }

    if (this.interimTranscript.trim()) {
      const remaining = this.interimTranscript.trim();
      this.finalizedTranscript = this._mergeTailOverlap(this.finalizedTranscript, remaining);
      this.interimTranscript = '';
    }

    this.transcript = this.finalizedTranscript.trim();
    return this.transcript;
  }

  // ----------------------------------------
  // Full reset
  // ----------------------------------------
  reset() {
    this.stop();
    this.finalizedTranscript = '';
    this.interimTranscript = '';
    this.transcript = '';
    this.onTranscriptCallback = null;
    this.onErrorCallback = null;
    this.restartCount = 0;
  }
}

export const speechService = new SpeechRecognitionService();