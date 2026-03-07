import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// PATCH /api/records/[id] — aggiorna un record esistente
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const { targa, tipo_veicolo, numero_veicolo, lavorazione_eseguita, note } = body;

        const sql = getDb();
        const result = await sql`
      UPDATE records
      SET
        targa = ${targa ?? null},
        tipo_veicolo = ${tipo_veicolo ?? null},
        numero_veicolo = ${numero_veicolo ?? null},
        lavorazione_eseguita = ${lavorazione_eseguita ?? null},
        note = ${note ?? null}
      WHERE id = ${parseInt(id)}
      RETURNING id
    `;

        if (result.length === 0) {
            return NextResponse.json({ error: 'Record non trovato' }, { status: 404 });
        }
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Errore aggiornamento record:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE /api/records/[id] — elimina un record
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const sql = getDb();
        await sql`DELETE FROM records WHERE id = ${parseInt(id)}`;
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Errore eliminazione record:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
