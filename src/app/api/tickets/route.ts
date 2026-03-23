import { NextRequest, NextResponse } from 'next/server';

const TICKET_APP_URL = process.env.TICKET_APP_URL || 'http://localhost:3001';

// GET: fetch tickets from App-Ticket (by status)
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const status = searchParams.get('status') || 'Da fare';

        const res = await fetch(`${TICKET_APP_URL}/api/tickets?status=${encodeURIComponent(status)}`, {
            cache: 'no-store',
        });

        if (!res.ok) {
            return NextResponse.json({ error: 'Failed to fetch tickets from App-Ticket' }, { status: 502 });
        }

        const tickets = await res.json();
        return NextResponse.json(tickets);
    } catch (error: any) {
        console.error('Proxy ticket fetch error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PATCH: update ticket status in App-Ticket
export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json();
        const { id, status } = body;

        if (!id || !status) {
            return NextResponse.json({ error: 'Missing id or status' }, { status: 400 });
        }

        const res = await fetch(`${TICKET_APP_URL}/api/tickets/${id}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'x-api-key': process.env.SYNC_API_KEY || ''
            },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            return NextResponse.json({ error: 'Failed to update ticket' }, { status: 502 });
        }

        const updated = await res.json();
        return NextResponse.json(updated);
    } catch (error: any) {
        console.error('Proxy ticket update error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
