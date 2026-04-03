import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// PATCH /api/records/[id] — aggiorna un record esistente
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const {
            targa, tipo_veicolo, numero_veicolo, lavorazione_eseguita, note,
            cliente, telaio, seriale_centralina, marca_veicolo, anno_immatricolazione,
            marca_modello_tachigrafo, fornitore_servizio, tecnico,
            is_matched, matched_ticket
        } = body;

        const sql = getDb();

        // Costruiamo la query in modo dinamico per non sovrascrivere is_matched/matched_ticket
        // con null se non vengono passati
        if (is_matched !== undefined || matched_ticket !== undefined) {
            // Aggiornamento match manuale
            await sql`
                UPDATE records
                SET
                    targa = COALESCE(${targa ?? null}, targa),
                    tipo_veicolo = COALESCE(${tipo_veicolo ?? null}, tipo_veicolo),
                    numero_veicolo = COALESCE(${numero_veicolo ?? null}, numero_veicolo),
                    lavorazione_eseguita = COALESCE(${lavorazione_eseguita ?? null}, lavorazione_eseguita),
                    note = COALESCE(${note ?? null}, note),
                    cliente = COALESCE(${cliente ?? null}, cliente),
                    telaio = COALESCE(${telaio ?? null}, telaio),
                    seriale_centralina = COALESCE(${seriale_centralina ?? null}, seriale_centralina),
                    marca_veicolo = COALESCE(${marca_veicolo ?? null}, marca_veicolo),
                    anno_immatricolazione = COALESCE(${anno_immatricolazione ?? null}, anno_immatricolazione),
                    marca_modello_tachigrafo = COALESCE(${marca_modello_tachigrafo ?? null}, marca_modello_tachigrafo),
                    fornitore_servizio = COALESCE(${fornitore_servizio ?? null}, fornitore_servizio),
                    tecnico = COALESCE(${tecnico ?? null}, tecnico),
                    is_matched = ${is_matched ?? false},
                    matched_ticket = ${matched_ticket ?? null}
                WHERE id = ${parseInt(id)}
            `;

            // Se viene impostato un match manuale, triggera il sync su App-Ticket
            // per marcare [OK] il veicolo nella lista del ticket
            if (is_matched === true && matched_ticket) {
                const [record] = await sql`SELECT targa, seriale_centralina, cliente FROM records WHERE id = ${parseInt(id)}`;
                if (record) {
                    try {
                        const ticketAppUrl = process.env.TICKET_APP_URL || process.env.NEXT_PUBLIC_TICKET_APP_URL || 'https://app-ticket-sigma.vercel.app';
                        const syncPayload = record.seriale_centralina || record.targa;
                        if (syncPayload) {
                            await fetch(`${ticketAppUrl}/api/tickets/sync`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.SYNC_API_KEY || '' },
                                body: JSON.stringify({
                                    serialNumber: syncPayload,
                                    customerName: record.cliente || '',
                                    plate: record.targa
                                })
                            });
                            console.log(`[MANUAL-MATCH] Triggered sync for record ${id} with payload: ${syncPayload}`);
                        }
                    } catch (syncErr: any) {
                        console.error('[MANUAL-MATCH] Sync error:', syncErr.message);
                    }
                }
            }
        } else {
            // Aggiornamento campi ordinari (EditModal)
            await sql`
                UPDATE records
                SET
                    targa = ${targa ?? null},
                    tipo_veicolo = ${tipo_veicolo ?? null},
                    numero_veicolo = ${numero_veicolo ?? null},
                    lavorazione_eseguita = ${lavorazione_eseguita ?? null},
                    note = ${note ?? null},
                    cliente = ${cliente ?? null},
                    telaio = ${telaio ?? null},
                    seriale_centralina = ${seriale_centralina ?? null},
                    marca_veicolo = ${marca_veicolo ?? null},
                    anno_immatricolazione = ${anno_immatricolazione ?? null},
                    marca_modello_tachigrafo = ${marca_modello_tachigrafo ?? null},
                    fornitore_servizio = ${fornitore_servizio ?? null},
                    tecnico = ${tecnico ?? null}
                WHERE id = ${parseInt(id)}
            `;
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
