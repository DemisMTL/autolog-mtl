"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import TicketPanel from './components/TicketPanel';

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
  fornitore_servizio?: string | null;
  tecnico?: string | null;
  is_matched?: boolean;
  matched_ticket?: string | null;
}

const VEHICLE_ICONS: { [key: string]: string } = {
  rimorchio: '/icons/trailer.png', semi: '/icons/trailer.png',
  pesante: '/icons/heavy-truck.png', camion: '/icons/heavy-truck.png', stradale: '/icons/heavy-truck.png', trattore: '/icons/heavy-truck.png',
  furgone: '/icons/van.png', commerciale: '/icons/van.png',
  terra: '/icons/earthmoving.png', escavatore: '/icons/earthmoving.png', ruspa: '/icons/earthmoving.png',
  agricola: '/icons/agri.png', agricolo: '/icons/agri.png',
  berlina: '/icons/car.png', auto: '/icons/car.png', suv: '/icons/car.png', default: '/icons/car.png'
};

function getVehicleIcon(tipo: string | null): string {
  if (!tipo) return '/icons/car.png';
  const lower = tipo.toLowerCase();
  for (const [key, iconPath] of Object.entries(VEHICLE_ICONS)) {
    if (lower.includes(key)) return iconPath;
  }
  return VEHICLE_ICONS.default;
}

function formatDate(timestamp: string): { day: string; time: string } {
  const date = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return { day: 'Oggi', time: date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) };
  if (diffDays === 1) return { day: 'Ieri', time: date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) };
  return { day: date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }), time: date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) };
}

// ─── Modale Ticket (Iframe) ──────────────────────────────────────────────────
function TicketPopup({ commessa, onClose }: { commessa: string, onClose: () => void }) {
  let baseUrl = process.env.NEXT_PUBLIC_TICKET_APP_URL || '';
  if (baseUrl && !baseUrl.startsWith('http')) baseUrl = `https://${baseUrl}`;
  const ticketUrl = `${baseUrl}/view?commessa=${commessa}&embed=true`;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000, 
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px', backgroundColor: 'rgba(0,0,0,0.8)',
      backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)'
    }} onClick={onClose}>
      <div style={{
        position: 'relative', width: '100%', maxWidth: '900px', height: '85vh',
        backgroundColor: '#121212', borderRadius: '24px', overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
        display: 'flex', flexDirection: 'column'
      }} onClick={e => e.stopPropagation()}>
        {/* Header con chiusura */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'rgba(255,255,255,0.03)'
        }}>
          <h3 style={{ color: 'white', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <span style={{ fontSize: '1.2rem' }}>🎟️</span> Dettaglio Ticket #{commessa}
          </h3>
          <button 
            onClick={onClose}
            style={{
              padding: '8px', background: 'rgba(255,255,255,0.05)', border: 'none',
              borderRadius: '50%', color: 'rgba(255,255,255,0.6)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'
            }}
          >
            ✕
          </button>
        </div>
        
        {/* Iframe */}
        <div style={{ flex: 1, backgroundColor: '#000', position: 'relative' }}>
          <iframe 
            src={ticketUrl}
            style={{ width: '100%', height: '100%', border: 'none' }}
            title={`Ticket ${commessa}`}
          />
        </div>
      </div>
    </div>
  );
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
    anno_immatricolazione: record.anno_immatricolazione || '',
    marca_veicolo: record.marca_veicolo || '',
    tipo_veicolo: record.tipo_veicolo || '',
    numero_veicolo: record.numero_veicolo || '',
    telaio: record.telaio || '',
    seriale_centralina: record.seriale_centralina || '',
    marca_modello_tachigrafo: record.marca_modello_tachigrafo || '',
    fornitore_servizio: record.fornitore_servizio || '',
    tecnico: record.tecnico || '',
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
            { label: 'Marca Veicolo', key: 'marca_veicolo' },
            { label: 'Tipo Veicolo', key: 'tipo_veicolo' },
            { label: 'Numero Veicolo Aziendale', key: 'numero_veicolo' },
            { label: '⏱️ Marca/Versione Tachigrafo', key: 'marca_modello_tachigrafo' },
            { label: '📡 Fornitore Servizio', key: 'fornitore_servizio' },
            { label: '👤 Tecnico Assegnato', key: 'tecnico' },
            { label: '🔢 N. Telaio', key: 'telaio' },
            { label: '🔌 Seriale Centralina', key: 'seriale_centralina' },
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

  const [showTicketCommessa, setShowTicketCommessa] = useState<string | null>(null);

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

  useEffect(() => {
    // Memorizza tecnico se passato via URL link
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tec = params.get('tecnico');
      if (tec) {
        localStorage.setItem('autolog_tecnico', tec.toUpperCase());
      }
    }
    loadRecords();
  }, []);

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
          <img src="/logo.jpg" alt="MecTronicLab Logo" style={{ height: '56px', objectFit: 'contain', background: 'rgba(255,255,255,0.95)', padding: '6px 16px', borderRadius: '14px' }} />
        </div>
        <Link href="/report" style={{ textDecoration: 'none' }}>
          <div style={{
            height: '56px', borderRadius: '14px', background: 'rgba(211,47,47,0.12)', border: '1px solid rgba(211,47,47,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            backdropFilter: 'blur(8px)', padding: '0 20px', color: 'var(--accent)', fontWeight: '600', fontSize: '1.05rem'
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '24px', height: '24px' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            Report
          </div>
        </Link>
      </header>

      <section className="glass-panel" style={{ marginTop: '8px' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="var(--accent)" style={{ width: '26px', height: '26px' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
          </svg>
          Statistiche Rapide
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

      <TicketPanel />

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
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', minWidth: '70px' }}>
                    <div className="record-meta" style={{ textAlign: 'center', lineHeight: '1.2' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{day}</span><br />
                      <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{time}</span>
                    </div>
                    <div className="record-icon" style={{ margin: 0 }}>
                      <img style={{ width: '100%', height: '100%', objectFit: 'contain' }} src={getVehicleIcon(record.tipo_veicolo)} alt="Vehicle Icon" />
                    </div>
                  </div>
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
                    {(record.marca_modello_tachigrafo || record.fornitore_servizio) && (
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '2px' }}>
                        {record.marca_modello_tachigrafo && <span className="tag" style={{ color: '#e57373', fontSize: '0.85rem' }} title="Info Tachigrafo">⏱️ {record.marca_modello_tachigrafo}</span>}
                        {record.fornitore_servizio && <span className="tag" style={{ color: '#81c784', fontSize: '0.85rem' }} title="Fornitore Servizio">📡 {record.fornitore_servizio}</span>}
                        {record.tecnico && <span className="tag" style={{ color: '#fbc02d', fontSize: '0.85rem' }} title="Tecnico Assegnato">👤 {record.tecnico}</span>}
                      </div>
                    )}
                    {record.cliente && (
                      <p style={{ color: 'var(--accent)', fontSize: '0.85rem', fontWeight: '500', marginBottom: '2px' }}>🏢 {record.cliente}</p>
                    )}
                    <p>{record.lavorazione_eseguita || record.note || '—'}</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', gap: '8px' }}>
                    {/* RIGA SUPERIORE (Spunta e Ticket) - Mostra la riga SOLO se almeno uno dei due è presente */}
                    {(record.is_matched === true || (record.matched_ticket && record.matched_ticket !== "")) && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {record.is_matched === true && (
                          <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: '40px', height: '40px',
                            background: 'rgba(16,185,129,0.1)', borderRadius: '12px',
                            border: '1px solid rgba(16,185,129,0.2)'
                          }} title="Matchato con Ticket">
                            <span style={{ fontSize: '1.2rem', filter: 'drop-shadow(0 0 5px rgba(16,185,129,0.3))' }}>✅</span>
                          </div>
                        )}
                        {record.matched_ticket && record.matched_ticket !== "" && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setShowTicketCommessa(record.matched_ticket!); }}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              width: '40px', height: '40px',
                              background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.2)',
                              borderRadius: '12px', cursor: 'pointer', fontSize: '1.3rem', transition: 'all 0.2s'
                            }}
                            title="Vedi Ticket"
                          >
                            🎟️
                          </button>
                        )}
                      </div>
                    )}
                    
                    {/* RIGA INFERIORE (Modifica ed Elimina) */}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingRecord(record); }}
                        style={{ 
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: '40px', height: '40px',
                          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', 
                          cursor: 'pointer', fontSize: '1.2rem', transition: 'all 0.2s'
                        }}
                        title="Modifica"
                      >✏️</button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(record.id); }}
                        style={{ 
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: '40px', height: '40px',
                          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px', 
                          cursor: 'pointer', fontSize: '1.2rem', transition: 'all 0.2s'
                        }}
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
      {/* Modale Ticket Popup */}
      {showTicketCommessa && (
        <TicketPopup 
          commessa={showTicketCommessa} 
          onClose={() => setShowTicketCommessa(null)} 
        />
      )}
    </main>
  );
}
