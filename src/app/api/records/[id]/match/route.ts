import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const sql = getDb();

    await sql`
      UPDATE records 
      SET is_matched = TRUE 
      WHERE id = ${id}
    `;

    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    console.error('Errore aggiornamento record:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
