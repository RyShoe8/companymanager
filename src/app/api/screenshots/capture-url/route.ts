import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';

export async function POST(req: NextRequest) {
    try {
        const session = await requireAuth(req);
        if (session instanceof NextResponse) {
            return session;
        }

        const { url } = await req.json();

        if (!url || typeof url !== 'string') {
            return new NextResponse('Missing or invalid URL', { status: 400 });
        }

        // Validate URL
        let targetUrl: URL;
        try {
            targetUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
        } catch (e) {
            return new NextResponse('Invalid URL format', { status: 400 });
        }

        // Call Microlink API to capture a full-page screenshot
        const microlinkApiUrl = `https://api.microlink.io/?url=${encodeURIComponent(
            targetUrl.toString()
        )}&screenshot=true&meta=false&fullPage=true`;

        const mlRes = await fetch(microlinkApiUrl);
        
        if (!mlRes.ok) {
            console.error('Microlink error status:', mlRes.status);
            return new NextResponse('Failed to capture screenshot from URL', { status: 500 });
        }

        const data = await mlRes.json();

        if (data.status !== 'success' || !data.data?.screenshot?.url) {
            console.error('Microlink returned unexpected data:', data);
            return new NextResponse('Failed to generate screenshot image', { status: 500 });
        }

        // Fetch the actual image
        const imageRes = await fetch(data.data.screenshot.url);
        
        if (!imageRes.ok) {
            console.error('Failed to download image from microlink url:', imageRes.status);
            return new NextResponse('Failed to retrieve captured image', { status: 500 });
        }

        const arrayBuffer = await imageRes.arrayBuffer();

        return new NextResponse(arrayBuffer, {
            status: 200,
            headers: {
                'Content-Type': imageRes.headers.get('content-type') || 'image/png',
            },
        });

    } catch (error) {
        console.error('Error capturing URL screenshot:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
