import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const sql = getDb();
    
    // Total records
    const totalResult = await sql`SELECT COUNT(*) as count FROM records`;
    const totalRecords = parseInt(totalResult[0]?.count || '0');

    // Records in the last 24h
    const last24hResult = await sql`
      SELECT COUNT(*) as count 
      FROM records 
      WHERE timestamp::timestamp > NOW() - INTERVAL '24 hours'
    `;
    const last24hRecords = parseInt(last24hResult[0]?.count || '0');

    // Last 5 records
    const latestRecords = await sql`
      SELECT id, targa, cliente, tecnico, timestamp 
      FROM records 
      ORDER BY timestamp DESC 
      LIMIT 5
    `;

    return NextResponse.json({
      status: 'online',
      app: 'Autolog-MTL',
      stats: {
        totalRecords,
        last24hRecords
      },
      latestRecords
    });
  } catch (error: any) {
    console.error('[STATUS] Error:', error.message);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
