import { getVoiceConfig, HAL_TTS_RATE, HAL_TTS_PITCH } from '@/lib/voice/voiceConfig';

/** Cached deep male English voice for HAL-like TTS (populated when getVoices() is ready) */
let cachedHalVoice: SpeechSynthesisVoice | null = null;

function getHalVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return cachedHalVoice;
  const maleKeywords = ['male', 'david', 'daniel', 'james', 'paul', 'mark', 'google us english male'];
  const femaleKeywords = ['female', 'samantha', 'victoria', 'karen', 'moira', 'alice', 'google uk english female'];
  const isMaleLike = (v: SpeechSynthesisVoice) => {
    const name = v.name.toLowerCase();
    if (femaleKeywords.some((k) => name.includes(k))) return false;
    return maleKeywords.some((k) => name.includes(k));
  };
  const pick = voices.find((v) => v.lang.startsWith('en') && isMaleLike(v));
  if (pick) cachedHalVoice = pick;
  return cachedHalVoice ?? pick ?? null;
}

/** TTS helper; uses config rate/pitch and HAL-like voice when ttsVoicePreference is 'hal'. */
export function speakClientTts(text: string): void {
  if (typeof window === 'undefined') return;
  const config = getVoiceConfig();
  if (!config.ttsEnabled) return;
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(text);
    const isHal = config.ttsVoicePreference === 'hal';
    const rate = config.ttsRate ?? (isHal ? HAL_TTS_RATE : 1.1);
    const pitch = config.ttsPitch ?? (isHal ? HAL_TTS_PITCH : 1);
    utterance.rate = Math.max(0.8, Math.min(2, rate));
    utterance.pitch = Math.max(0.5, Math.min(2, pitch));
    if (isHal) {
      const voice = getHalVoice();
      if (voice) utterance.voice = voice;
    }
    window.speechSynthesis.speak(utterance);
  }
}
