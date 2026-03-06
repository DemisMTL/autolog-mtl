import { neon } from '@neondatabase/serverless';

// Funzione che crea un client SQL connesso a Neon Postgres
export function getDb() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error('DATABASE_URL non configurata. Aggiungi la connection string Neon al file .env.local');
    }
    return neon(connectionString);
}

// Crea la tabella se non esiste (chiamata all'avvio)
export async function ensureTable() {
    const sql = getDb();
    await sql`
    CREATE TABLE IF NOT EXISTS records (
      id          BIGSERIAL PRIMARY KEY,
      timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      targa       TEXT,
      tipo_veicolo TEXT,
      numero_veicolo TEXT,
      lavorazione_eseguita TEXT,
      note        TEXT,
      lat         DOUBLE PRECISION,
      lng         DOUBLE PRECISION,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}
