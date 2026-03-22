import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureTable } from '@/lib/db';
import { z } from 'zod';

const recordSchema = z.object({
  targa: z.string().optional().nullable(),
  tipo_veicolo: z.string().optional().nullable(),
  numero_veicolo: z.string().optional().nullable(),
  lavorazione_eseguita: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
  timestamp: z.string().optional().nullable(),
  telaio: z.string().optional().nullable(),
  seriale_centralina: z.string().optional().nullable(),
  marca_veicolo: z.string().optional().nullable(),
  cliente: z.string().optional().nullable(),
  anno_immatricolazione: z.string().optional().nullable(),
  marca_modello_tachigrafo: z.string().optional().nullable(),
  fornitore_servizio: z.string().optional().nullable(),
  tecnico: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const bodyRaw = await req.json();
    const result_zod = recordSchema.safeParse(bodyRaw);

    if (!result_zod.success) {
      return NextResponse.json({ error: 'Validation failed', details: result_zod.error.issues }, { status: 400 });
    }

    const {
      targa, tipo_veicolo, numero_veicolo,
      lavorazione_eseguita, note, lat, lng, timestamp,
      telaio, seriale_centralina, marca_veicolo, cliente, anno_immatricolazione, marca_modello_tachigrafo, fornitore_servizio, tecnico
    } = result_zod.data;

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

        // Normalizzazione nome cliente per matchmaking fuzzy
        // Rimuove spazi, punteggiatura e sigle societarie comuni
        const normalizeClient = (name: string) => {
          if (!name) return "";
          return name.toUpperCase()
            .replace(/\s+/g, '')
            .replace(/\./g, '')
            .replace(/, /g, '')
            .replace(/SPA$/g, '')
            .replace(/SRL$/g, '')
            .replace(/SAS$/g, '')
            .replace(/SNC$/g, '');
        };
        
        const normalizedClient = normalizeClient(cliente || "");
        
        console.log(`[BACKEND-SYNC] Notifying App-Ticket at ${ticketAppUrl}/api/tickets/sync for: ${syncPayload} (Client: ${normalizedClient})`);
        
        const syncRes = await fetch(`${ticketAppUrl}/api/tickets/sync`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-api-key': process.env.SYNC_API_KEY || ''
          },
          body: JSON.stringify({ 
            serialNumber: syncPayload,
            customerName: normalizedClient 
          })
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
