import { PrismaClient } from '@prisma/client';
import postgres from 'postgres';

const prisma = new PrismaClient();
const sql = postgres(process.env.MTL_DATABASE_URL!);

const normalize = (val: string | null | undefined) => {
    if (!val) return '';
    return val.toString().toLowerCase().replace(/[^a-z0-9]/g, '').trim();
};

async function main() {
    const sql = getDb();
    
    console.log("Fetching matching data from App-Ticket and App-MTL...");
    
    // 1. Get all tickets from App-Ticket
    const tickets = await prisma.ticket.findMany();
    console.log(`Loaded ${tickets.length} tickets from App-Ticket.`);

    // 2. Get records without ticket link from App-MTL
    const records = await sql`
        SELECT id, targa, seriale_centralina, cliente, note 
        FROM records 
        WHERE is_matched = TRUE AND (matched_ticket IS NULL OR matched_ticket = '')
    `;
    console.log(`Found ${records.length} matched records in App-MTL missing ticket link.\n`);

    let updatedCount = 0;

    for (const rec of records) {
        const recSeriale = normalize(rec.seriale_centralina);
        const recTarga = normalize(rec.targa);
        const recCliente = normalize(rec.cliente);

        // Find matching ticket
        const match = tickets.find(t => {
            const tTarga = normalize(t.licensePlate);
            const tCliente = normalize(t.clientName);
            const tSerials = (t.deviceCodes || '').toLowerCase().replace(/[^a-z0-9\n]/g, '').split('\n');

            // Match by serial
            if (recSeriale && tSerials.some(s => s.includes(recSeriale) || recSeriale.includes(s))) return true;
            // Match by targa
            if (recTarga && tTarga && recTarga === tTarga) return true;
            // Match by client (conservative)
            if (recCliente && tCliente && (recCliente === tCliente || recCliente.includes(tCliente) || tCliente.includes(recCliente))) {
                // If weightier data matches, good. If only client matches, we might be wrong, but for backfill it's better than nothing.
                return true;
            }
            return false;
        });

        if (match) {
            console.log(`Linking MTL Record ${rec.id} (${rec.targa || 'No Targa'}) -> Ticket ${match.commessa}`);
            await sql`
                UPDATE records 
                SET matched_ticket = ${match.commessa} 
                WHERE id = ${rec.id}
            `;
            updatedCount++;
        } else {
            console.log(`No match found for MTL Record ${rec.id} (${rec.targa || 'No Targa'})`);
        }
    }

    console.log(`\nBackfill complete. Linked ${updatedCount} records.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
