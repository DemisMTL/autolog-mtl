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
  tipo_lavorazione: z.string().optional().nullable(),
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
      telaio, seriale_centralina, marca_veicolo, cliente, anno_immatricolazione, marca_modello_tachigrafo, fornitore_servizio, tecnico, tipo_lavorazione
    } = result_zod.data;

    await ensureTable();
    const sql = getDb();

    const result = await sql`
      INSERT INTO records (
        timestamp, targa, tipo_veicolo, numero_veicolo,
        lavorazione_eseguita, note, lat, lng,
        telaio, seriale_centralina, marca_veicolo, cliente,
        anno_immatricolazione, marca_modello_tachigrafo, fornitore_servizio, tecnico, tipo_lavorazione
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
        ${tecnico ?? null},
        ${tipo_lavorazione || null}
      ) RETURNING id
    `;

    // ─── Sync with App-Ticket (automatic closure) ───
    // Evita di sincronizzare se i dati sono troppo brevi o assenti
    const validSeriale = seriale_centralina && seriale_centralina.length >= 4;
    const validTarga = targa && targa.length > 3;

    if (validSeriale || validTarga) {
      try {
        const ticketAppUrl = process.env.TICKET_APP_URL || process.env.NEXT_PUBLIC_TICKET_APP_URL || 'https://app-ticket-sigma.vercel.app';
        
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

        const trySyncWith = async (payload: string): Promise<any> => {
          console.log(`[BACKEND-SYNC] Trying sync with: ${payload} (Client: ${normalizedClient})`);
          const res = await fetch(`${ticketAppUrl}/api/tickets/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.SYNC_API_KEY || '' },
            body: JSON.stringify({ serialNumber: payload, customerName: normalizedClient, plate: targa })
          });
          return { res, data: res.ok ? await res.json() : null };
        };

        let syncRes, syncData;

        // Primo tentativo: con il seriale (se disponibile)
        if (validSeriale) {
          ({ res: syncRes, data: syncData } = await trySyncWith(seriale_centralina!));
        }

        // Se il sync col seriale non ha trovato match, ritenta con la targa
        const noMatchFromSerial = !syncData || (syncData.closed === 0 && syncData.found !== 1 && !syncData.error?.includes('Ambiguous') && !syncData.error?.includes('mismatch'));
        if (noMatchFromSerial && validTarga) {
          console.log(`[BACKEND-SYNC] Serial sync found no match, retrying with plate: ${targa}`);
          ({ res: syncRes, data: syncData } = await trySyncWith(targa!));
        }

        if (!syncRes?.ok) {
          console.error('[BACKEND-SYNC] Sync failed:', syncData);
        } else {
          console.log('[BACKEND-SYNC] Sync result:', syncData);
          if ((syncData?.closed === 1 || syncData?.found === 1) && syncData?.id) {
            await sql`
              UPDATE records 
              SET is_matched = true, 
                  matched_ticket = ${syncData.id} 
              WHERE id = ${result[0].id}
            `;
            console.log(`[BACKEND-SYNC] Local record ${result[0].id} matched with ticket ${syncData.id}`);
          }
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
