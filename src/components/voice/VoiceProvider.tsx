'use client';

import { createContext, useContext, useState, useCallback, useRef, ReactNode, useEffect } from 'react';
import { parseIntent, ParsedIntent } from '@/lib/voice/IntentParser';
import { isWebSpeechAvailable, getVoiceConfig } from '@/lib/voice/voiceConfig';
import { detectWakeWord } from '@/lib/voice/wakeWordMatcher';
import {
    getSpeechRecognitionConstructor,
    type SpeechRecognitionInstance,
    type SpeechRecognitionEvent,
    type SpeechRecognitionErrorEvent,
} from '@/lib/voice/speechRecognitionTypes';
import { fetchLlmVoiceIntent } from '@/lib/voice/fetchVoiceIntent';
import { enrichIntentWithContext } from '@/lib/voice/enrichIntentWithContext';
import { useIntentConfirmation } from '@/components/intent/IntentConfirmationContext';
import type { WorkspaceIntentContextPayload } from '@/lib/voice/workspaceIntentContext';
import { speakClientTts } from '@/lib/voice/clientTts';
import { isFeatureEnabled } from '@/lib/utils/featureFlags';

export type VoiceState = 'idle' | 'listening' | 'processing' | 'confirming';

export interface VoiceContextValue {
    state: VoiceState;
    transcript: string;
    lastIntent: ParsedIntent | null;
    error: string | null;
    resultMessage: string | null;
    startListening: () => void;
    stopListening: () => void;
    confirmAction: () => Promise<void>;
    cancelAction: () => void;
    /** After intent modal closed cancel (intent layer already cleared). */
    resetAfterExternalIntentCancel: () => void;
    wakeWordEnabled: boolean;
    isWakeArmed: boolean;
    wakeDetections: number;
    wakeActivations: number;
    wakeUserCancels: number;
    wakeLastAlias: string | null;
    wakeLastScore: number;
    toggleWakeWord: () => void;
    enabled: boolean;
    pendingActionDescription: string | null;
}

const VoiceContext = createContext<VoiceContextValue | null>(null);

export function useVoice(): VoiceContextValue {
    const ctx = useContext(VoiceContext);
    if (!ctx) {
        return {
            state: 'idle',
            transcript: '',
            lastIntent: null,
            error: null,
            resultMessage: null,
            startListening: () => {},
            stopListening: () => {},
            confirmAction: async () => {},
            cancelAction: () => {},
            resetAfterExternalIntentCancel: () => {},
            wakeWordEnabled: false,
            isWakeArmed: false,
            wakeDetections: 0,
            wakeActivations: 0,
            wakeUserCancels: 0,
            wakeLastAlias: null,
            wakeLastScore: 0,
            toggleWakeWord: () => {},
            enabled: false,
            pendingActionDescription: null,
        };
    }
    return ctx;
}

interface VoiceProviderProps {
    children: ReactNode;
    getWorkspaceContext?: () => WorkspaceIntentContextPayload | null;
    /** Voice is enabled only when the feature flag is on and the user is a platform admin. */
    isPlatformAdmin?: boolean;
}

export default function VoiceProvider({ children, getWorkspaceContext, isPlatformAdmin = false }: VoiceProviderProps) {
    const intentCtx = useIntentConfirmation();
    const enabled = isFeatureEnabled('voiceEnabled') && isPlatformAdmin;
    const [state, setState] = useState<VoiceState>('idle');
    const [transcript, setTranscript] = useState('');
    const [lastIntent, setLastIntent] = useState<ParsedIntent | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [resultMessage, setResultMessage] = useState<string | null>(null);
    const [pendingActionDescription, setPendingActionDescription] = useState<string | null>(null);
    const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
    const wakeRecognitionRef = useRef<SpeechRecognitionInstance | null>(null);
    const wakeCooldownUntilRef = useRef<number>(0);
    const accumulatedTranscriptRef = useRef<string>('');
    const endOfUtteranceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastFinalSegmentRef = useRef<string>('');
    const lastInterimRef = useRef<string>('');
    const stateRef = useRef<VoiceState>(state);
    const startListeningRef = useRef<() => void>(() => {});
    const [wakeWordEnabled, setWakeWordEnabled] = useState(false);
    const [isWakeArmed, setIsWakeArmed] = useState(false);
    const [wakeDetections, setWakeDetections] = useState(0);
    const [wakeActivations, setWakeActivations] = useState(0);
    const [wakeUserCancels, setWakeUserCancels] = useState(0);
    const [wakeLastAlias, setWakeLastAlias] = useState<string | null>(null);
    const [wakeLastScore, setWakeLastScore] = useState(0);

    const clearMessages = useCallback(() => {
        setTimeout(() => {
            setError(null);
            setResultMessage(null);
        }, 5000);
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const raw = window.localStorage.getItem('voiceWakeWordEnabled');
        setWakeWordEnabled(raw === '1');
    }, []);

    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    const toggleWakeWord = useCallback(() => {
        setWakeWordEnabled((prev) => {
            const next = !prev;
            if (typeof window !== 'undefined') {
                window.localStorage.setItem('voiceWakeWordEnabled', next ? '1' : '0');
            }
            return next;
        });
    }, []);

    const resetVoiceChrome = useCallback(() => {
        setState('idle');
        setPendingActionDescription(null);
    }, []);

    const summarizeIntent = useCallback((intent: ParsedIntent) => {
        const label = intent.type.replace(/_/g, ' ');
        const hint =
            intent.slots.name ||
            intent.slots.taskName ||
            intent.slots.title ||
            intent.slots.commandId ||
            intent.slots.place ||
            '';
        return hint ? `${label}: ${hint}` : label;
    }, []);

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
        async (text: string) => {
            setState('processing');

            const wsCtx = getWorkspaceContext?.() ?? null;
            const llmResult = await fetchLlmVoiceIntent(text, wsCtx);

            let intent: ParsedIntent | null = null;
            let source: 'llm' | 'rules' = 'rules';
            let rulesFallbackReason: string | null = null;

            if (llmResult.ok && llmResult.intent) {
                intent = llmResult.intent;
                source = 'llm';
            } else {
                if (!llmResult.ok) {
                    rulesFallbackReason =
                        llmResult.status === 503
                            ? 'openai_not_configured'
                            : llmResult.status === 401
                              ? 'unauthorized'
                              : `request_failed_${llmResult.status}`;
                } else {
                    rulesFallbackReason = 'llm_json_unmapped';
                }

                const parsedRules = parseIntent(text);
                intent = enrichIntentWithContext(parsedRules, wsCtx ?? undefined) ?? parsedRules;
                source = 'rules';
            }

            setLastIntent(intent);

            if (intent.type === 'UNKNOWN') {
                console.warn('[Voice] Intent not recognized', { transcript: text, source, rulesFallbackReason });
                let hint = '';
                if (rulesFallbackReason === 'openai_not_configured') {
                    hint =
                        ' AI parsing is not configured on the server (set OPENAI_API_KEY on Vercel). Try phrasing like: add task review docs to project Acme.';
                } else if (rulesFallbackReason === 'llm_json_unmapped') {
                    hint = ' Try phrasing like: add task review docs to project Acme.';
                }
                setError(`I didn't understand: "${text}".${hint}`);
                setState('idle');
                clearMessages();
                return;
            }

            intentCtx.presentConfirmation({
                sourceText: text,
                intent,
                parseSource: source,
                origin: 'voice',
                contextSnapshot: wsCtx,
            });
            setPendingActionDescription(summarizeIntent(intent));
            setState('confirming');
            speakClientTts('Please confirm the action in the dialog.');
        },
        [getWorkspaceContext, intentCtx, summarizeIntent, clearMessages]
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
            void processTranscript(dedupeTrailingTranscript(text));
        } else {
            setState('idle');
        }
    }, [processTranscript, dedupeTrailingTranscript]);

    const startListening = useCallback(() => {
        if (!enabled) return;
        if (wakeRecognitionRef.current) {
            try {
                wakeRecognitionRef.current.onend = null;
                wakeRecognitionRef.current.stop();
            } catch (_) {}
            wakeRecognitionRef.current = null;
            setIsWakeArmed(false);
        }
        setError(null);
        setResultMessage(null);
        intentCtx.cancel();
        resetVoiceChrome();
        setTranscript('');
        accumulatedTranscriptRef.current = '';
        lastFinalSegmentRef.current = '';
        lastInterimRef.current = '';
        if (endOfUtteranceTimerRef.current) {
            clearTimeout(endOfUtteranceTimerRef.current);
            endOfUtteranceTimerRef.current = null;
        }

        if (isWebSpeechAvailable()) {
            const SpeechRecognition = getSpeechRecognitionConstructor();
            if (!SpeechRecognition) {
                setError('Web Speech API not available. Server STT fallback not yet configured.');
                clearMessages();
                return;
            }
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';
            const endOfUtteranceMs = getVoiceConfig().endOfUtteranceMs ?? 1400;

            recognition.onstart = () => {
                setState('listening');
            };

            recognition.onresult = (event: SpeechRecognitionEvent) => {
                let interimTranscript = '';
                let hadNewContent = false;

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const result = event.results[i];
                    const text = result[0].transcript;
                    if (result.isFinal) {
                        const trimmed = text.trim();
                        if (trimmed && trimmed === lastFinalSegmentRef.current) {
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

            recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
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
                } else if (stateRef.current === 'listening') {
                    setState('idle');
                }
            };

            recognitionRef.current = recognition;
            recognition.start();
        } else {
            setError('Web Speech API not available. Server STT fallback not yet configured.');
            clearMessages();
        }
    }, [enabled, flushAndProcess, clearMessages, intentCtx, resetVoiceChrome]);

    useEffect(() => {
        startListeningRef.current = startListening;
    }, [startListening]);

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
        if (stateRef.current === 'listening') {
            setState('idle');
        }
        setTranscript('');
    }, []);

    useEffect(() => {
        if (!enabled || !wakeWordEnabled || state !== 'idle' || !isWebSpeechAvailable()) {
            if (wakeRecognitionRef.current) {
                try {
                    wakeRecognitionRef.current.onend = null;
                    wakeRecognitionRef.current.stop();
                } catch (_) {}
                wakeRecognitionRef.current = null;
            }
            setIsWakeArmed(false);
            return;
        }

        const SpeechRecognition = getSpeechRecognitionConstructor();
        if (!SpeechRecognition) return;

        const wake = new SpeechRecognition();
        wake.continuous = true;
        wake.interimResults = true;
        wake.lang = 'en-US';

        const wakeWord = (getVoiceConfig().wakeWord || 'nucleas').toLowerCase();
        const cooldownMs = getVoiceConfig().wakeWordCooldownMs ?? 7000;
        const aliases = getVoiceConfig().wakeWordAliases ?? [wakeWord];
        const minScore = getVoiceConfig().wakeMinMatchScore ?? 0.72;

        wake.onstart = () => {
            setIsWakeArmed(true);
        };

        wake.onresult = (event: SpeechRecognitionEvent) => {
            let combined = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                combined += ` ${event.results[i][0].transcript || ''}`;
            }
            const match = detectWakeWord(combined, aliases, minScore);
            if (!match.matched) {
                return;
            }
            const now = Date.now();
            if (now < wakeCooldownUntilRef.current) return;
            wakeCooldownUntilRef.current = now + cooldownMs;
            setWakeDetections((v) => v + 1);
            setWakeLastAlias(match.matchedAlias);
            setWakeLastScore(match.score);
            try {
                wake.onend = null;
                wake.stop();
            } catch (_) {}
            wakeRecognitionRef.current = null;
            setIsWakeArmed(false);
            setWakeActivations((v) => v + 1);
            startListeningRef.current();
        };

        wake.onerror = (event: SpeechRecognitionErrorEvent) => {
            console.warn('[Voice] Wake-word detector error', event?.error);
        };

        wake.onend = () => {
            setIsWakeArmed(false);
            wakeRecognitionRef.current = null;
        };

        wakeRecognitionRef.current = wake;
        wake.start();

        return () => {
            if (wakeRecognitionRef.current) {
                try {
                    wakeRecognitionRef.current.onend = null;
                    wakeRecognitionRef.current.stop();
                } catch (_) {}
                wakeRecognitionRef.current = null;
            }
            setIsWakeArmed(false);
        };
    }, [enabled, wakeWordEnabled, state]);

    const confirmAction = useCallback(async () => {
        const r = await intentCtx.confirm();
        resetVoiceChrome();
        if (r) {
            if (r.success) {
                setResultMessage(r.message);
                speakClientTts(r.message);
            } else {
                console.warn('[Voice] Intent execution failed', r.message);
                setError(r.message);
            }
            clearMessages();
        }
    }, [intentCtx, resetVoiceChrome, clearMessages]);

    const cancelAction = useCallback(() => {
        if (wakeWordEnabled && state === 'confirming') {
            setWakeUserCancels((v) => v + 1);
        }
        intentCtx.cancel();
        resetVoiceChrome();
        setResultMessage('Action cancelled.');
        clearMessages();
    }, [intentCtx, resetVoiceChrome, clearMessages, wakeWordEnabled, state]);

    const resetAfterExternalIntentCancel = useCallback(() => {
        resetVoiceChrome();
    }, [resetVoiceChrome]);

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
        resetAfterExternalIntentCancel,
        wakeWordEnabled,
        isWakeArmed,
        wakeDetections,
        wakeActivations,
        wakeUserCancels,
        wakeLastAlias,
        wakeLastScore,
        toggleWakeWord,
        enabled,
        pendingActionDescription,
    };

    return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
}
