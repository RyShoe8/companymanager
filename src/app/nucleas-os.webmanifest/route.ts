import { NextRequest, NextResponse } from 'next/server';
import { buildNucleasOsManifest } from '@/lib/os/nucleasOsManifest';

function resolveOrigin(request: NextRequest): string {
    const fromRequest = request.nextUrl.origin;
    if (fromRequest && fromRequest !== 'null') return fromRequest;

    const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (envUrl) {
        try {
            return new URL(envUrl).origin;
        } catch {
            // ignore invalid env URL
        }
    }
    return 'https://os.nucleas.app';
}

export function GET(request: NextRequest) {
    const manifest = buildNucleasOsManifest(resolveOrigin(request));
    return NextResponse.json(manifest, {
        headers: {
            'Content-Type': 'application/manifest+json',
            'Cache-Control': 'public, max-age=0, must-revalidate',
        },
    });
}
