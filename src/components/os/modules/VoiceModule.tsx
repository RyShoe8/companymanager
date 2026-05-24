'use client';

import { useVoice } from '@/components/voice/VoiceProvider';

export default function VoiceModule() {
    const voice = useVoice();

    if (!voice.enabled) {
        return (
            <div className="p-6 text-sm text-zinc-500">
                Voice is disabled. Enable it from the feature flags configuration.
            </div>
        );
    }

    return (
        <div className="p-6 space-y-4">
            <div>
                <div className="text-xs uppercase tracking-wide text-zinc-500">State</div>
                <div className="text-sm text-zinc-100 mt-1">{voice.state}</div>
            </div>

            <div>
                <div className="text-xs uppercase tracking-wide text-zinc-500">Transcript</div>
                <div className="mt-1 min-h-[40px] text-sm text-zinc-100 bg-zinc-900 border border-zinc-800 rounded p-2 whitespace-pre-wrap">
                    {voice.transcript || <span className="text-zinc-600">(none)</span>}
                </div>
            </div>

            <div className="flex items-center gap-2">
                {voice.state === 'listening' ? (
                    <button
                        type="button"
                        onClick={voice.stopListening}
                        className="px-3 h-9 rounded bg-red-600 hover:bg-red-500 text-sm text-white"
                    >
                        Stop listening
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={voice.startListening}
                        className="px-3 h-9 rounded bg-zinc-100 hover:bg-white text-sm text-zinc-900"
                    >
                        Start listening
                    </button>
                )}
            </div>

            {voice.error && (
                <div className="text-xs text-red-400">{voice.error}</div>
            )}
            {voice.resultMessage && (
                <div className="text-xs text-emerald-400">{voice.resultMessage}</div>
            )}
        </div>
    );
}
