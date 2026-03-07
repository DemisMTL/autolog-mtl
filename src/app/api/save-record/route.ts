import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureTable } from '@/lib/db';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            targa, tipo_veicolo, numero_veicolo,
            lavorazione_eseguita, note, location, timestamp,
            telaio, seriale_centralina, marca_veicolo
        } = body;

        await ensureTable();
        const sql = getDb();

        await sql`
      INSERT INTO records (
        timestamp, targa, tipo_veicolo, numero_veicolo,
        lavorazione_eseguita, note, lat, lng,
        telaio, seriale_centralina, marca_veicolo
      )
      VALUES (
        ${timestamp || new Date().toISOString()},
        ${targa || null},
        ${tipo_veicolo || null},
        ${numero_veicolo || null},
        ${lavorazione_eseguita || null},
        ${note || null},
        ${location?.lat ?? null},
        ${location?.lng ?? null},
        ${telaio || null},
        ${seriale_centralina || null},
        ${marca_veicolo || null}
      )
    `;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Errore salvataggio record:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
