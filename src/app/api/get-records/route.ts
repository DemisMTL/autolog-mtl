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
    const commessaFilter = searchParams.get('commessa');

    let rows;
    if (commessaFilter) {
      rows = await sql`
        SELECT id, timestamp::text, targa, tipo_veicolo, numero_veicolo,
               lavorazione_eseguita, note, lat, lng,
               telaio, seriale_centralina, marca_veicolo, cliente, anno_immatricolazione, marca_modello_tachigrafo, fornitore_servizio, tecnico, is_matched, matched_ticket
        FROM records
        WHERE matched_ticket = ${commessaFilter}
        ORDER BY timestamp DESC
      `;
    } else if (startDateFilter && endDateFilter) {
      rows = await sql`
        SELECT id, timestamp::text, targa, tipo_veicolo, numero_veicolo,
               lavorazione_eseguita, note, lat, lng,
               telaio, seriale_centralina, marca_veicolo, cliente, anno_immatricolazione, marca_modello_tachigrafo, fornitore_servizio, tecnico, is_matched, matched_ticket
        FROM records
        WHERE DATE(timestamp AT TIME ZONE 'Europe/Rome') >= ${startDateFilter}
          AND DATE(timestamp AT TIME ZONE 'Europe/Rome') <= ${endDateFilter}
        ORDER BY timestamp ASC
      `;
    } else if (dateFilter) {
      rows = await sql`
        SELECT id, timestamp::text, targa, tipo_veicolo, numero_veicolo,
               lavorazione_eseguita, note, lat, lng,
               telaio, seriale_centralina, marca_veicolo, cliente, anno_immatricolazione, marca_modello_tachigrafo, fornitore_servizio, tecnico, is_matched, matched_ticket
        FROM records
        WHERE DATE(timestamp AT TIME ZONE 'Europe/Rome') = ${dateFilter}
        ORDER BY timestamp ASC
      `;
    } else {
      rows = await sql`
        SELECT id, timestamp::text, targa, tipo_veicolo, numero_veicolo,
               lavorazione_eseguita, note, lat, lng,
               telaio, seriale_centralina, marca_veicolo, cliente, anno_immatricolazione, marca_modello_tachigrafo, fornitore_servizio, tecnico, is_matched, matched_ticket
        FROM records
        ORDER BY timestamp DESC
        LIMIT 100
      `;
    }

    const SYNC_API_KEY = process.env.SYNC_API_KEY || '';
    const TICKET_APP_URL = process.env.TICKET_APP_URL || process.env.NEXT_PUBLIC_TICKET_APP_URL || 'https://app-ticket-sigma.vercel.app';
    const crypto = require('crypto');

    const records = rows.map((r: any) => {
      const commessa = (r.matched_ticket && r.matched_ticket !== 'null' && r.matched_ticket !== 'undefined') ? r.matched_ticket : null;
      let signedUrl = null;

      if (commessa && SYNC_API_KEY) {
        const timestamp = Date.now().toString();
        const signature = crypto
          .createHmac('sha256', SYNC_API_KEY)
          .update(`${commessa}:${timestamp}`)
          .digest('hex');
          
        signedUrl = `${TICKET_APP_URL}/view?commessa=${commessa}&embed=true&ts=${timestamp}&sig=${signature}`;
      }

      return {
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
        is_matched: r.is_matched === true || r.is_matched === 1 || r.is_matched === 'true' || r.is_matched === 't',
        matched_ticket: commessa,
        signed_ticket_url: signedUrl
      };
    });

    return NextResponse.json({ records });
  } catch (error: any) {
    console.error('Errore lettura record:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
