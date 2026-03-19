import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
    try {
        const sql = getDb();
        
        // 1. Fetch tickets from App-Ticket
        // We use the internal URL or the production one
        const ticketAppUrl = process.env.TICKET_APP_URL || 'https://app-ticket-mectronic.vercel.app';
        const res = await fetch(`${ticketAppUrl}/api/tickets`);
        if (!res.ok) throw new Error(`Failed to fetch tickets: ${res.status}`);
        const { tickets } = await res.json();

        // 2. Fetch matched records from MTL
        const records = await sql`
            SELECT id, targa, seriale_centralina, cliente 
            FROM records 
            WHERE is_matched = TRUE
        `;

        const normalize = (val: string | null | undefined) => {
            if (!val) return '';
            return val.toString().toLowerCase().replace(/[^a-z0-9]/g, '').trim();
        };

        let updated = 0;
        for (const rec of records) {
            const recSeriale = normalize(rec.seriale_centralina);
            const recTarga = normalize(rec.targa);
            const recCliente = normalize(rec.cliente);

            const match = tickets.find((t: any) => {
                const tTarga = normalize(t.licensePlate);
                const tCliente = normalize(t.clientName);
                const tSerials = (t.deviceCodes || '').toLowerCase().replace(/[^a-z0-9\n]/g, '').split('\n');

                if (recSeriale && tSerials.some((s: string) => s.includes(recSeriale) || recSeriale.includes(s))) return true;
                if (recTarga && tTarga && recTarga === tTarga) return true;
                if (recCliente && tCliente && (recCliente === tCliente || recCliente.includes(tCliente) || tCliente.includes(recCliente))) return true;
                return false;
            });

            if (match) {
                await sql`
                    UPDATE records 
                    SET matched_ticket = ${match.commessa} 
                    WHERE id = ${rec.id}
                `;
                updated++;
            }
        }

        return NextResponse.json({ success: true, updated });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
