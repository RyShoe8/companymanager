/**
 * Voice configuration: provider selection, feature flags, privacy settings.
 */

export interface VoiceConfig {
    /** STT strategy: 'webSpeech' | 'hybrid' | 'server' */
    sttStrategy: 'webSpeech' | 'hybrid' | 'server';
    /** TTS enabled */
    ttsEnabled: boolean;
    /** Whether to store transcripts */
    storeTranscripts: boolean;
    /** Max recording duration in seconds */
    maxRecordingDuration: number;
    /** Server STT endpoint (for hybrid/server mode) */
    serverSttEndpoint: string;
    /** Ms of silence after last final segment before finalizing (continuous recognition). */
    endOfUtteranceMs: number;
}

export function getVoiceConfig(): VoiceConfig {
    return {
        sttStrategy: 'hybrid', // Option B
        ttsEnabled: true,
        storeTranscripts: false,
        maxRecordingDuration: 30,
        serverSttEndpoint: '/api/voice/stt',
        endOfUtteranceMs: 1400,
    };
}

/** Actions that require explicit voice confirmation before executing */
export const HIGH_RISK_ACTIONS = new Set([
    'DELETE_ENTITY',
    'EDIT_ENTITY', // Status changes, unassign
]);

/** Check if Web Speech API is available */
export function isWebSpeechAvailable(): boolean {
    if (typeof window === 'undefined') return false;
    return !!(
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition
    );
}
