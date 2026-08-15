class SpeechRecognitionService {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.transcript = '';
    this.onTranscriptCallback = null;
    this.onErrorCallback = null;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';

      this.recognition.onresult = (event) => {
        let currentText = '';
        for (let i = 0; i < event.results.length; i++) {
          currentText += event.results[i][0].transcript + ' ';
        }
        this.transcript = currentText.trim();
        if (this.onTranscriptCallback) {
          this.onTranscriptCallback(this.transcript);
        }
      };

      this.recognition.onerror = (event) => {
        console.warn('Speech recognition error:', event.error);
        if (this.onErrorCallback) {
          this.onErrorCallback(event.error);
        }
      };

      this.recognition.onend = () => {
        if (this.isListening) {
          // Auto-restart continuous recognition while active
          try {
            this.recognition.start();
          } catch (e) {
            console.warn('Auto-restart recognition notice:', e.message);
          }
        }
      };
    }
  }

  isSupported() {
    return !!this.recognition;
  }

  start(onTranscript, onError) {
    this.onTranscriptCallback = onTranscript;
    this.onErrorCallback = onError;
    this.transcript = '';

    if (!this.recognition) {
      if (onError) onError('Speech recognition is not supported in this browser. You can type or continue with simulated voice transcription.');
      return;
    }

    try {
      this.isListening = true;
      this.recognition.start();
    } catch (e) {
      console.warn('Recognition start exception:', e.message);
    }
  }

  stop() {
    this.isListening = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        console.warn('Recognition stop exception:', e.message);
      }
    }
    return this.transcript;
  }

  reset() {
    this.stop();
    this.transcript = '';
  }
}

export const speechService = new SpeechRecognitionService();
