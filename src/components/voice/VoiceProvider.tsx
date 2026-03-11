'use client';

import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import { parseIntent, ParsedIntent } from '@/lib/voice/IntentParser';
import { isWebSpeechAvailable, getVoiceConfig, HIGH_RISK_ACTIONS } from '@/lib/voice/voiceConfig';
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
    /** Callback when intent is parsed — should execute via CommandRegistry */
    onIntent?: (intent: ParsedIntent) => { success: boolean; message: string };
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

    const clearMessages = useCallback(() => {
        // Auto-clear messages after delay
        setTimeout(() => {
            setError(null);
            setResultMessage(null);
        }, 5000);
    }, []);

    const processTranscript = useCallback(
        (text: string) => {
            setState('processing');
            const intent = parseIntent(text);
            setLastIntent(intent);

            if (intent.type === 'UNKNOWN') {
                setError(`I didn't understand: "${text}"`);
                setState('idle');
                clearMessages();
                return;
            }

            // Check if high-risk action needs confirmation
            if (HIGH_RISK_ACTIONS.has(intent.type)) {
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
            executeIntent(intent);
        },
        [onIntent]
    );

    const executeIntent = useCallback(
        (intent: ParsedIntent) => {
            if (onIntent) {
                const result = onIntent(intent);
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

    const startListening = useCallback(() => {
        if (!enabled) return;
        setError(null);
        setResultMessage(null);
        setTranscript('');

        if (isWebSpeechAvailable()) {
            // Use Web Speech API
            const SpeechRecognition =
                (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            recognition.onstart = () => {
                setState('listening');
            };

            recognition.onresult = (event: any) => {
                let interimTranscript = '';
                let isFinal = false;

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const result = event.results[i];
                    if (result.isFinal) {
                        isFinal = true;
                        // For the final result, we'll process it and stop listening
                        const text = result[0].transcript;
                        setTranscript(text);
                        setTimeout(() => {
                            stopListening();
                            processTranscript(text);
                        }, 50);
                    } else {
                        interimTranscript += result[0].transcript;
                    }
                }

                if (!isFinal) {
                    setTranscript(interimTranscript);
                }
            };

            recognition.onerror = (event: any) => {
                setError(`Voice error: ${event.error}`);
                setState('idle');
                clearMessages();
            };

            recognition.onend = () => {
                if (state === 'listening') {
                    setState('idle');
                }
            };

            recognitionRef.current = recognition;
            recognition.start();
        } else {
            // Fallback: would record audio and send to server STT endpoint
            setError('Web Speech API not available. Server STT fallback not yet configured.');
            clearMessages();
        }
    }, [enabled, processTranscript, state, clearMessages]);

    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            recognitionRef.current = null;
        }
        if (state === 'listening') {
            setState('idle');
        }
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

/** Simple TTS helper */
function speak(text: string): void {
    if (typeof window === 'undefined') return;
    const config = getVoiceConfig();
    if (!config.ttsEnabled) return;
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.1;
        utterance.pitch = 1;
        window.speechSynthesis.speak(utterance);
    }
}
