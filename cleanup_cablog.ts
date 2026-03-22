
import { getDb } from './src/lib/db';

async function cleanup() {
  const sql = getDb();
  console.log("Inizio bonifica record CABLOG...");
  
  const result = await sql`
    UPDATE records 
    SET is_matched = FALSE,
        matched_ticket = NULL
    WHERE cliente ILIKE '%CABLOG%'
    RETURNING id
  `;
  
  console.log(`Bonifica completata! Aggiornati ${result.length} record.`);
}

cleanup().catch(err => {
  console.error("Errore durante la bonifica:", err.message);
  process.exit(1);
});
