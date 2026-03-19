import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sql = getDb();

    // Accept optional commessa from request body
    let commessa: string | null = null;
    try {
      const body = await req.json();
      commessa = body.commessa || null;
    } catch { /* no body or invalid JSON — that's fine */ }

    await sql`
      UPDATE records 
      SET is_matched = TRUE,
          matched_ticket = ${commessa}
      WHERE id = ${id}
    `;

    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    console.error('Errore aggiornamento record:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
