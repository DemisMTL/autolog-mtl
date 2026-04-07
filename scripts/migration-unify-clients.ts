
import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load ENV from both projects
const mtlEnvPath = path.resolve('/Users/demisgrandis/Desktop/MTL-Ecosystem/App_MTL/app-mtl/.env.local');
const ticketEnvPath = path.resolve('/Users/demisgrandis/Desktop/MTL-Ecosystem/App-Ticket/.env');

const mtlEnv = dotenv.parse(fs.readFileSync(mtlEnvPath));
const ticketEnv = dotenv.parse(fs.readFileSync(ticketEnvPath));

const MTL_DB_URL = mtlEnv.DATABASE_URL;
const TICKET_DB_URL = ticketEnv.DATABASE_URL;

const dryRun = process.argv.includes('--dry-run');

if (!MTL_DB_URL || !TICKET_DB_URL) {
  console.error('ERROR: Database URLs not found');
  process.exit(1);
}

const sqlMTL = neon(MTL_DB_URL);
const sqlTicket = neon(TICKET_DB_URL);

const fuzzyNormalize = (name: string) => {
  if (!name) return "";
  return name.toUpperCase()
    .trim()
    .replace(/\s+/g, '')
    .replace(/[.,]/g, '')
    .replace(/SRL$/g, '')
    .replace(/SPA$/g, '')
    .replace(/SAS$/g, '')
    .replace(/SNC$/g, '');
};

async function run() {
  console.log(`\n🚀 Starting Retroactive Client Unification${dryRun ? ' (DRY RUN)' : ''}...`);

  try {
    // 1. Fetch Master Clients from App-Ticket
    console.log(`📅 Fetching master names from Ticket database...`);
    const masterTickets = await sqlTicket`
      SELECT DISTINCT "clientName" FROM "Ticket" WHERE "clientName" IS NOT NULL
    `;
    const masterNames = masterTickets.map(t => t.clientName);
    console.log(`✅ Loaded ${masterNames.length} master names from Tickets.\n`);

    // 2. Fetch all records from App-MTL
    const allRecords = await sqlMTL`SELECT id, cliente FROM records WHERE cliente IS NOT NULL`;
    console.log(`📊 Found ${allRecords.length} records to verify.\n`);

    const changes = new Map<string, string>();
    let totalUpdated = 0;

    for (const record of allRecords) {
      const currentName = record.cliente;
      const normalizedCurrent = fuzzyNormalize(currentName);
      
      // Try to find a match in masterNames
      const match = masterNames.find(mn => fuzzyNormalize(mn) === normalizedCurrent);
      
      if (match && match !== currentName) {
        if (!dryRun) {
          await sqlMTL`UPDATE records SET cliente = ${match} WHERE id = ${record.id}`;
        }
        changes.set(currentName, match);
        totalUpdated++;
      }
    }

    if (changes.size > 0) {
      console.log('📋 Summary of changes:');
      changes.forEach((to, from) => {
        console.log(`  - "${from}" -> "${to}"`);
      });
      console.log(`\n✅ Total unique names mapped: ${changes.size}`);
    } else {
      console.log('✅ No changes needed.');
    }

    if (dryRun) console.log(`\n⚠️  This was a DRY RUN. No changes were saved.`);
    else console.log(`\n✅ Successfully updated ${totalUpdated} records.`);

  } catch (error: any) {
    console.error(`\n❌ Error during migration:`, error.message);
    process.exit(1);
  }
}

run();
