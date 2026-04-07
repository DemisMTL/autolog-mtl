
import { useState } from 'react';
import { InterventRecord } from '@/types';

// ─── Modale di anteprima (sola lettura) ─────────────────────────────────────
export function PreviewModal({ record, onClose, onEdit }: {
  record: InterventRecord;
  onClose: () => void;
  onEdit?: () => void;
}) {
  const fields: { label: string; value: string | null | undefined; mono?: boolean }[] = [
    { label: '🏢 Cliente', value: record.cliente },
    { label: '🚛 Targa', value: record.targa, mono: true },
    { label: '🔢 N. Telaio', value: record.telaio, mono: true },
    { label: '🔌 Seriale Centralina', value: record.seriale_centralina, mono: true },
    { label: '🚗 Tipo Veicolo', value: record.tipo_veicolo },
    { label: 'Marca Veicolo', value: record.marca_veicolo },
    { label: '📅 Anno Immatricolazione', value: record.anno_immatricolazione },
    { label: '#️⃣ N. Veicolo Aziendale', value: record.numero_veicolo },
    { label: '⏱️ Tachigrafo', value: record.marca_modello_tachigrafo },
    { label: '📡 Fornitore Servizio', value: record.fornitore_servizio },
    { label: '👤 Tecnico', value: record.tecnico },
    { label: '🔧 Lavorazione', value: record.lavorazione_eseguita },
    { label: '📝 Note', value: record.note },
  ].filter(f => f.value && String(f.value).trim().length > 0);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      backdropFilter: 'blur(6px)'
    }} onClick={onClose}>
      <div style={{
        background: 'linear-gradient(160deg, #1e293b, #0f172a)',
        borderRadius: '24px 24px 0 0', padding: '24px', width: '100%', maxWidth: '600px',
        border: '1px solid rgba(255,255,255,0.08)', maxHeight: '85vh', overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: '0'
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', margin: 0 }}>
              {record.targa || record.tipo_veicolo || 'Intervento'}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
              {new Date(record.timestamp).toLocaleString('it-IT', { dateStyle: 'long', timeStyle: 'short' })}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '1.5rem', cursor: 'pointer' }}>✕</button>
        </div>

        {/* Campi valorizzati */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
          {fields.map(({ label, value, mono }) => (
            <div key={label} style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '12px', padding: '12px 16px'
            }}>
              <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
              <span style={{ color: 'white', fontFamily: mono ? 'monospace' : 'inherit', fontSize: mono ? '0.95rem' : '1rem', letterSpacing: mono ? '0.05em' : 'normal' }}>{value}</span>
            </div>
          ))}
          {fields.length === 0 && (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '24px 0' }}>Nessun dato registrato.</p>
          )}
        </div>

        {/* Bottone modifica se onEdit è presente */}
        {onEdit && (
          <button
            onClick={() => { onClose(); onEdit(); }}
            style={{ width: '100%', padding: '14px', borderRadius: '16px', background: 'rgba(211,47,47,0.15)', border: '1px solid rgba(211,47,47,0.3)', color: 'var(--accent)', fontWeight: '600', cursor: 'pointer', fontSize: '1rem' }}
          >
            ✏️ Modifica Scheda
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Modale di modifica ───────────────────────────────────────────────────────
export function EditModal({ record, onSave, onClose }: {
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
