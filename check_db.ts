import { getDb } from './src/lib/db';

async function main() {
    const sql = getDb();
    try {
        const columns = await sql`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'records'
        `;
        console.log("Columns in 'records' table:");
        columns.forEach(c => console.log(` - ${c.column_name}`));

        const sample = await sql`
            SELECT id, is_matched, matched_ticket 
            FROM records 
            WHERE is_matched = TRUE 
            LIMIT 5
        `;
        console.log("\nSample matched records:");
        sample.forEach(s => console.log(` ID: ${s.id} | Matched: ${s.is_matched} | Ticket: ${s.matched_ticket}`));
    } catch (e) {
        console.error("Error:", e.message);
    }
}

main().catch(console.error);
