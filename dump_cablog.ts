
import { getDb } from './src/lib/db';

async function dump() {
  const sql = getDb();
  const rows = await sql`
    SELECT id, targa, cliente, seriale_centralina, is_matched, matched_ticket 
    FROM records 
    WHERE cliente ILIKE '%CABLOG%'
    ORDER BY timestamp DESC 
    LIMIT 20
  `;
  console.log(JSON.stringify(rows, null, 2));
}
dump().catch(console.error);
