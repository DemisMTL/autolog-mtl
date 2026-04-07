"use client";

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { InterventRecord } from '@/types';
import { PreviewModal } from '@/components/Modals';

// ─── Tipi ────────────────────────────────────────────────────────────────────
interface ClientGroup {
    clientName: string;
    records: InterventRecord[];
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

// ─── Raggruppa record per cliente ─────────────────────────────────────────────
function groupByClient(records: InterventRecord[]): ClientGroup[] {
    const map = new Map<string, InterventRecord[]>();
    for (const rec of records) {
        const key = rec.cliente || 'Cliente sconosciuto';
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(rec);
    }
    return Array.from(map.entries())
        .map(([clientName, records]) => ({ clientName, records }))
        .sort((a, b) => b.records.length - a.records.length); // più interventi prima
}

// ─── Generazione PDF unica tabella flat ───────────────────────────────────────
async function generatePDF(groups: ClientGroup[], dateLabel: string, reportLabel: string) {
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();

    const allRecords = groups.flatMap(g => g.records)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Intestazione
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 30, 'F');
    doc.setTextColor(248, 250, 252);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(`AutoLog — Report${reportLabel !== 'Tutti' ? ` — ${reportLabel}` : ' Completo'}`, 14, 14);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Periodo: ${dateLabel}  |  Totale interventi: ${allRecords.length}`, 14, 23);

    const tableData = allRecords.map(r => [
        new Date(r.timestamp).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        r.targa || '—',
        r.cliente || '—',
        r.tipo_lavorazione || '—',
        `${r.marca_veicolo || ''} ${r.anno_immatricolazione ? `(${r.anno_immatricolazione})` : ''}`.trim() || '—',
        r.marca_modello_tachigrafo || '—',
        r.fornitore_servizio || '—',
        `${r.telaio || '—'} / ${r.seriale_centralina || '—'}`,
        r.lavorazione_eseguita || r.note || '—',
    ]);

    autoTable(doc, {
        startY: 38,
        head: [['Data', 'Targa', 'Cliente', 'Tipo Lav.', 'Marca (Anno)', 'Tachigrafo', 'Fornitore', 'Telaio / SN', 'Descrizione']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [30, 41, 59], textColor: [248, 250, 252] },
        styles: { fontSize: 7.5, cellPadding: 2, overflow: 'linebreak' },
        columnStyles: {
            0: { cellWidth: 22 },
            1: { cellWidth: 20 },
            2: { cellWidth: 28 },
            3: { cellWidth: 24 },
            4: { cellWidth: 24 },
            5: { cellWidth: 22 },
            6: { cellWidth: 20 },
            7: { cellWidth: 36 },
            8: { cellWidth: 'auto' },
        },
        margin: { left: 14, right: 14 },
    });

    const safeLabel = reportLabel !== 'Tutti' ? reportLabel.replace(/[^a-z0-9]/gi, '_') : 'Globale';
    doc.save(`AutoLog_Report_${safeLabel}_${dateLabel.replace(/\//g, '-')}.pdf`);
}

// ─── Generazione CSV ──────────────────────────────────────────────────────────
function downloadCSV(groups: ClientGroup[], dateLabel: string) {
    const header = ['Data/Ora', 'Cliente', 'Targa', 'Marca', 'Anno Imm.', 'Tachigrafo', 'Fornitore', 'Tecnico', 'Tipo Veicolo', 'Telaio', 'SN Centralina', 'Lavorazione', 'Note'];
    let csvRows = [header.join(';')];

    for (const g of groups) {
        for (const r of g.records) {
            const row = [
                new Date(r.timestamp).toLocaleString('it-IT'),
                `"${r.cliente || ''}"`,
                `"${r.targa || ''}"`,
                `"${r.marca_veicolo || ''}"`,
                `"${r.anno_immatricolazione || ''}"`,
                `"${r.marca_modello_tachigrafo || ''}"`,
                `"${r.fornitore_servizio || ''}"`,
                `"${r.tecnico || ''}"`,
                `"${r.tipo_veicolo || ''}"`,
                `"${r.telaio || ''}"`,
                `"${r.seriale_centralina || ''}"`,
                `"${(r.lavorazione_eseguita || '').replace(/"/g, '""')}"`,
                `"${(r.note || '').replace(/"/g, '""')}"`
            ];
            csvRows.push(row.join(';'));
        }
    }

    const csvData = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const csvUrl = URL.createObjectURL(csvData);
    const a = document.createElement('a');
    a.href = csvUrl;
    a.download = `AutoLog_Export_${dateLabel}.csv`;
    a.click();
}

// ─── Generazione Singola Scheda PDF ───────────────────────────────────────────
async function generateSinglePDF(record: InterventRecord) {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, doc.internal.pageSize.getWidth(), 30, 'F');
    doc.setTextColor(248, 250, 252);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('AutoLog — Scheda Intervento Singola', 14, 15);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Registrato il: ${new Date(record.timestamp).toLocaleString('it-IT')}`, 14, 23);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(14);

    let y = 45;
    const addRow = (label: string, value: string) => {
        doc.setFont('helvetica', 'bold');
        doc.text(`${label}:`, 14, y);
        doc.setFont('helvetica', 'normal');
        doc.text(value || 'N/A', 55, y, { maxWidth: 140 });
        y += 10;
        if (value && value.length > 50) y += 5;
    };

    addRow('Cliente', record.cliente || '');
    addRow('Targa', record.targa || '');
    if (record.numero_veicolo) addRow('Numero Flotta', record.numero_veicolo);
    addRow('Marca / Anno', `${record.marca_veicolo || ''} ${record.anno_immatricolazione ? `(${record.anno_immatricolazione})` : ''}`.trim());
    if (record.marca_modello_tachigrafo) addRow('Tachigrafo Info', record.marca_modello_tachigrafo);
    if (record.fornitore_servizio) addRow('Fornitore', record.fornitore_servizio);
    if (record.tecnico) addRow('Eseguito da', record.tecnico);
    addRow('Tipo Veicolo', record.tipo_veicolo || '');
    addRow('Telaio', record.telaio || '');
    addRow('S/N Apparato', record.seriale_centralina || '');

    y += 5;
    doc.line(14, y, doc.internal.pageSize.getWidth() - 14, y);
    y += 10;

    doc.setFont('helvetica', 'bold');
    doc.text('Lavorazione Eseguita:', 14, y);
    doc.setFont('helvetica', 'normal');
    y += 7;
    doc.text(record.lavorazione_eseguita || '—', 14, y, { maxWidth: 180 });

    y += 20;
    doc.setFont('helvetica', 'bold');
    doc.text('Note aggiuntive:', 14, y);
    doc.setFont('helvetica', 'normal');
    y += 7;
    doc.text(record.note || '—', 14, y, { maxWidth: 180 });

    doc.save(`Scheda_${record.targa || 'Veicolo'}_${new Date(record.timestamp).getTime()}.pdf`);
}

// ─── Componente principale ────────────────────────────────────────────────────
export default function ReportPage() {
    const today = new Date().toISOString().split('T')[0];
    const [startDate, setStartDate] = useState(today);
    const [endDate, setEndDate] = useState(today);
    const [allRecords, setAllRecords] = useState<InterventRecord[]>([]);
    const [filterMode, setFilterMode] = useState<'cliente' | 'fornitore'>('cliente');
    const [clientFilter, setClientFilter] = useState('Tutti');
    const [providerFilter, setProviderFilter] = useState('Tutti');
    const [isLoading, setIsLoading] = useState(false);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const [isGeneratingSingle, setIsGeneratingSingle] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
    const [previewRecord, setPreviewRecord] = useState<InterventRecord | null>(null);

    const toggleClient = (clientName: string) => {
        setExpandedClients(prev => {
            const next = new Set(prev);
            if (next.has(clientName)) next.delete(clientName);
            else next.add(clientName);
            return next;
        });
    };

    const expandAll = () => setExpandedClients(new Set(clientGroups.map(g => g.clientName)));
    const collapseAll = () => setExpandedClients(new Set());

    const loadReport = useCallback(async (start: string, end: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/get-records?startDate=${start}&endDate=${end}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Errore caricamento');
            setAllRecords(data.records || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadReport(startDate, endDate);
    }, [startDate, endDate, loadReport]);

    // Filtra record in base al filtro attivo
    const filteredRecords = allRecords.filter(r => {
        if (filterMode === 'cliente') return clientFilter === 'Tutti' || r.cliente === clientFilter;
        return providerFilter === 'Tutti' || r.fornitore_servizio === providerFilter;
    });

    // Raggruppa per cliente
    const clientGroups = groupByClient(filteredRecords);

    const uniqueClients = Array.from(new Set(allRecords.map(r => r.cliente).filter(Boolean))) as string[];
    const uniqueProviders = Array.from(new Set(allRecords.map(r => r.fornitore_servizio).filter(Boolean))) as string[];

    const totalInterventions = filteredRecords.length;

    const handleDownloadPDF = async () => {
        setIsGeneratingPDF(true);
        let label = '';
        if (startDate === endDate) {
            label = new Date(startDate + 'T12:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } else {
            const startStr = new Date(startDate + 'T12:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const endStr = new Date(endDate + 'T12:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
            label = `dal ${startStr} al ${endStr}`;
        }
        const displayLabel = filterMode === 'cliente' ? clientFilter : (providerFilter !== 'Tutti' ? providerFilter : 'Tutti');
        await generatePDF(clientGroups, label, displayLabel);
        setIsGeneratingPDF(false);
    };

    const handleDownloadCSV = () => {
        const dateLabel = startDate === endDate ? startDate : `${startDate}_to_${endDate}`;
        downloadCSV(clientGroups, dateLabel);
    };

    const handleSinglePDF = async (rec: InterventRecord) => {
        setIsGeneratingSingle(true);
        await generateSinglePDF(rec);
        setIsGeneratingSingle(false);
    };

    return (
        <main className="app-container">
            <div className="bg-glow"></div>
            <div className="bg-glow-2"></div>
            
            {previewRecord && (
                <PreviewModal record={previewRecord} onClose={() => setPreviewRecord(null)} />
            )}

            <header className="header" style={{ marginBottom: '24px' }}>
                <div>
                    <h1>Report</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>Interventi per cliente</p>
                </div>
                <Link href="/" style={{ color: 'var(--text-secondary)', textDecoration: 'none', background: 'rgba(255,255,255,0.08)', padding: '8px 14px', borderRadius: '12px', fontSize: '0.95rem' }}>
                    ← Home
                </Link>
            </header>

            {/* Filtri */}
            <section className="glass-panel" style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '1.3rem', marginRight: '4px' }}>📅 Da:</span>
                            <input
                                type="date"
                                value={startDate}
                                onChange={e => { setStartDate(e.target.value); setClientFilter('Tutti'); setProviderFilter('Tutti'); }}
                                style={{
                                    background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)',
                                    color: 'var(--text-primary)', borderRadius: '12px', padding: '10px 14px',
                                    fontSize: '1rem', fontFamily: 'inherit',
                                }}
                            />
                            <span style={{ fontSize: '1.1rem', margin: '0 4px' }}>A:</span>
                            <input
                                type="date"
                                value={endDate}
                                min={startDate}
                                onChange={e => { setEndDate(e.target.value); setClientFilter('Tutti'); setProviderFilter('Tutti'); }}
                                style={{
                                    background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)',
                                    color: 'var(--text-primary)', borderRadius: '12px', padding: '10px 14px',
                                    fontSize: '1rem', fontFamily: 'inherit',
                                }}
                            />
                        </div>

                        {/* Toggle Cliente / Fornitore + Filtro */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '3px', border: '1px solid rgba(255,255,255,0.07)' }}>
                                <button
                                    onClick={() => setFilterMode('cliente')}
                                    style={{
                                        padding: '7px 14px', borderRadius: '9px', border: 'none', cursor: 'pointer',
                                        fontWeight: '600', fontSize: '0.88rem', transition: 'all 0.2s',
                                        background: filterMode === 'cliente' ? 'rgba(211,47,47,0.3)' : 'transparent',
                                        color: filterMode === 'cliente' ? 'var(--accent)' : 'var(--text-secondary)',
                                    }}
                                >🏢 Cliente</button>
                                <button
                                    onClick={() => setFilterMode('fornitore')}
                                    style={{
                                        padding: '7px 14px', borderRadius: '9px', border: 'none', cursor: 'pointer',
                                        fontWeight: '600', fontSize: '0.88rem', transition: 'all 0.2s',
                                        background: filterMode === 'fornitore' ? 'rgba(99,102,241,0.3)' : 'transparent',
                                        color: filterMode === 'fornitore' ? '#a5b4fc' : 'var(--text-secondary)',
                                    }}
                                >📡 Fornitore</button>
                            </div>

                            {filterMode === 'cliente' && uniqueClients.length > 0 && (
                                <select
                                    value={clientFilter}
                                    onChange={e => setClientFilter(e.target.value)}
                                    style={{
                                        background: 'rgba(211,47,47,0.1)', border: '1px solid rgba(211,47,47,0.3)',
                                        color: 'var(--text-primary)', borderRadius: '12px', padding: '10px 14px',
                                        fontSize: '0.95rem', fontFamily: 'inherit', outline: 'none'
                                    }}
                                >
                                    <option value="Tutti" style={{ color: 'black' }}>Tutti i clienti ({allRecords.length})</option>
                                    {uniqueClients.map((client, idx) => (
                                        <option key={idx} value={client} style={{ color: 'black' }}>{client}</option>
                                    ))}
                                </select>
                            )}

                            {filterMode === 'fornitore' && uniqueProviders.length > 0 && (
                                <select
                                    value={providerFilter}
                                    onChange={e => setProviderFilter(e.target.value)}
                                    style={{
                                        background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)',
                                        color: 'var(--text-primary)', borderRadius: '12px', padding: '10px 14px',
                                        fontSize: '0.95rem', fontFamily: 'inherit', outline: 'none'
                                    }}
                                >
                                    <option value="Tutti" style={{ color: 'black' }}>Tutti i fornitori ({allRecords.length})</option>
                                    {uniqueProviders.map((p, idx) => (
                                        <option key={idx} value={p} style={{ color: 'black' }}>{p}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                    </div>

                    {totalInterventions > 0 && (
                        <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px', flexWrap: 'wrap' }}>
                            <button
                                onClick={handleDownloadPDF}
                                disabled={isGeneratingPDF}
                                className="btn-primary"
                                style={{ padding: '10px 20px', fontSize: '0.95rem', borderRadius: '14px', gap: '8px', flex: '1 1 auto', justifyContent: 'center' }}
                            >
                                {isGeneratingPDF ? '⏳ Generando PDF...' : `📄 Scarica Report ${clientFilter !== 'Tutti' ? 'Cliente' : (startDate === endDate ? 'Giornaliero' : 'Periodico')}`}
                            </button>
                            <button
                                onClick={handleDownloadCSV}
                                style={{ padding: '10px 20px', fontSize: '0.95rem', borderRadius: '14px', gap: '8px', cursor: 'pointer', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80', fontWeight: 'bold', display: 'flex', alignItems: 'center', flex: '1 1 auto', justifyContent: 'center' }}
                            >
                                📊 Scarica CSV (Excel)
                            </button>
                        </div>
                    )}
                </div>
            </section>

            {/* Stato di caricamento */}
            {isLoading && (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
                    <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '12px' }} className="recording-pulse">⏳</span>
                    <p>Caricamento dati...</p>
                </div>
            )}

            {/* Errore */}
            {error && (
                <div className="glass-panel" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', padding: '20px' }}>
                    <p style={{ color: '#ef4444', fontWeight: '600' }}>⚠️ {error}</p>
                </div>
            )}

            {/* Sommario + Controlli Accordion */}
            {!isLoading && !error && (
                <>
                    <section style={{ display: 'flex', gap: '16px' }}>
                        <div style={{ flex: 1, background: 'rgba(0,0,0,0.25)', padding: '20px', borderRadius: '16px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.04)' }}>
                            <span style={{ display: 'block', fontSize: '2rem', fontWeight: 'bold', color: 'var(--accent)' }}>{clientGroups.length}</span>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>CLIENTI</span>
                        </div>
                        <div style={{ flex: 1, background: 'rgba(0,0,0,0.25)', padding: '20px', borderRadius: '16px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.04)' }}>
                            <span style={{ display: 'block', fontSize: '2rem', fontWeight: 'bold', color: 'var(--success)' }}>{totalInterventions}</span>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>INTERVENTI</span>
                        </div>
                    </section>

                    {/* Espandi/Comprimi tutti */}
                    {clientGroups.length > 0 && (
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={expandAll}
                                style={{
                                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                                    color: 'var(--text-secondary)', padding: '6px 14px', borderRadius: '10px',
                                    fontSize: '0.82rem', cursor: 'pointer', transition: 'all 0.2s'
                                }}
                            >▼ Espandi tutti</button>
                            <button
                                onClick={collapseAll}
                                style={{
                                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                                    color: 'var(--text-secondary)', padding: '6px 14px', borderRadius: '10px',
                                    fontSize: '0.82rem', cursor: 'pointer', transition: 'all 0.2s'
                                }}
                            >▲ Comprimi tutti</button>
                        </div>
                    )}

                    {/* Lista per Cliente (Accordion) */}
                    {clientGroups.length === 0 ? (
                        <div className="glass-panel" style={{ textAlign: 'center', padding: '48px 24px', opacity: 0.7 }}>
                            <span style={{ fontSize: '3rem', display: 'block', marginBottom: '16px' }}>📋</span>
                            <p style={{ color: 'var(--text-secondary)' }}>Nessun intervento registrato con i filtri attuali.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '48px' }}>
                            {clientGroups.map((group, idx) => {
                                const isExpanded = expandedClients.has(group.clientName);
                                return (
                                    <section key={idx} className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
                                        {/* Header cliente — cliccabile per aprire/chiudere */}
                                        <button
                                            onClick={() => toggleClient(group.clientName)}
                                            style={{
                                                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                padding: '16px 20px', background: isExpanded ? 'rgba(211,47,47,0.1)' : 'rgba(211,47,47,0.04)',
                                                borderBottom: isExpanded ? '1px solid var(--glass-border)' : 'none',
                                                border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 0.2s',
                                                fontFamily: 'inherit',
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <span style={{
                                                    fontSize: '1.1rem', transition: 'transform 0.3s',
                                                    transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                                    display: 'inline-block'
                                                }}>▶</span>
                                                <div>
                                                    <h2 style={{ fontSize: '1.05rem', lineHeight: '1.4', color: 'var(--text-primary)', margin: 0 }}>
                                                        🏢 {group.clientName}
                                                    </h2>
                                                </div>
                                            </div>
                                            <span style={{
                                                background: 'rgba(211,47,47,0.15)', color: 'var(--accent)', padding: '4px 12px',
                                                borderRadius: '20px', fontSize: '0.85rem', fontWeight: '700', whiteSpace: 'nowrap'
                                            }}>
                                                {group.records.length} intervento{group.records.length !== 1 ? 'i' : 'o'}
                                            </span>
                                        </button>

                                        {/* Lista veicoli (accordion body) */}
                                        {isExpanded && (
                                            <div style={{ padding: '12px 0' }}>
                                                {group.records.map((rec, rIdx) => (
                                                    <div key={rIdx} style={{
                                                        display: 'flex', gap: '14px', padding: '12px 20px',
                                                        borderBottom: rIdx < group.records.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                                                        alignItems: 'flex-start'
                                                    }}>
                                                        <div style={{ width: '72px', height: '72px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#2a2a2a', borderRadius: '12px', padding: '6px' }}>
                                                            <img style={{ width: '100%', height: '100%', objectFit: 'contain' }} src={getVehicleIcon(rec.tipo_veicolo)} alt="Veicolo" />
                                                        </div>
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
                                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                                    <span style={{ fontWeight: '700', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                                                                        {rec.targa || rec.tipo_veicolo || 'Veicolo'}
                                                                    </span>
                                                                    {rec.marca_modello_tachigrafo && (
                                                                        <span style={{ fontSize: '0.8rem', color: '#e57373', marginTop: '2px' }}>
                                                                            ⏱️ {rec.marca_modello_tachigrafo}
                                                                        </span>
                                                                    )}
                                                                    {rec.fornitore_servizio && (
                                                                        <span style={{ fontSize: '0.8rem', color: '#a5b4fc', marginTop: '2px' }}>
                                                                            📡 {rec.fornitore_servizio}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                                        {new Date(rec.timestamp).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })} {new Date(rec.timestamp).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                                                                    </span>
                                                                    {rec.is_matched && <div style={{ fontSize: '1.2rem', marginBottom: '2px' }} title="Matchato con Ticket">✅</div>}
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                        <button
                                                                            onClick={() => setPreviewRecord(rec)}
                                                                            style={{
                                                                                background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                                                                                color: '#fff', padding: '4px 8px', borderRadius: '8px', fontSize: '0.9rem',
                                                                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                                            }}
                                                                            title="Anteprima rapida"
                                                                        >
                                                                            👁️
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleSinglePDF(rec)}
                                                                            disabled={isGeneratingSingle}
                                                                            style={{
                                                                                background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                                                                                color: '#fff', padding: '4px 8px', borderRadius: '8px', fontSize: '0.75rem',
                                                                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                                                                            }}
                                                                        >
                                                                            ⬇️ Scheda
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '6px' }}>
                                                                {rec.lavorazione_eseguita || rec.note || '—'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </section>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            <style dangerouslySetInnerHTML={{
                __html: `
        @keyframes pulse {
          0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; }
        }
        .recording-pulse { animation: pulse 1.5s infinite; }
      `}} />
        </main>
    );
}
