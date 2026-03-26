'use client';

import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import { parseIntent, ParsedIntent } from '@/lib/voice/IntentParser';
import { isWebSpeechAvailable, getVoiceConfig, HIGH_RISK_ACTIONS, HAL_TTS_RATE, HAL_TTS_PITCH } from '@/lib/voice/voiceConfig';
import { isFeatureEnabled } from '@/lib/utils/featureFlags';

export type VoiceState = 'idle' | 'listening' | 'processing' | 'confirming';

export interface VoiceContextValue {
    /** Current voice state */
    state: VoiceState;
    /** Current transcript (live while listening) */
    transcript: string;
    /** Last parsed intent */
    lastIntent: ParsedIntent | null;
    /** Last error message */
    error: string | null;
    /** Last result message */
    resultMessage: string | null;
    /** Start listening */
    startListening: () => void;
    /** Stop listening */
    stopListening: () => void;
    /** Confirm a pending high-risk action */
    confirmAction: () => void;
    /** Cancel a pending action */
    cancelAction: () => void;
    /** Whether voice feature is enabled */
    enabled: boolean;
    /** Pending action description (for confirmation) */
    pendingActionDescription: string | null;
}

const VoiceContext = createContext<VoiceContextValue | null>(null);

export function useVoice(): VoiceContextValue {
    const ctx = useContext(VoiceContext);
    if (!ctx) {
        // Return a no-op context when outside provider
        return {
            state: 'idle',
            transcript: '',
            lastIntent: null,
            error: null,
            resultMessage: null,
            startListening: () => { },
            stopListening: () => { },
            confirmAction: () => { },
            cancelAction: () => { },
            enabled: false,
            pendingActionDescription: null,
        };
    }
    return ctx;
}

interface VoiceProviderProps {
    children: ReactNode;
    /** Callback when intent is parsed — should execute via CommandRegistry. May return a Promise. */
    onIntent?: (intent: ParsedIntent) => { success: boolean; message: string } | Promise<{ success: boolean; message: string }>;
}

export default function VoiceProvider({ children, onIntent }: VoiceProviderProps) {
    const enabled = isFeatureEnabled('voiceEnabled');
    const [state, setState] = useState<VoiceState>('idle');
    const [transcript, setTranscript] = useState('');
    const [lastIntent, setLastIntent] = useState<ParsedIntent | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [resultMessage, setResultMessage] = useState<string | null>(null);
    const [pendingActionDescription, setPendingActionDescription] = useState<string | null>(null);
    const recognitionRef = useRef<any>(null);
    const pendingIntentRef = useRef<ParsedIntent | null>(null);
    const accumulatedTranscriptRef = useRef<string>('');
    const endOfUtteranceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastFinalSegmentRef = useRef<string>('');
    const lastInterimRef = useRef<string>('');

    const clearMessages = useCallback(() => {
        // Auto-clear messages after delay
        setTimeout(() => {
            setError(null);
            setResultMessage(null);
        }, 5000);
    }, []);

    const executeIntent = useCallback(
        async (intent: ParsedIntent) => {
            if (onIntent) {
                const result = await Promise.resolve(onIntent(intent));
                if (result.success) {
                    setResultMessage(result.message);
                    speak(result.message);
                } else {
                    setError(result.message);
                }
            } else {
                setResultMessage(`Parsed: ${intent.type} ${JSON.stringify(intent.slots)}`);
            }
            setState('idle');
            setPendingActionDescription(null);
            pendingIntentRef.current = null;
            clearMessages();
        },
        [onIntent, clearMessages]
    );

    // Mobile speech recognition can repeat the same clause at the end.
    // Keep this conservative: only collapse exact repeated contiguous chunks.
    const dedupeTrailingTranscript = useCallback((input: string): string => {
        const normalized = input.replace(/\s+/g, ' ').trim();
        if (!normalized) return normalized;
        const words = normalized.split(' ');
        if (words.length < 6) return normalized;

        const maxChunk = Math.floor(words.length / 2);
        for (let size = maxChunk; size >= 3; size--) {
            const prev = words.slice(words.length - 2 * size, words.length - size).join(' ').toLowerCase();
            const tail = words.slice(words.length - size).join(' ').toLowerCase();
            if (prev === tail) {
                return words.slice(0, words.length - size).join(' ').trim();
            }
        }
        return normalized;
    }, []);

    const processTranscript = useCallback(
        (text: string) => {
            console.log('[Voice] Processing finalized transcript:', text);
            setState('processing');
            const intent = parseIntent(text);
            setLastIntent(intent);

            if (intent.type === 'UNKNOWN') {
                console.warn('[Voice] Intent not recognized for:', text);
                setError(`I didn't understand: "${text}"`);
                setState('idle');
                clearMessages();
                return;
            }

            // Check if high-risk action needs confirmation
            if (HIGH_RISK_ACTIONS.has(intent.type)) {
                console.log('[Voice] High-risk action detected, pending confirmation:', intent.type);
                pendingIntentRef.current = intent;
                setPendingActionDescription(
                    `${intent.type.replace('_', ' ').toLowerCase()}: ${intent.slots.name || intent.slots.entityType || 'item'}`
                );
                setState('confirming');
                // TTS feedback
                speak(`Are you sure you want to ${intent.type.replace('_', ' ').toLowerCase()} ${intent.slots.name || 'this item'}? Say confirm to proceed.`);
                return;
            }

            // Execute immediately for low-risk actions
            void executeIntent(intent);
        },
        [executeIntent]
    );

    const flushAndProcess = useCallback(() => {
        if (endOfUtteranceTimerRef.current) {
            clearTimeout(endOfUtteranceTimerRef.current);
            endOfUtteranceTimerRef.current = null;
        }
        if (lastInterimRef.current.trim()) {
            accumulatedTranscriptRef.current = (accumulatedTranscriptRef.current + ' ' + lastInterimRef.current).trim();
            lastInterimRef.current = '';
        }
        const text = accumulatedTranscriptRef.current.trim();
        accumulatedTranscriptRef.current = '';
        lastFinalSegmentRef.current = '';
        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch (_) {}
            recognitionRef.current = null;
        }
        setTranscript('');
        if (text) {
            processTranscript(dedupeTrailingTranscript(text));
        } else {
            setState('idle');
        }
    }, [processTranscript, dedupeTrailingTranscript]);

    const startListening = useCallback(() => {
        if (!enabled) return;
        setError(null);
        setResultMessage(null);
        setTranscript('');
        accumulatedTranscriptRef.current = '';
        lastFinalSegmentRef.current = '';
        lastInterimRef.current = '';
        if (endOfUtteranceTimerRef.current) {
            clearTimeout(endOfUtteranceTimerRef.current);
            endOfUtteranceTimerRef.current = null;
        }

        if (isWebSpeechAvailable()) {
            const SpeechRecognition =
                (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';
            const endOfUtteranceMs = getVoiceConfig().endOfUtteranceMs ?? 1400;

            recognition.onstart = () => {
                setState('listening');
            };

            recognition.onresult = (event: any) => {
                let interimTranscript = '';
                let hadNewContent = false;

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const result = event.results[i];
                    const text = result[0].transcript;
                    if (result.isFinal) {
                        const trimmed = text.trim();
                        if (trimmed && trimmed === lastFinalSegmentRef.current) {
                            // Duplicate final segment (common on mobile): skip append and timer reset so we can finalize
                            continue;
                        }
                        hadNewContent = true;
                        lastFinalSegmentRef.current = trimmed;
                        accumulatedTranscriptRef.current =
                            (accumulatedTranscriptRef.current + ' ' + text).trim();
                        setTranscript(accumulatedTranscriptRef.current);
                    } else {
                        interimTranscript += text;
                    }
                }

                if (interimTranscript) {
                    hadNewContent = true;
                    lastInterimRef.current = interimTranscript;
                    setTranscript(
                        (accumulatedTranscriptRef.current + ' ' + interimTranscript).trim()
                    );
                }

                if (hadNewContent) {
                    if (endOfUtteranceTimerRef.current) clearTimeout(endOfUtteranceTimerRef.current);
                    endOfUtteranceTimerRef.current = setTimeout(flushAndProcess, endOfUtteranceMs);
                }
            };

            recognition.onerror = (event: any) => {
                if (endOfUtteranceTimerRef.current) {
                    clearTimeout(endOfUtteranceTimerRef.current);
                    endOfUtteranceTimerRef.current = null;
                }
                accumulatedTranscriptRef.current = '';
                setError(`Voice error: ${event.error}`);
                setState('idle');
                clearMessages();
            };

            recognition.onend = () => {
                if (endOfUtteranceTimerRef.current) {
                    clearTimeout(endOfUtteranceTimerRef.current);
                    endOfUtteranceTimerRef.current = null;
                }
                const hasTranscript = accumulatedTranscriptRef.current.trim() || lastInterimRef.current.trim();
                if (hasTranscript) {
                    flushAndProcess();
                } else if (state === 'listening') {
                    setState('idle');
                }
            };

            recognitionRef.current = recognition;
            recognition.start();
        } else {
            setError('Web Speech API not available. Server STT fallback not yet configured.');
            clearMessages();
        }
    }, [enabled, flushAndProcess, state, clearMessages]);

    const stopListening = useCallback(() => {
        if (endOfUtteranceTimerRef.current) {
            clearTimeout(endOfUtteranceTimerRef.current);
            endOfUtteranceTimerRef.current = null;
        }
        accumulatedTranscriptRef.current = '';
        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch (_) {}
            recognitionRef.current = null;
        }
        if (state === 'listening') {
            setState('idle');
        }
        setTranscript('');
    }, [state]);

    const confirmAction = useCallback(() => {
        if (pendingIntentRef.current) {
            executeIntent(pendingIntentRef.current);
        }
    }, [executeIntent]);

    const cancelAction = useCallback(() => {
        pendingIntentRef.current = null;
        setPendingActionDescription(null);
        setState('idle');
        setResultMessage('Action cancelled.');
        clearMessages();
    }, [clearMessages]);

    const value: VoiceContextValue = {
        state,
        transcript,
        lastIntent,
        error,
        resultMessage,
        startListening,
        stopListening,
        confirmAction,
        cancelAction,
        enabled,
        pendingActionDescription,
    };

    return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
}

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
        if (femaleKeywords.some(k => name.includes(k))) return false;
        return maleKeywords.some(k => name.includes(k));
    };
    const pick = voices.find(v => v.lang.startsWith('en') && isMaleLike(v));
    if (pick) cachedHalVoice = pick;
    return cachedHalVoice ?? pick ?? null;
}

/** Simple TTS helper; uses config rate/pitch and HAL-like voice when ttsVoicePreference is 'hal'. */
function speak(text: string): void {
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
