"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface InterventRecord {
  id: string;
  targa: string | null;
  tipo_veicolo: string | null;
  numero_veicolo: string | null;
  lavorazione_eseguita: string | null;
  note: string;
  location: { lat: number; lng: number } | null;
  timestamp: string;
}

const VEHICLE_EMOJIS: { [key: string]: string } = {
  berlina: '🚗', auto: '🚗', suv: '🚙', furgone: '🚐',
  moto: '🏍', camion: '🚛', trattore: '🚜', default: '🚗'
};

function getVehicleEmoji(tipo: string | null): string {
  if (!tipo) return '🚗';
  const lower = tipo.toLowerCase();
  for (const [key, emoji] of Object.entries(VEHICLE_EMOJIS)) {
    if (lower.includes(key)) return emoji;
  }
  return VEHICLE_EMOJIS.default;
}

function formatDate(timestamp: string): { day: string; time: string } {
  const date = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return { day: 'Oggi', time: date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) };
  if (diffDays === 1) return { day: 'Ieri', time: date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) };
  return {
    day: date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }),
    time: date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  };
}

export default function Home() {
  const [records, setRecords] = useState<InterventRecord[]>([]);
  const [todayCount, setTodayCount] = useState(0);
  const [monthCount, setMonthCount] = useState(0);

  useEffect(() => {
    const stored = localStorage.getItem('autolog_records');
    if (stored) {
      const parsed: InterventRecord[] = JSON.parse(stored);
      // Sort by newest first
      parsed.sort((a: InterventRecord, b: InterventRecord) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setRecords(parsed);

      // Calculate stats
      const now = new Date();
      const today = parsed.filter(r => {
        const d = new Date(r.timestamp);
        return d.toDateString() === now.toDateString();
      });
      const month = parsed.filter(r => {
        const d = new Date(r.timestamp);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });
      setTodayCount(today.length);
      setMonthCount(month.length);
    }
  }, []);

  return (
    <main className="app-container">
      <div className="bg-glow"></div>
      <div className="bg-glow-2"></div>

      <header className="header">
        <div>
          <h1>AutoLog</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '4px' }}>
            Registro interventi meccanici
          </p>
        </div>
        <Link href="/report" style={{ textDecoration: 'none' }}>
          <div style={{
            borderRadius: '14px',
            background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            backdropFilter: 'blur(8px)', padding: '8px 14px', color: 'var(--accent)', fontWeight: '600', fontSize: '0.9rem'
          }}>
            <span style={{ fontSize: '1.2rem' }}>📊</span> Report
          </div>
        </Link>
      </header>

      <section className="glass-panel" style={{ marginTop: '8px' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>📊</span> Statistiche Rapide
        </h2>
        <div style={{ display: 'flex', gap: '16px' }}>
          <div style={{ flex: 1, background: 'rgba(0,0,0,0.25)', padding: '20px 16px', borderRadius: '16px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.02)' }}>
            <span style={{ display: 'block', fontSize: '2.2rem', fontWeight: 'bold', color: 'var(--accent)', lineHeight: '1.2' }}>{todayCount}</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Oggi</span>
          </div>
          <div style={{ flex: 1, background: 'rgba(0,0,0,0.25)', padding: '20px 16px', borderRadius: '16px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.02)' }}>
            <span style={{ display: 'block', fontSize: '2.2rem', fontWeight: 'bold', color: 'var(--success)', lineHeight: '1.2' }}>{monthCount}</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mese</span>
          </div>
        </div>
      </section>

      <section style={{ marginTop: '20px', marginBottom: '100px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '1.25rem' }}>Ultime Registrazioni</h2>
          {records.length > 0 && (
            <span
              style={{ fontSize: '0.9rem', color: 'var(--danger)', cursor: 'pointer', fontWeight: '500' }}
              onClick={() => {
                if (confirm('Cancellare tutte le registrazioni salvate?')) {
                  localStorage.removeItem('autolog_records');
                  setRecords([]);
                  setTodayCount(0);
                  setMonthCount(0);
                }
              }}
            >
              🗑 Azzera
            </span>
          )}
        </div>

        {records.length === 0 ? (
          <div className="glass-panel" style={{ textAlign: 'center', padding: '48px 24px', opacity: 0.7 }}>
            <span style={{ fontSize: '3rem', display: 'block', marginBottom: '16px' }}>📋</span>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem' }}>
              Nessun intervento registrato.<br />Tocca il pulsante in basso per iniziare!
            </p>
          </div>
        ) : (
          <div className="recent-list">
            {records.slice(0, 20).map((record) => {
              const { day, time } = formatDate(record.timestamp);
              return (
                <div key={record.id} className="record-card">
                  <div className="record-icon">{getVehicleEmoji(record.tipo_veicolo)}</div>
                  <div className="record-details">
                    <h3 style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {record.targa || record.tipo_veicolo || 'Veicolo sconosciuto'}
                    </h3>
                    <p>{record.lavorazione_eseguita || record.note || '—'}</p>
                  </div>
                  <div className="record-meta">
                    <span>{day}</span><br />
                    <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{time}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="fab-container">
        <Link href="/new" style={{ textDecoration: 'none', width: '100%', display: 'flex', justifyContent: 'center' }}>
          <button className="btn-primary fab">
            <span style={{ fontSize: '1.5rem', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}>📸</span>
            <span>Nuova Registrazione</span>
          </button>
        </Link>
      </div>
    </main>
  );
}
