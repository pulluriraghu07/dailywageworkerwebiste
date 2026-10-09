// DailyWork Speech & Audio Engine (TTS + STT + WebAudio Chime)

const VOICE_LANG_MAP = {
  en: 'en-IN',
  hi: 'hi-IN',
  te: 'te-IN',
  ta: 'ta-IN',
  kn: 'kn-IN',
  ur: 'ur-IN',
  bn: 'bn-IN',
  mr: 'mr-IN'
};

class SpeechEngine {
  constructor() {
    this.synth = window.speechSynthesis || null;
    this.recognition = null;
    this.activeUtterance = null;
    this.activeMicBtn = null;
    this.isListening = false;
    this.audioCtx = null;
    this.voices = [];

    if (this.synth) {
      this.loadVoices();
      if (typeof speechSynthesis.onvoiceschanged !== 'undefined') {
        speechSynthesis.onvoiceschanged = () => this.loadVoices();
      }
    }
  }

  loadVoices() {
    if (!this.synth) return;
    this.voices = this.synth.getVoices();
  }

  // --- TEXT TO SPEECH (TTS) ---
  speak(text, lang = 'en') {
    if (!this.synth) {
      if (typeof showToast === 'function') showToast("🔊 Text-to-speech is not supported on this browser.");
      return;
    }

    this.synth.cancel(); // Stop any active playback

    const cleanText = String(text)
      .replace(/[*#_~]/g, '')
      .replace(/<[^>]*>/g, '')
      .trim();

    if (!cleanText) return;

    const targetLangCode = VOICE_LANG_MAP[lang] || 'en-IN';
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = targetLangCode;
    utterance.rate = 0.93; // slightly slower for clear comprehension
    utterance.pitch = 1.0;

    // Pick best matching native voice if available
    const matchedVoice = this.voices.find(v => v.lang === targetLangCode) ||
                         this.voices.find(v => v.lang.startsWith(targetLangCode.split('-')[0])) ||
                         this.voices.find(v => v.lang.includes('IN'));

    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    utterance.onstart = () => {
      document.body.classList.add('audio-speaking');
    };

    utterance.onend = () => {
      document.body.classList.remove('audio-speaking');
      document.querySelectorAll('.speak-btn.active').forEach(b => b.classList.remove('active'));
    };

    utterance.onerror = () => {
      document.body.classList.remove('audio-speaking');
      document.querySelectorAll('.speak-btn.active').forEach(b => b.classList.remove('active'));
    };

    this.activeUtterance = utterance;
    this.synth.speak(utterance);
  }

  speakElement(btn, targetSelectorOrText, lang) {
    document.querySelectorAll('.speak-btn.active').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    let textToSpeak = '';
    if (typeof targetSelectorOrText === 'string' && (targetSelectorOrText.startsWith('#') || targetSelectorOrText.startsWith('.'))) {
      const el = document.querySelector(targetSelectorOrText);
      textToSpeak = el ? (el.innerText || el.textContent) : targetSelectorOrText;
    } else {
      textToSpeak = targetSelectorOrText;
    }

    this.speak(textToSpeak, lang || window.currentAppLang || 'en');
  }

  stop() {
    if (this.synth) this.synth.cancel();
    document.body.classList.remove('audio-speaking');
    document.querySelectorAll('.speak-btn.active').forEach(b => b.classList.remove('active'));
  }

  // --- SPEECH TO TEXT (STT) ---
  listen(targetInputId, btnEl, lang = 'en') {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      if (typeof showToast === 'function') {
        showToast("🎤 Speech recognition is not supported in this browser. Please type directly.");
      }
      return;
    }

    // Toggle off if already listening on this field
    if (this.isListening && this.activeMicBtn === btnEl) {
      this.stopListening();
      return;
    }

    this.stopListening();

    try {
      this.recognition = new SR();
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.maxAlternatives = 1;
      this.recognition.lang = VOICE_LANG_MAP[lang] || 'en-IN';

      this.activeMicBtn = btnEl;
      if (btnEl) btnEl.classList.add('listening');
      this.isListening = true;

      const targetInput = document.getElementById(targetInputId);
      if (typeof showToast === 'function') {
        showToast("🎤 Listening... speak your answer now");
      }

      this.recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (targetInput) {
          if (targetInput.tagName === 'SELECT') {
            // Find option matching spoken text
            const options = [...targetInput.options];
            const match = options.find(o => o.text.toLowerCase().includes(transcript.toLowerCase()));
            if (match) targetInput.value = match.value;
          } else {
            targetInput.value = targetInput.value ? (targetInput.value + ' ' + transcript).trim() : transcript;
          }

          // Trigger change & input events so dynamic updates (e.g. wage slider) take effect
          targetInput.dispatchEvent(new Event('input', { bubbles: true }));
          targetInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (typeof showToast === 'function') {
          showToast(`✓ Captured: "${transcript}"`);
        }
      };

      this.recognition.onerror = (e) => {
        console.warn('Speech recognition error:', e.error);
        if (typeof showToast === 'function') {
          showToast("🎤 Could not capture voice clearly. Please try speaking again.");
        }
        this.stopListening();
      };

      this.recognition.onend = () => {
        this.stopListening();
      };

      this.recognition.start();
    } catch (err) {
      console.error(err);
      this.stopListening();
    }
  }

  stopListening() {
    if (this.recognition) {
      try { this.recognition.stop(); } catch(e) {}
      this.recognition = null;
    }
    if (this.activeMicBtn) {
      this.activeMicBtn.classList.remove('listening');
      this.activeMicBtn = null;
    }
    this.isListening = false;
  }

  // --- WEBAUDIO NOTIFICATION CHIME ---
  playNotificationSound() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      if (!this.audioCtx) this.audioCtx = new AudioContext();

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;

      // Tone 1
      const osc1 = this.audioCtx.createOscillator();
      const gain1 = this.audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now); // D5
      gain1.gain.setValueAtTime(0.15, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(this.audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      // Tone 2 (Harmonic bell chime)
      const osc2 = this.audioCtx.createOscillator();
      const gain2 = this.audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.12); // A5
      gain2.gain.setValueAtTime(0.2, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc2.connect(gain2);
      gain2.connect(this.audioCtx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.55);
    } catch (e) {
      // Audio context might be restricted before user interaction
    }
  }
}

// Global singleton instance
window.speechEngine = new SpeechEngine();
