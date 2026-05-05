'use client';

import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import { parseIntent, ParsedIntent } from '@/lib/voice/IntentParser';
import { isWebSpeechAvailable, getVoiceConfig } from '@/lib/voice/voiceConfig';
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
            enabled: false,
            pendingActionDescription: null,
        };
    }
    return ctx;
}

interface VoiceProviderProps {
    children: ReactNode;
    getWorkspaceContext?: () => WorkspaceIntentContextPayload | null;
}

export default function VoiceProvider({ children, getWorkspaceContext }: VoiceProviderProps) {
    const intentCtx = useIntentConfirmation();
    const enabled = isFeatureEnabled('voiceEnabled');
    const [state, setState] = useState<VoiceState>('idle');
    const [transcript, setTranscript] = useState('');
    const [lastIntent, setLastIntent] = useState<ParsedIntent | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [resultMessage, setResultMessage] = useState<string | null>(null);
    const [pendingActionDescription, setPendingActionDescription] = useState<string | null>(null);
    const recognitionRef = useRef<any>(null);
    const accumulatedTranscriptRef = useRef<string>('');
    const endOfUtteranceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastFinalSegmentRef = useRef<string>('');
    const lastInterimRef = useRef<string>('');

    const clearMessages = useCallback(() => {
        setTimeout(() => {
            setError(null);
            setResultMessage(null);
        }, 5000);
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
            console.log('[Voice] Processing finalized transcript:', text);
            setState('processing');

            const wsCtx = getWorkspaceContext?.() ?? null;
            const llmResult = await fetchLlmVoiceIntent(text, wsCtx);

            let intent: ParsedIntent | null = null;
            let source: 'llm' | 'rules' = 'rules';
            let rulesFallbackReason: string | null = null;

            if (llmResult.ok && llmResult.intent) {
                intent = llmResult.intent;
                source = 'llm';
                console.log('[Voice] Parsed via LLM', { type: intent.type, slots: intent.slots });
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

                console.log('[Voice] Using rules fallback:', {
                    reason: rulesFallbackReason,
                    detail: !llmResult.ok ? llmResult.error : llmResult.llmRaw ?? null,
                    transcriptPreview: text.slice(0, 100),
                });

                const parsedRules = parseIntent(text);
                intent = enrichIntentWithContext(parsedRules, wsCtx ?? undefined) ?? parsedRules;
                source = 'rules';
                console.log('[Voice] Parsed via rules', { type: intent.type, slots: intent.slots });
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
    }, [enabled, flushAndProcess, state, clearMessages, intentCtx, resetVoiceChrome]);

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

    const confirmAction = useCallback(async () => {
        const r = await intentCtx.confirm();
        resetVoiceChrome();
        if (r) {
            if (r.success) {
                console.log('[Voice] Intent executed', r.message);
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
        intentCtx.cancel();
        resetVoiceChrome();
        console.log('[Voice] User cancelled confirmation');
        setResultMessage('Action cancelled.');
        clearMessages();
    }, [intentCtx, resetVoiceChrome, clearMessages]);

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
        enabled,
        pendingActionDescription,
    };

    return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
}
