import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';

const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // 25MB (Whisper API limit)

export async function POST(req: NextRequest) {
    try {
        const session = await requireAuth(req);
        if (session instanceof NextResponse) return session;

        const formData = await req.formData();
        const file = formData.get('file');

        if (!file || !(file instanceof File)) {
            return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
        }
        if (file.size > MAX_AUDIO_BYTES) {
            return NextResponse.json({ error: 'Audio file too large' }, { status: 413 });
        }

        // TODO: wire this audio Blob to a real STT service (e.g. OpenAI Whisper, AWS Transcribe).
        // Simulated fallback response
        return NextResponse.json({ text: "Simulated server-side transcription for Option B fallback." });
    } catch (error) {
        console.error('STT API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
