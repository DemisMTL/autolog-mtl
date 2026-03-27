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
      SET is_matched = false,
          matched_ticket = null
      WHERE id = ${id}
    `;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error unmatching record:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
