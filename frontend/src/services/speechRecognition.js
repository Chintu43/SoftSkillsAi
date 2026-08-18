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

    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('Web Speech API is not supported.');
      return;
    }

    this.recognition = new SpeechRecognition();

    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';
    this.recognition.maxAlternatives = 1;

    // ----------------------------------------
    // Recognition started
    // ----------------------------------------
    this.recognition.onstart = () => {
      console.log('🎤 Speech recognition started');
      this.isStarting = false;
    };

    // ----------------------------------------
    // Speech results
    // ----------------------------------------
    this.recognition.onresult = (event) => {
      let finalText = '';
      let interimText = '';

      for (
        let i = event.resultIndex;
        i < event.results.length;
        i++
      ) {
        const result = event.results[i];

        if (!result || !result[0]) continue;

        const text = result[0].transcript.trim();

        if (!text) continue;

        if (result.isFinal) {
          finalText += text + ' ';
        } else {
          interimText += text + ' ';
        }
      }

      // Store FINAL speech permanently
      if (finalText.trim()) {
        this.finalizedTranscript =
          `${this.finalizedTranscript} ${finalText}`
            .replace(/\s+/g, ' ')
            .trim();

        this.interimTranscript = '';
      }

      // Store current LIVE speech
      if (interimText.trim()) {
        this.interimTranscript = interimText.trim();
      }

      this.updateTranscript();
    };

    // ----------------------------------------
    // Recognition error
    // ----------------------------------------
    this.recognition.onerror = (event) => {
      console.warn(
        '🎤 Speech recognition error:',
        event.error
      );

      // These are normal Chrome events.
      if (
        event.error === 'no-speech' ||
        event.error === 'aborted'
      ) {
        return;
      }

      if (
        event.error === 'not-allowed' ||
        event.error === 'service-not-allowed'
      ) {
        this.isListening = false;
        this.shouldRestart = false;

        if (this.onErrorCallback) {
          this.onErrorCallback(
            'Microphone access denied. Please allow microphone access in Chrome.'
          );
        }

        return;
      }

      if (event.error === 'audio-capture') {
        if (this.onErrorCallback) {
          this.onErrorCallback(
            'Microphone could not be accessed. Please check your microphone.'
          );
        }

        return;
      }

      // Network errors can happen with Chrome's speech service.
      // Keep listening and let onend restart it.
      if (event.error === 'network') {
        console.warn(
          'Speech recognition network error. Attempting restart...'
        );
      }
    };

    // ----------------------------------------
    // Recognition stopped
    // ----------------------------------------
    this.recognition.onend = () => {
      console.log('🎤 Speech recognition ended');

      this.isStarting = false;

      // Preserve any current interim speech
      if (this.interimTranscript.trim()) {
        this.finalizedTranscript =
          `${this.finalizedTranscript} ${this.interimTranscript}`
            .replace(/\s+/g, ' ')
            .trim();

        this.interimTranscript = '';

        this.updateTranscript();
      }

      // Automatically restart while session is active
      if (
        this.isListening &&
        this.shouldRestart
      ) {
        this.scheduleRestart();
      }
    };
  }

  // ----------------------------------------
  // Combine final + live transcript
  // ----------------------------------------
  updateTranscript() {
    const finalText =
      this.finalizedTranscript.trim();

    const liveText =
      this.interimTranscript.trim();

    if (finalText && liveText) {
      this.transcript =
        `${finalText} ${liveText}`;
    } else if (finalText) {
      this.transcript = finalText;
    } else {
      this.transcript = liveText;
    }

    console.log(
      '📝 Live transcript:',
      this.transcript
    );

    if (this.onTranscriptCallback) {
      this.onTranscriptCallback(
        this.transcript
      );
    }
  }

  // ----------------------------------------
  // Schedule recognition restart
  // ----------------------------------------
  scheduleRestart() {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
    }

    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;

      if (
        this.isListening &&
        this.shouldRestart
      ) {
        this.startRecognition();
      }
    }, 300);
  }

  // ----------------------------------------
  // Safely start recognition
  // ----------------------------------------
  startRecognition() {
    if (!this.recognition) return;

    if (!this.isListening) return;

    if (this.isStarting) return;

    try {
      this.isStarting = true;

      console.log(
        '🎤 Starting speech recognition...'
      );

      this.recognition.start();
    } catch (error) {
      this.isStarting = false;

      console.warn(
        'Recognition start warning:',
        error.message
      );

      // Chrome may say recognition is already started.
      // Try again shortly.
      if (this.isListening) {
        this.scheduleRestart();
      }
    }
  }

  // ----------------------------------------
  // Browser support
  // ----------------------------------------
  isSupported() {
    return !!this.recognition;
  }

  // ----------------------------------------
  // Start a NEW speech session
  // ----------------------------------------
  start(onTranscript, onError) {
    console.log(
      '🎤 Starting NEW speech session'
    );

    // Stop old restart timer
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }

    // Stop previous recognition
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch (error) {
        // Ignore
      }
    }

    // Reset transcript
    this.finalizedTranscript = '';
    this.interimTranscript = '';
    this.transcript = '';

    // Set callbacks
    this.onTranscriptCallback =
      onTranscript;

    this.onErrorCallback =
      onError;

    this.isListening = true;
    this.shouldRestart = true;
    this.isStarting = false;

    if (!this.recognition) {
      if (onError) {
        onError(
          'Speech recognition is not supported in this browser. Please use Google Chrome.'
        );
      }

      return;
    }

    // Small delay prevents Chrome from rejecting
    // start() immediately after abort().
    setTimeout(() => {
      if (
        this.isListening &&
        this.shouldRestart
      ) {
        this.startRecognition();
      }
    }, 150);
  }

  // ----------------------------------------
  // Stop speech session
  // ----------------------------------------
  stop() {
    console.log(
      '🛑 Stopping speech recognition'
    );

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
      } catch (error) {
        console.warn(
          'Recognition stop warning:',
          error.message
        );
      }
    }

    // Preserve remaining interim speech
    if (this.interimTranscript.trim()) {
      this.finalizedTranscript =
        `${this.finalizedTranscript} ${this.interimTranscript}`
          .replace(/\s+/g, ' ')
          .trim();

      this.interimTranscript = '';
    }

    this.transcript =
      this.finalizedTranscript.trim();

    console.log(
      '📝 FINAL TRANSCRIPT:',
      this.transcript
    );

    return this.transcript;
  }

  // ----------------------------------------
  // Completely reset
  // ----------------------------------------
  reset() {
    this.stop();

    this.finalizedTranscript = '';
    this.interimTranscript = '';
    this.transcript = '';

    this.onTranscriptCallback = null;
    this.onErrorCallback = null;
  }
}

export const speechService =
  new SpeechRecognitionService();