import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureTable } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      targa, tipo_veicolo, numero_veicolo,
      lavorazione_eseguita, note, lat, lng, timestamp, // Changed: location removed, lat and lng added
      telaio, seriale_centralina, marca_veicolo, cliente, anno_immatricolazione, marca_modello_tachigrafo, fornitore_servizio, tecnico
    } = body;

    await ensureTable();
    const sql = getDb();

    const result = await sql`
      INSERT INTO records (
        timestamp, targa, tipo_veicolo, numero_veicolo,
        lavorazione_eseguita, note, lat, lng,
        telaio, seriale_centralina, marca_veicolo, cliente,
        anno_immatricolazione, marca_modello_tachigrafo, fornitore_servizio, tecnico
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
        ${fornitore_servizio ?? null},
        ${tecnico ?? null}
      ) RETURNING id
    `;

    // ─── Sync with App-Ticket (automatic closure) ───
    // Evita di sincronizzare se i dati sono troppo brevi o assenti (es. targa non letta bene)
    const validSeriale = seriale_centralina && seriale_centralina.length > 5;
    const validTarga = targa && targa.length > 4;

    if (validSeriale || validTarga) {
      try {
        const ticketAppUrl = process.env.TICKET_APP_URL || 'http://localhost:3001';
        // Privilegiamo il seriale se valido, altrimenti usiamo la targa
        const syncPayload = validSeriale ? seriale_centralina : targa;
        
        console.log(`[BACKEND-SYNC] Notifying App-Ticket at ${ticketAppUrl}/api/tickets/sync for: ${syncPayload}`);
        
        const syncRes = await fetch(`${ticketAppUrl}/api/tickets/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ serialNumber: syncPayload })
        });
        
        if (!syncRes.ok) {
          const errData = await syncRes.json();
          console.error('[BACKEND-SYNC] Sync failed:', errData);
        } else {
          const syncData = await syncRes.json();
          console.log('[BACKEND-SYNC] Sync success:', syncData);
        }
      } catch (syncErr: any) {
        console.error('[BACKEND-SYNC] Error calling App-Ticket sync API:', syncErr.message);
      }
    }

    return NextResponse.json({ success: true, id: result[0]?.id });
  } catch (error: any) {
    console.error('Errore salvataggio record:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
