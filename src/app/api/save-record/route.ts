import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureTable } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      targa, tipo_veicolo, numero_veicolo,
      lavorazione_eseguita, note, lat, lng, timestamp, // Changed: location removed, lat and lng added
      telaio, seriale_centralina, marca_veicolo, cliente, anno_immatricolazione, marca_modello_tachigrafo, fornitore_servizio // Changed: fornitore_servizio added
    } = body;

    await ensureTable();
    const sql = getDb();

    await sql`
      INSERT INTO records (
        timestamp, targa, tipo_veicolo, numero_veicolo,
        lavorazione_eseguita, note, lat, lng,
        telaio, seriale_centralina, marca_veicolo, cliente,
        anno_immatricolazione, marca_modello_tachigrafo, fornitore_servizio
      )
      VALUES (
        ${timestamp || new Date().toISOString()},
        ${targa || null},
        ${tipo_veicolo || null},
        ${numero_veicolo || null},
        ${lavorazione_eseguita || null},
        ${note || null},
        ${lat ?? null},
        ${lng ?? null},
        ${telaio || null},
        ${seriale_centralina || null},
        ${marca_veicolo || null},
        ${cliente || null},
        ${anno_immatricolazione || null},
        ${marca_modello_tachigrafo || null},
        ${fornitore_servizio ?? null}
      ) RETURNING id
    `;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Errore salvataggio record:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
