import { neon } from '@neondatabase/serverless';

export function getDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL non configurata nel file .env.local');
  }
  return neon(connectionString);
}

export async function ensureTable() {
  const sql = getDb();
  await sql`
    CREATE TABLE IF NOT EXISTS records (
      id                  BIGSERIAL PRIMARY KEY,
      timestamp           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      targa               TEXT,
      tipo_veicolo        TEXT,
      numero_veicolo      TEXT,
      lavorazione_eseguita TEXT,
      note                TEXT,
      lat                 DOUBLE PRECISION,
      lng                 DOUBLE PRECISION,
      telaio              TEXT,
      seriale_centralina  TEXT,
      marca_veicolo       TEXT,
      cliente             TEXT,
      anno_immatricolazione TEXT,
      marca_modello_tachigrafo TEXT,
      fornitore_servizio  TEXT,
      tecnico             TEXT,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  // Migrazione: aggiunge le colonne se non esistono (per DB già creati)
  await sql`ALTER TABLE records ADD COLUMN IF NOT EXISTS telaio TEXT`;
  await sql`ALTER TABLE records ADD COLUMN IF NOT EXISTS seriale_centralina TEXT`;
  await sql`ALTER TABLE records ADD COLUMN IF NOT EXISTS marca_veicolo TEXT`;
  await sql`ALTER TABLE records ADD COLUMN IF NOT EXISTS cliente TEXT`;
  await sql`ALTER TABLE records ADD COLUMN IF NOT EXISTS anno_immatricolazione TEXT`;
  await sql`ALTER TABLE records ADD COLUMN IF NOT EXISTS marca_modello_tachigrafo TEXT`;
  await sql`ALTER TABLE records ADD COLUMN IF NOT EXISTS fornitore_servizio TEXT`;
  await sql`ALTER TABLE records ADD COLUMN IF NOT EXISTS tecnico TEXT`;
  await sql`ALTER TABLE records ADD COLUMN IF NOT EXISTS is_matched BOOLEAN DEFAULT FALSE`;
  await sql`ALTER TABLE records ADD COLUMN IF NOT EXISTS matched_ticket TEXT`;
  await sql`ALTER TABLE records ADD COLUMN IF NOT EXISTS tipo_lavorazione TEXT`;
  await sql`ALTER TABLE records ADD COLUMN IF NOT EXISTS collaudo_url TEXT`;
}
