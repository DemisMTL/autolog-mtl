"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface InterventRecord {
  id: number;
  timestamp: string;
  targa: string | null;
  tipo_veicolo: string | null;
  numero_veicolo: string | null;
  lavorazione_eseguita: string | null;
  note: string;
  lat: number | null;
  lng: number | null;
  cliente?: string | null;
  telaio?: string | null;
  seriale_centralina?: string | null;
  marca_veicolo?: string | null;
  anno_immatricolazione?: string | null;
  marca_modello_tachigrafo?: string | null;
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
  return { day: date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }), time: date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) };
}

// ─── Modale di modifica ───────────────────────────────────────────────────────
function EditModal({ record, onSave, onClose }: {
  record: InterventRecord;
  onSave: (updated: Partial<InterventRecord>) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    cliente: record.cliente || '',
    targa: record.targa || '',
    tipo_veicolo: record.tipo_veicolo || '',
    numero_veicolo: record.numero_veicolo || '',
    marca_modello_tachigrafo: record.marca_modello_tachigrafo || '',
    lavorazione_eseguita: record.lavorazione_eseguita || '',
    note: record.note || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  const fieldStyle = {
    width: '100%', padding: '12px', borderRadius: '12px',
    background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)',
    color: 'white', fontSize: '1rem', fontFamily: 'inherit', boxSizing: 'border-box' as const
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      backdropFilter: 'blur(4px)'
    }} onClick={onClose}>
      <div style={{
        background: 'linear-gradient(135deg, #1e293b, #0f172a)',
        borderRadius: '24px 24px 0 0', padding: '24px', width: '100%', maxWidth: '600px',
        border: '1px solid var(--glass-border)', maxHeight: '80vh', overflowY: 'auto'
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '1.2rem' }}>✏️ Modifica Scheda</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '1.5rem', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[
            { label: '🏢 Cliente / Azienda', key: 'cliente' },
            { label: 'Targa', key: 'targa' },
            { label: '📅 Anno Immatricolazione', key: 'anno_immatricolazione' },
            { label: 'Tipo Veicolo', key: 'tipo_veicolo' },
            { label: 'Numero Veicolo Aziendale', key: 'numero_veicolo' },
            { label: '⏱️ Marca/Versione Tachigrafo', key: 'marca_modello_tachigrafo' },
          ].map(({ label, key }) => (
            <div key={key}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>{label}</label>
              <input
                type="text"
                value={(form as any)[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                style={fieldStyle}
              />
            </div>
          ))}
          <div>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Lavorazione Eseguita</label>
            <textarea
              value={form.lavorazione_eseguita}
              onChange={e => setForm(f => ({ ...f, lavorazione_eseguita: e.target.value }))}
              style={{ ...fieldStyle, minHeight: '80px', resize: 'vertical' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Note</label>
            <textarea
              value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              style={{ ...fieldStyle, minHeight: '60px', resize: 'vertical' }}
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '14px', borderRadius: '16px', background: 'rgba(255,255,255,0.08)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: '600' }}>Annulla</button>
          <button onClick={handleSubmit} disabled={saving} className="btn-primary" style={{ flex: 2, padding: '14px', borderRadius: '16px' }}>
            {saving ? '⏳ Salvataggio...' : '✅ Salva Modifiche'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Componente principale ────────────────────────────────────────────────────
export default function Home() {
  const [records, setRecords] = useState<InterventRecord[]>([]);
  const [todayCount, setTodayCount] = useState(0);
  const [monthCount, setMonthCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [editingRecord, setEditingRecord] = useState<InterventRecord | null>(null);

  const loadRecords = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/get-records');
      const data = await res.json();
      if (res.ok && data.records) {
        const sorted = data.records.sort(
          (a: InterventRecord, b: InterventRecord) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        setRecords(sorted);
        const now = new Date();
        setTodayCount(sorted.filter((r: InterventRecord) => new Date(r.timestamp).toDateString() === now.toDateString()).length);
        setMonthCount(sorted.filter((r: InterventRecord) => {
          const d = new Date(r.timestamp);
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }).length);
      }
    } catch (err) {
      console.error('Errore caricamento record:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadRecords(); }, []);

  const handleDelete = async (id: number) => {
    if (!confirm('Eliminare questa scheda?')) return;
    await fetch(`/api/records/${id}`, { method: 'DELETE' });
    setRecords(prev => prev.filter(r => r.id !== id));
    // Aggiorna contatori
    const now = new Date();
    const updated = records.filter(r => r.id !== id);
    setTodayCount(updated.filter(r => new Date(r.timestamp).toDateString() === now.toDateString()).length);
    setMonthCount(updated.filter(r => { const d = new Date(r.timestamp); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).length);
  };

  const handleSaveEdit = async (updated: Partial<InterventRecord>) => {
    if (!editingRecord) return;
    await fetch(`/api/records/${editingRecord.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
    setRecords(prev => prev.map(r => r.id === editingRecord.id ? { ...r, ...updated } : r));
    setEditingRecord(null);
  };

  return (
    <main className="app-container">
      <div className="bg-glow"></div>
      <div className="bg-glow-2"></div>

      {editingRecord && (
        <EditModal
          record={editingRecord}
          onSave={handleSaveEdit}
          onClose={() => setEditingRecord(null)}
        />
      )}

      <header className="header">
        <div>
          <img src="/logo.jpg" alt="MecTronicLab Logo" style={{ height: '55px', objectFit: 'contain', background: 'rgba(255,255,255,0.95)', padding: '6px 16px', borderRadius: '14px' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '4px' }}>Registro interventi meccanici</p>
        </div>
        <Link href="/report" style={{ textDecoration: 'none' }}>
          <div style={{
            borderRadius: '14px', background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.3)',
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
          <div style={{ flex: 1, background: 'rgba(0,0,0,0.25)', padding: '20px 16px', borderRadius: '16px', textAlign: 'center' }}>
            <span style={{ display: 'block', fontSize: '2.2rem', fontWeight: 'bold', color: 'var(--accent)', lineHeight: '1.2' }}>{todayCount}</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Oggi</span>
          </div>
          <div style={{ flex: 1, background: 'rgba(0,0,0,0.25)', padding: '20px 16px', borderRadius: '16px', textAlign: 'center' }}>
            <span style={{ display: 'block', fontSize: '2.2rem', fontWeight: 'bold', color: 'var(--success)', lineHeight: '1.2' }}>{monthCount}</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mese</span>
          </div>
        </div>
      </section>

      <section style={{ marginTop: '20px', marginBottom: '100px' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '20px' }}>Ultime Registrazioni</h2>

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
            <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '12px' }}>⏳</span>
            <p>Caricamento...</p>
          </div>
        ) : records.length === 0 ? (
          <div className="glass-panel" style={{ textAlign: 'center', padding: '48px 24px', opacity: 0.7 }}>
            <span style={{ fontSize: '3rem', display: 'block', marginBottom: '16px' }}>📋</span>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem' }}>
              Nessun intervento registrato.<br />Tocca il pulsante in basso per iniziare!
            </p>
          </div>
        ) : (
          <div className="recent-list">
            {records.slice(0, 30).map((record) => {
              const { day, time } = formatDate(record.timestamp);
              return (
                <div key={record.id} className="record-card">
                  <div className="record-icon">{getVehicleEmoji(record.tipo_veicolo)}</div>
                  <div className="record-details" style={{ flex: 1 }}>
                    <h3 style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {[record.targa, record.numero_veicolo ? `· #${record.numero_veicolo}` : null]
                        .filter(Boolean).join(' ') || record.tipo_veicolo || 'Veicolo'}
                    </h3>
                    {(record.marca_veicolo || record.anno_immatricolazione) && (
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '2px' }}>
                        {record.marca_veicolo} {record.anno_immatricolazione ? `(${record.anno_immatricolazione})` : ''}
                      </p>
                    )}
                    {record.marca_modello_tachigrafo && (
                      <p style={{ color: '#a78bfa', fontSize: '0.85rem', marginBottom: '2px' }}>⏱️ {record.marca_modello_tachigrafo}</p>
                    )}
                    {record.cliente && (
                      <p style={{ color: 'var(--accent)', fontSize: '0.85rem', fontWeight: '500', marginBottom: '2px' }}>🏢 {record.cliente}</p>
                    )}
                    <p>{record.lavorazione_eseguita || record.note || '—'}</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                    <div className="record-meta" style={{ textAlign: 'right' }}>
                      <span>{day}</span><br />
                      <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{time}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => setEditingRecord(record)}
                        style={{ background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: '10px', padding: '6px 10px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--accent)' }}
                        title="Modifica"
                      >✏️</button>
                      <button
                        onClick={() => handleDelete(record.id)}
                        style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '6px 10px', cursor: 'pointer', fontSize: '0.85rem', color: '#ef4444' }}
                        title="Elimina"
                      >🗑</button>
                    </div>
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
            <span style={{ fontSize: '1.5rem' }}>📸</span>
            <span>Nuova Registrazione</span>
          </button>
        </Link>
      </div>
    </main>
  );
}
