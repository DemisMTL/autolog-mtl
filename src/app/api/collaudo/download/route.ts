import { NextRequest, NextResponse } from 'next/server';

// GET /api/collaudo/download?url=<blob_url>
// Server-side proxy to get a signed download URL from App-Ticket.
// This avoids CORS issues since the call is made server→server.
export async function GET(req: NextRequest) {
    const blobUrl = req.nextUrl.searchParams.get('url');
    if (!blobUrl) {
        return NextResponse.json({ error: 'url parameter required' }, { status: 400 });
    }

    const ticketAppUrl = process.env.NEXT_PUBLIC_TICKET_APP_URL || 'https://app-ticket-sigma.vercel.app';
    const syncApiKey = process.env.SYNC_API_KEY || '';

    try {
        const res = await fetch(
            `${ticketAppUrl}/api/collaudo/download?url=${encodeURIComponent(blobUrl)}`,
            {
                headers: { 'x-api-key': syncApiKey },
                cache: 'no-store'
            }
        );

        if (res.ok) {
            // Now App-Ticket returns the binary PDF directly
            const pdfBuffer = await res.arrayBuffer();

            // Return the PDF directly to the browser
            return new NextResponse(pdfBuffer, {
                headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': 'inline; filename="certificato_collaudo.pdf"',
                    'Cache-Control': 'private, no-cache'
                }
            });
        }

        // If App-Ticket proxy fails, try opening the raw URL
        console.error('[COLLAUDO-PROXY] App-Ticket returned:', res.status);
        return NextResponse.redirect(blobUrl);
    } catch (err: any) {
        console.error('[COLLAUDO-PROXY] Error:', err.message);
        return NextResponse.redirect(blobUrl);
    }
}
