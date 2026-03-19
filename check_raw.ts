import { getDb } from './src/lib/db';

async function main() {
    const sql = getDb();
    try {
        const rows = await sql`SELECT * FROM records WHERE is_matched = TRUE LIMIT 1`;
        console.log("Raw row from DB:");
        console.log(JSON.stringify(rows[0], null, 2));
    } catch (e) {
        console.error("Error:", e.message);
    }
}

main().catch(console.error);
