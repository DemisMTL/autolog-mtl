import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// POST /api/records/collaudo
// Called by App-Ticket email-service when a collaudo PDF is processed.
// Matches the record by seriale_centralina or targa and stores the PDF URL.
export async function POST(req: NextRequest) {
    // Auth via API key
    const apiKey = req.headers.get('x-api-key');
    const expectedKey = process.env.SYNC_API_KEY;
    if (expectedKey && apiKey !== expectedKey) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { seriale, collaudo_url, email_subject } = body;

        if (!seriale || !collaudo_url) {
            return NextResponse.json({ error: 'seriale and collaudo_url are required' }, { status: 400 });
        }

        const sql = getDb();

        // Search record by seriale_centralina (primary) or targa (fallback)
        const serialeUpper = seriale.toUpperCase().trim();

        const rows = await sql`
            SELECT id, targa, seriale_centralina, cliente
            FROM records
            WHERE 
                UPPER(seriale_centralina) = ${serialeUpper}
                OR UPPER(targa) = ${serialeUpper}
            ORDER BY timestamp DESC
            LIMIT 5
        `;

        if (rows.length === 0) {
            console.warn(`[COLLAUDO-API] No record found for serial/plate: ${serialeUpper}`);
            return NextResponse.json({ 
                success: false, 
                message: `Nessun record trovato per: ${serialeUpper}` 
            }, { status: 404 });
        }

        // Update the most recent matching record
        const matched = rows[0];
        await sql`
            UPDATE records
            SET collaudo_url = ${collaudo_url}
            WHERE id = ${matched.id}
        `;

        console.log(`[COLLAUDO-API] Updated record #${matched.id} (${matched.targa || matched.seriale_centralina}) with collaudo_url`);

        return NextResponse.json({ 
            success: true,
            matched_record_id: matched.id,
            targa: matched.targa,
            seriale_centralina: matched.seriale_centralina,
            cliente: matched.cliente
        });

    } catch (error: any) {
        console.error('[COLLAUDO-API] Error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
