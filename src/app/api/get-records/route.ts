import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureTable } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    await ensureTable();
    const sql = getDb();

    const { searchParams } = new URL(req.url);
    const dateFilter = searchParams.get('date');
    const startDateFilter = searchParams.get('startDate');
    const endDateFilter = searchParams.get('endDate');

    let rows;
    if (startDateFilter && endDateFilter) {
      rows = await sql`
        SELECT id, timestamp::text, targa, tipo_veicolo, numero_veicolo,
               lavorazione_eseguita, note, lat, lng,
               telaio, seriale_centralina, marca_veicolo, cliente, anno_immatricolazione, marca_modello_tachigrafo, fornitore_servizio, tecnico, is_matched
        FROM records
        WHERE DATE(timestamp AT TIME ZONE 'Europe/Rome') >= ${startDateFilter}
          AND DATE(timestamp AT TIME ZONE 'Europe/Rome') <= ${endDateFilter}
        ORDER BY timestamp ASC
      `;
    } else if (dateFilter) {
      rows = await sql`
        SELECT id, timestamp::text, targa, tipo_veicolo, numero_veicolo,
               lavorazione_eseguita, note, lat, lng,
               telaio, seriale_centralina, marca_veicolo, cliente, anno_immatricolazione, marca_modello_tachigrafo, fornitore_servizio, tecnico, is_matched
        FROM records
        WHERE DATE(timestamp AT TIME ZONE 'Europe/Rome') = ${dateFilter}
        ORDER BY timestamp ASC
      `;
    } else {
      rows = await sql`
        SELECT id, timestamp::text, targa, tipo_veicolo, numero_veicolo,
               lavorazione_eseguita, note, lat, lng,
               telaio, seriale_centralina, marca_veicolo, cliente, anno_immatricolazione, marca_modello_tachigrafo, fornitore_servizio, tecnico, is_matched
        FROM records
        ORDER BY timestamp DESC
        LIMIT 100
      `;
    }

    const records = rows.map((r: any) => ({
      id: r.id,
      timestamp: r.timestamp,
      targa: r.targa,
      tipo_veicolo: r.tipo_veicolo,
      numero_veicolo: r.numero_veicolo,
      cliente: r.cliente,
      lavorazione_eseguita: r.lavorazione_eseguita,
      note: r.note || '',
      lat: r.lat ? parseFloat(r.lat) : null,
      lng: r.lng ? parseFloat(r.lng) : null,
      telaio: r.telaio,
      seriale_centralina: r.seriale_centralina,
      marca_veicolo: r.marca_veicolo,
      anno_immatricolazione: r.anno_immatricolazione,
      marca_modello_tachigrafo: r.marca_modello_tachigrafo,
      fornitore_servizio: r.fornitore_servizio,
      tecnico: r.tecnico,
      is_matched: !!r.is_matched
    }));

    return NextResponse.json({ records });
  } catch (error: any) {
    console.error('Errore lettura record:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
