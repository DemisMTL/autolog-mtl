const { neon } = require('@neondatabase/serverless');

const DATABASE_URL = "postgresql://neondb_owner:npg_wVSCEhNJTs46@ep-bitter-water-al8c02bd-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require";

async function repair() {
  const sql = neon(DATABASE_URL);
  const ticketCommessa = 'MTL-WO-0031681';
  const recordIds = [78, 105];

  console.log(`Updating MTL records ${recordIds.join(', ')} to match ticket ${ticketCommessa}`);
  
  await sql`
    UPDATE records 
    SET is_matched = true, 
        matched_ticket = ${ticketCommessa} 
    WHERE id IN (78, 105)
  `;
  
  console.log("MTL records updated successfully.");
}

repair().catch(console.error);
