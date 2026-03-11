'use client';

import { useVoice } from '@/components/voice/VoiceProvider';

export function VoiceButton() {
    const voice = useVoice();
    if (!voice.enabled) return null;

    return (
        <button
            onClick={voice.state === 'listening' ? voice.stopListening : voice.startListening}
            className={`fixed bottom-6 right-6 z-[90] p-4 rounded-full shadow-2xl transition-all duration-300 scale-110 flex items-center justify-center ${voice.state === 'listening'
                ? 'bg-red-500 text-white animate-pulse ring-4 ring-red-500/20'
                : voice.state === 'processing'
                    ? 'bg-yellow-500 text-white'
                    : 'bg-indigo-600 text-white hover:bg-indigo-500 hover:scale-125'
                }`}
            aria-label={voice.state === 'listening' ? 'Stop listening' : 'Start voice command'}
            title="Voice command (hold V)"
        >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 15a3 3 0 003-3V5a3 3 0 00-6 0v7a3 3 0 003 3z"
                />
            </svg>
            {voice.state === 'listening' && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-400 rounded-full animate-ping" />
            )}
        </button>
    );
}

export default function VoiceOverlay() {
    const voice = useVoice();

    if (!voice.enabled) return null;

    return (
        <>
            <VoiceButton />
            {/* Transcript / feedback toast — appears when active */}
            {(voice.state !== 'idle' || voice.error || voice.resultMessage) && (
                <div
                    className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md"
                    role="status"
                    aria-live="polite"
                >
                    <div className="bg-gray-900/95 border border-gray-700 rounded-xl shadow-2xl px-5 py-4 backdrop-blur-sm">
                        {/* Listening state */}
                        {voice.state === 'listening' && (
                            <div className="flex items-center gap-3">
                                <div className="flex gap-1 items-end h-5">
                                    {[1, 2, 3, 4, 5].map((i) => (
                                        <div
                                            key={i}
                                            className="w-1 bg-red-400 rounded-full animate-pulse"
                                            style={{
                                                height: `${8 + Math.random() * 12}px`,
                                                animationDelay: `${i * 100}ms`,
                                            }}
                                        />
                                    ))}
                                </div>
                                <div className="flex-1">
                                    <p className="text-white text-sm font-medium">Listening...</p>
                                    {voice.transcript && (
                                        <p className="text-gray-400 text-sm mt-1 italic">&ldquo;{voice.transcript}&rdquo;</p>
                                    )}
                                </div>
                                <button
                                    onClick={voice.stopListening}
                                    className="text-gray-500 hover:text-white text-xs"
                                >
                                    Cancel
                                </button>
                            </div>
                        )}

                        {/* Processing */}
                        {voice.state === 'processing' && (
                            <div className="flex items-center gap-3">
                                <div className="w-5 h-5 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin" />
                                <p className="text-yellow-400 text-sm">Processing: &ldquo;{voice.transcript}&rdquo;</p>
                            </div>
                        )}

                        {/* Confirming */}
                        {voice.state === 'confirming' && voice.pendingActionDescription && (
                            <div>
                                <p className="text-orange-400 text-sm font-medium mb-2">
                                    ⚠️ Confirm: {voice.pendingActionDescription}
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={voice.confirmAction}
                                        className="px-3 py-1.5 bg-red-500 text-white text-sm rounded-md hover:bg-red-600"
                                    >
                                        Confirm
                                    </button>
                                    <button
                                        onClick={voice.cancelAction}
                                        className="px-3 py-1.5 bg-gray-700 text-gray-300 text-sm rounded-md hover:bg-gray-600"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Error */}
                        {voice.state === 'idle' && voice.error && (
                            <div className="flex items-center gap-2">
                                <span className="text-red-400">❌</span>
                                <p className="text-red-400 text-sm">{voice.error}</p>
                            </div>
                        )}

                        {/* Success */}
                        {voice.state === 'idle' && voice.resultMessage && !voice.error && (
                            <div className="flex items-center gap-2">
                                <span className="text-green-400">✅</span>
                                <p className="text-green-400 text-sm">{voice.resultMessage}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
