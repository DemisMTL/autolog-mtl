'use client';

import { useState, useEffect, useCallback } from 'react';

interface Ticket {
    id: string;
    commessa: string | null;
    clientName: string | null;
    address: string | null;
    phone: string | null;
    referent: string | null;
    workDescription: string | null;
    domain: string | null;
    deviceCodes: string | null;
    notes: string | null;
    status: string;
    createdAt: string;
}

export default function TicketPanel() {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [updating, setUpdating] = useState<string | null>(null);

    const loadTickets = useCallback(async () => {
        setIsLoading(true);
        try {
            // Fetch both "Da fare" and "In corso" tickets for the technician
            const [todoRes, inProgressRes] = await Promise.all([
                fetch('/api/tickets?status=Da fare', { cache: 'no-store' }),
                fetch('/api/tickets?status=In corso', { cache: 'no-store' }),
            ]);
            const todo = todoRes.ok ? await todoRes.json() : [];
            const inProgress = inProgressRes.ok ? await inProgressRes.json() : [];
            setTickets([...inProgress, ...todo]);
        } catch (err) {
            console.error('Errore caricamento ticket:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadTickets();
    }, [loadTickets]);

    const updateStatus = async (ticketId: string, newStatus: string) => {
        setUpdating(ticketId);
        try {
            const res = await fetch('/api/tickets', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: ticketId, status: newStatus }),
            });
            if (res.ok) {
                if (newStatus === 'Completato') {
                    setTickets(prev => prev.filter(t => t.id !== ticketId));
                } else {
                    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: newStatus } : t));
                }
            }
        } catch (err) {
            console.error('Errore aggiornamento ticket:', err);
        } finally {
            setUpdating(null);
        }
    };

    if (isLoading) {
        return (
            <section className="glass-panel" style={{ marginTop: '20px' }}>
                <h2 style={{ fontSize: '1.25rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>🎫</span> Ticket Assegnati
                </h2>
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                    <span style={{ fontSize: '1.5rem' }}>⏳</span>
                    <p style={{ marginTop: '8px', fontSize: '0.9rem' }}>Caricamento ticket...</p>
                </div>
            </section>
        );
    }

    if (tickets.length === 0) return null;

    return (
        <section className="glass-panel" style={{ marginTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>🎫</span> Ticket Assegnati
                    <span style={{
                        background: 'rgba(211,47,47,0.2)', color: 'var(--accent)',
                        borderRadius: '999px', padding: '2px 10px', fontSize: '0.85rem', fontWeight: 'bold'
                    }}>{tickets.length}</span>
                </h2>
                <button
                    onClick={loadTickets}
                    style={{
                        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: '10px', padding: '6px 12px', color: 'var(--text-secondary)',
                        cursor: 'pointer', fontSize: '0.85rem'
                    }}
                >🔄 Aggiorna</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {tickets.map(ticket => {
                    const isExpanded = expanded === ticket.id;
                    const isInProgress = ticket.status === 'In corso';
                    const isUpdating = updating === ticket.id;

                    return (
                        <div
                            key={ticket.id}
                            style={{
                                background: isInProgress
                                    ? 'rgba(251,191,36,0.07)'
                                    : 'rgba(0,0,0,0.25)',
                                border: isInProgress
                                    ? '1px solid rgba(251,191,36,0.3)'
                                    : '1px solid rgba(255,255,255,0.07)',
                                borderRadius: '16px',
                                overflow: 'hidden',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            {/* Header */}
                            <div
                                onClick={() => setExpanded(isExpanded ? null : ticket.id)}
                                style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}
                            >
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                                        <span style={{
                                            borderRadius: '6px', padding: '2px 8px', fontSize: '0.75rem', fontWeight: '700',
                                            background: isInProgress ? 'rgba(251,191,36,0.2)' : 'rgba(59,130,246,0.15)',
                                            color: isInProgress ? '#fbbf24' : '#60a5fa',
                                            border: `1px solid ${isInProgress ? 'rgba(251,191,36,0.3)' : 'rgba(59,130,246,0.25)'}`,
                                        }}>
                                            {isInProgress ? '🔧 in corso' : '📋 da fare'}
                                        </span>
                                        {ticket.commessa && (
                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>#{ticket.commessa}</span>
                                        )}
                                    </div>
                                    <p style={{ fontWeight: '600', fontSize: '0.95rem', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {ticket.clientName || 'Cliente non specificato'}
                                    </p>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {ticket.workDescription || ticket.notes || 'Nessuna descrizione'}
                                    </p>
                                </div>
                                <span style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', flexShrink: 0, transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'none' }}>›</span>
                            </div>

                            {/* Expanded Details */}
                            {isExpanded && (
                                <div style={{ padding: '0 16px 16px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                                    <div style={{ paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {ticket.address && (
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                                <span style={{ flexShrink: 0 }}>📍</span>
                                                <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>{ticket.address}</span>
                                            </div>
                                        )}
                                        {ticket.phone && (
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                <span style={{ flexShrink: 0 }}>📞</span>
                                                <a href={`tel:${ticket.phone}`} style={{ fontSize: '0.88rem', color: 'var(--accent)', fontWeight: '600' }}>{ticket.phone}</a>
                                            </div>
                                        )}
                                        {ticket.referent && (
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                <span style={{ flexShrink: 0 }}>👤</span>
                                                <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>{ticket.referent}</span>
                                            </div>
                                        )}
                                        {ticket.deviceCodes && (
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                                <span style={{ flexShrink: 0 }}>🔌</span>
                                                <span style={{ fontSize: '0.88rem', fontFamily: 'monospace', color: '#81c784' }}>{ticket.deviceCodes}</span>
                                            </div>
                                        )}
                                        {ticket.domain && (
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                <span style={{ flexShrink: 0 }}>🌐</span>
                                                <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>{ticket.domain}</span>
                                            </div>
                                        )}
                                        {ticket.notes && (
                                            <div style={{
                                                background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
                                                borderRadius: '10px', padding: '10px', marginTop: '4px'
                                            }}>
                                                <p style={{ fontSize: '0.8rem', color: '#60a5fa', fontWeight: '600', marginBottom: '4px' }}>💬 Note Ufficio</p>
                                                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>{ticket.notes}</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Buttons */}
                                    <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                                        {!isInProgress ? (
                                            <button
                                                onClick={() => updateStatus(ticket.id, 'In corso')}
                                                disabled={isUpdating}
                                                style={{
                                                    flex: 1, padding: '12px', borderRadius: '12px',
                                                    background: 'rgba(251,191,36,0.12)', color: '#fbbf24',
                                                    fontWeight: '700', cursor: 'pointer', fontSize: '0.9rem',
                                                    border: '1px solid rgba(251,191,36,0.3)', transition: 'all 0.2s'
                                                } as React.CSSProperties}
                                            >
                                                {isUpdating ? '⏳...' : '🔧 Prendi in carico'}
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => updateStatus(ticket.id, 'Completato')}
                                                disabled={isUpdating}
                                                style={{
                                                    flex: 1, padding: '12px', borderRadius: '12px',
                                                    background: 'rgba(52,211,153,0.12)', color: '#34d399',
                                                    fontWeight: '700', cursor: 'pointer', fontSize: '0.9rem',
                                                    border: '1px solid rgba(52,211,153,0.3)', transition: 'all 0.2s'
                                                } as React.CSSProperties}
                                            >
                                                {isUpdating ? '⏳...' : '✅ Segna Completato'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
