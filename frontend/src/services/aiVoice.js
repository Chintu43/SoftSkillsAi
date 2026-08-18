/**
 * aiVoice.js — Reusable Text-To-Speech (TTS) Service using browser SpeechSynthesis API.
 *
 * Provides full control over AI debate opponent voice output:
 *   - speak(text, onStart, onEnd, onError)
 *   - stop()
 *   - getAvailableVoices()
 *   - rate, pitch, volume controls
 *   - guarantees clean completion callbacks so mic state machine never locks up
 */

class AIVoiceService {
  constructor() {
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.currentUtterance = null;
    this.selectedVoice = null;
    this.rate = 1.0;
    this.pitch = 1.0;
    this.volume = 1.0;
    this.autoSpeak = true;
    this.cachedVoices = [];

    if (this.synth) {
      this._loadVoices();
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => this._loadVoices();
      }
    }
  }

  _loadVoices() {
    if (!this.synth) return;
    try {
      this.cachedVoices = this.synth.getVoices();
    } catch (e) {
      console.warn('Voice loading error:', e);
    }
  }

  getAvailableVoices() {
    if (!this.cachedVoices || this.cachedVoices.length === 0) {
      this._loadVoices();
    }
    // Return all voices, prioritizing English voices
    const voices = this.cachedVoices || [];
    const englishVoices = voices.filter(v => v.lang && v.lang.startsWith('en'));
    return englishVoices.length > 0 ? englishVoices : voices;
  }

  setVoiceByName(name) {
    const voices = this.cachedVoices || [];
    const found = voices.find(v => v.name === name);
    if (found) {
      this.selectedVoice = found;
    }
  }

  speak(text, onStart, onEnd, onError) {
    this.stop(); // Stop any ongoing speech first

    if (!this.synth || !text || text.trim() === '') {
      if (onEnd) onEnd();
      return;
    }

    const cleanText = text.trim();

    try {
      const utterance = new SpeechSynthesisUtterance(cleanText);

      if (this.selectedVoice) {
        utterance.voice = this.selectedVoice;
      } else {
        // Fallback: Pick a good default English voice
        const englishVoices = this.getAvailableVoices();
        if (englishVoices.length > 0) {
          utterance.voice = englishVoices[0];
        }
      }

      utterance.rate = Math.max(0.7, Math.min(1.5, this.rate));
      utterance.pitch = Math.max(0.7, Math.min(1.3, this.pitch));
      utterance.volume = Math.max(0.0, Math.min(1.0, this.volume));

      let hasFinished = false;
      const safeOnEnd = () => {
        if (hasFinished) return;
        hasFinished = true;
        this.currentUtterance = null;
        if (onEnd) onEnd();
      };

      utterance.onstart = () => {
        if (onStart) onStart();
      };

      utterance.onend = () => {
        safeOnEnd();
      };

      utterance.onerror = (err) => {
        console.warn('Speech synthesis utterance error:', err);
        if (onError) onError(err);
        safeOnEnd(); // Always transition state even on error so mic isn't stuck
      };

      this.currentUtterance = utterance;
      this.synth.speak(utterance);

    } catch (err) {
      console.warn('Speech synthesis exception:', err);
      if (onError) onError(err);
      if (onEnd) onEnd();
    }
  }

  stop() {
    if (this.synth) {
      try {
        this.synth.cancel();
      } catch (e) {}
      this.currentUtterance = null;
    }
  }

  isSpeaking() {
    return !!(this.synth && (this.synth.speaking || this.synth.pending));
  }
}

export const aiVoiceService = new AIVoiceService();
