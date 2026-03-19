import { getDb } from './src/lib/db';

async function main() {
    const sql = getDb();
    console.log("Adding 'matched_ticket' column to 'records' table...");
    try {
        await sql`ALTER TABLE records ADD COLUMN IF NOT EXISTS matched_ticket TEXT`;
        console.log("Success!");
    } catch (e) {
        console.error("Migration failed:", e.message);
    }
}

main().catch(console.error);
