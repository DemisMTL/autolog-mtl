"use client";

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

// ─── Tipi ────────────────────────────────────────────────────────────────────
interface SheetRecord {
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
}

interface LocationCluster {
    locationName: string;
    lat: number;
    lng: number;
    records: SheetRecord[];
}
const VEHICLE_ICONS: { [key: string]: string } = {
    rimorchio: '/icons/trailer.png', semi: '/icons/trailer.png',
    pesante: '/icons/heavy-truck.png', camion: '/icons/heavy-truck.png', stradale: '/icons/heavy-truck.png', trattore: '/icons/heavy-truck.png',
    furgone: '/icons/van.png', commerciale: '/icons/van.png',
    terra: '/icons/earthmoving.png', escavatore: '/icons/earthmoving.png', ruspa: '/icons/earthmoving.png',
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

// ─── Algoritmo Haversine (distanza in metri tra 2 coordinate GPS) ─────────────
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Clustering GPS: raggruppa per raggio ─────────────────────────────────────
function clusterByLocation(records: SheetRecord[], radiusMeters = 500): LocationCluster[] {
    const clusters: LocationCluster[] = [];

    for (const rec of records) {
        if (rec.lat === null || rec.lng === null) {
            // Senza GPS va in "Posizione sconosciuta"
            let noGps = clusters.find(c => c.locationName === 'Posizione sconosciuta');
            if (!noGps) {
                noGps = { locationName: 'Posizione sconosciuta', lat: 0, lng: 0, records: [] };
                clusters.push(noGps);
            }
            noGps.records.push(rec);
            continue;
        }

        const nearbyCluster = clusters.find(
            c => c.lat !== 0 && haversineMeters(c.lat, c.lng, rec.lat!, rec.lng!) < radiusMeters
        );

        if (nearbyCluster) {
            nearbyCluster.records.push(rec);
        } else {
            clusters.push({ locationName: 'Rilevamento...', lat: rec.lat, lng: rec.lng, records: [rec] });
        }
    }

    return clusters;
}

// ─── Reverse geocoding via backend (Google Places → OSM fallback) ─────────────
async function reverseGeocode(lat: number, lng: number): Promise<string> {
    try {
        const res = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`);
        const data = await res.json();
        return data.name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    } catch {
        return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
}

// ─── Generazione PDF Multiplo ───────────────────────────────────────────────
async function generatePDF(clusters: LocationCluster[], dateLabel: string, clientFilter: string) {
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();

    // Filtriamo i record prima di stamparli, in base al cliente.
    // Puliamo anche i cluster rimasti senza record
    const filteredClusters = clusters.map(c => ({
        ...c,
        records: c.records.filter(r => clientFilter === 'Tutti' || r.cliente === clientFilter)
    })).filter(c => c.records.length > 0);

    const totalInterventions = filteredClusters.reduce((s, c) => s + c.records.length, 0);

    // Intestazione
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 30, 'F');
    doc.setTextColor(248, 250, 252);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(`AutoLog — Report${clientFilter !== 'Tutti' ? ` per ${clientFilter}` : ' Giornaliero'}`, 14, 14);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Data: ${dateLabel}  |  Ubicazioni: ${filteredClusters.length}  |  Totale interventi: ${totalInterventions}`, 14, 23);

    let y = 38;

    for (const cluster of filteredClusters) {
        // Titolo sezione ubicazione
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text(`📍 ${cluster.locationName}`, 14, y);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text(`${cluster.records.length} intervento/i`, 14, y + 6);
        y += 12;

        // Tabella record
        const tableData = cluster.records.map(r => [
            new Date(r.timestamp).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
            r.targa || '—',
            r.cliente || '—',
            `${r.marca_veicolo || ''} ${r.anno_immatricolazione ? `(${r.anno_immatricolazione})` : ''}`.trim() || '—',
            r.marca_modello_tachigrafo || '—',
            r.fornitore_servizio || '—',
            `${r.telaio || '—'} / ${r.seriale_centralina || '—'}`,
            r.tipo_veicolo || '—',
            r.tecnico || '—',
            r.lavorazione_eseguita || r.note || '—',
        ]);

        autoTable(doc, {
            startY: y,
            head: [['Orario', 'Targa', 'Cliente', 'Marca (Anno)', 'Tachigrafo', 'Forn/Tec', 'Telaio / SN', 'V. Tipo', 'Lavorazione']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [30, 41, 59], textColor: [248, 250, 252] },
            styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
            columnStyles: {
                0: { cellWidth: 15 },
                1: { cellWidth: 20 },
                2: { cellWidth: 20 },
                3: { cellWidth: 20 },
                4: { cellWidth: 20 },
                5: { cellWidth: 20 },
                6: { cellWidth: 35 },
                7: { cellWidth: 15 },
                8: { cellWidth: 'auto' },
            },
            margin: { left: 14, right: 14 },
        });

        y = (doc as any).lastAutoTable.finalY + 12;
        if (y > 270) {
            doc.addPage();
            y = 20;
        }
    }

    doc.save(`AutoLog_Report_${clientFilter !== 'Tutti' ? clientFilter.replace(/[^a-z0-9]/gi, '_') : 'Globale'}_${dateLabel.replace(/\//g, '-')}.pdf`);
}

// ─── Generazione CSV ──────────────────────────────────────────────────────────
function downloadCSV(clusters: LocationCluster[], clientFilter: string, dateLabel: string) {
    const header = ['Data/Ora', 'Location', 'Cliente', 'Targa', 'Marca', 'Anno Imm.', 'Tachigrafo', 'Fornitore', 'Tecnico', 'Tipo Veicolo', 'Telaio', 'SN Centralina', 'Lavorazione', 'Note'];
    let csvRows = [header.join(';')];

    for (const c of clusters) {
        for (const r of c.records) {
            if (clientFilter !== 'Tutti' && r.cliente !== clientFilter) continue;

            const row = [
                new Date(r.timestamp).toLocaleString('it-IT'),
                `"${c.locationName}"`,
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
    a.download = `AutoLog_Export_${clientFilter !== 'Tutti' ? clientFilter.replace(/[^a-z0-9]/gi, '_') : 'Globale'}_${dateLabel}.csv`;
    a.click();
}

// ─── Generazione Singola Scheda PDF ───────────────────────────────────────────
async function generateSinglePDF(record: SheetRecord, locationName: string) {
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
        if (value && value.length > 50) y += 5; // Extra spacing for multiline
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
    addRow('Ubicazione', locationName);

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
    const [clusters, setClusters] = useState<LocationCluster[]>([]);
    const [clientFilter, setClientFilter] = useState('Tutti');
    const [isLoading, setIsLoading] = useState(false);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const [isGeneratingSingle, setIsGeneratingSingle] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadReport = useCallback(async (start: string, end: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/get-records?startDate=${start}&endDate=${end}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Errore caricamento');

            const rawClusters = clusterByLocation(data.records, 500);

            // Reverse geocoding per ogni cluster
            const resolved = await Promise.all(
                rawClusters.map(async c => {
                    if (c.lat === 0 && c.lng === 0) return c;
                    const name = await reverseGeocode(c.lat, c.lng);
                    return { ...c, locationName: name };
                })
            );
            setClusters(resolved);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadReport(startDate, endDate);
    }, [startDate, endDate, loadReport]);

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
        await generatePDF(clusters, label, clientFilter);
        setIsGeneratingPDF(false);
    };

    const handleDownloadCSV = () => {
        const dateLabel = startDate === endDate ? startDate : `${startDate}_to_${endDate}`;
        downloadCSV(clusters, clientFilter, dateLabel);
    };

    const handleSinglePDF = async (rec: SheetRecord, loc: string) => {
        setIsGeneratingSingle(true);
        await generateSinglePDF(rec, loc);
        setIsGeneratingSingle(false);
    };

    const uniqueClients = Array.from(new Set(clusters.flatMap(c => c.records).map(r => r.cliente).filter(Boolean))) as string[];

    // Filtro cluster per UI
    const filteredClustersForUI = clusters.map(c => ({
        ...c,
        records: c.records.filter(r => clientFilter === 'Tutti' || r.cliente === clientFilter)
    })).filter(c => c.records.length > 0);

    const totalInterventions = filteredClustersForUI.reduce((s, c) => s + c.records.length, 0);

    return (
        <main className="app-container">
            <div className="bg-glow"></div>
            <div className="bg-glow-2"></div>

            <header className="header" style={{ marginBottom: '24px' }}>
                <div>
                    <h1>Report</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>Interventi per ubicazione</p>
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
                                onChange={e => { setStartDate(e.target.value); setClientFilter('Tutti'); }}
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
                                onChange={e => { setEndDate(e.target.value); setClientFilter('Tutti'); }}
                                style={{
                                    background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)',
                                    color: 'var(--text-primary)', borderRadius: '12px', padding: '10px 14px',
                                    fontSize: '1rem', fontFamily: 'inherit',
                                }}
                            />
                        </div>

                        {uniqueClients.length > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ fontSize: '1.2rem', color: 'var(--accent)' }}>🏢</span>
                                <select
                                    value={clientFilter}
                                    onChange={e => setClientFilter(e.target.value)}
                                    style={{
                                        background: 'rgba(211,47,47,0.1)', border: '1px solid rgba(211,47,47,0.3)',
                                        color: 'var(--text-primary)', borderRadius: '12px', padding: '10px 14px',
                                        fontSize: '0.95rem', fontFamily: 'inherit', outline: 'none'
                                    }}
                                >
                                    <option value="Tutti" style={{ color: 'black' }}>Tutti i clienti ({clusters.reduce((s, c) => s + c.records.length, 0)})</option>
                                    {uniqueClients.map((client, idx) => (
                                        <option key={idx} value={client} style={{ color: 'black' }}>{client}</option>
                                    ))}
                                </select>
                            </div>
                        )}
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
                    <p>Caricamento dati da Google Sheets...</p>
                </div>
            )}

            {/* Errore */}
            {error && (
                <div className="glass-panel" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', padding: '20px' }}>
                    <p style={{ color: '#ef4444', fontWeight: '600' }}>⚠️ {error}</p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '8px' }}>
                        Controlla di aver configurato GOOGLE_SHEET_ID e GOOGLE_SERVICE_ACCOUNT_KEY nel file .env.local
                    </p>
                </div>
            )}

            {/* Sommario */}
            {!isLoading && !error && (
                <>
                    <section style={{ display: 'flex', gap: '16px' }}>
                        <div style={{ flex: 1, background: 'rgba(0,0,0,0.25)', padding: '20px', borderRadius: '16px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.04)' }}>
                            <span style={{ display: 'block', fontSize: '2rem', fontWeight: 'bold', color: 'var(--accent)' }}>{filteredClustersForUI.length}</span>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>UBICAZIONI</span>
                        </div>
                        <div style={{ flex: 1, background: 'rgba(0,0,0,0.25)', padding: '20px', borderRadius: '16px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.04)' }}>
                            <span style={{ display: 'block', fontSize: '2rem', fontWeight: 'bold', color: 'var(--success)' }}>{totalInterventions}</span>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>INTERVENTI {clientFilter !== 'Tutti' && `(${clientFilter})`}</span>
                        </div>
                    </section>

                    {/* Lista Cluster per ubicazione */}
                    {filteredClustersForUI.length === 0 ? (
                        <div className="glass-panel" style={{ textAlign: 'center', padding: '48px 24px', opacity: 0.7 }}>
                            <span style={{ fontSize: '3rem', display: 'block', marginBottom: '16px' }}>📋</span>
                            <p style={{ color: 'var(--text-secondary)' }}>Nessun intervento registrato con i filtri attuali.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '48px' }}>
                            {filteredClustersForUI.map((cluster, idx) => (
                                <section key={idx} className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
                                    {/* Header ubicazione */}
                                    <div style={{ padding: '18px 20px', background: 'rgba(211,47,47,0.07)', borderBottom: '1px solid var(--glass-border)' }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                            <span style={{ fontSize: '1.4rem', marginTop: '2px' }}>📍</span>
                                            <div style={{ flex: 1 }}>
                                                <h2 style={{ fontSize: '1.05rem', lineHeight: '1.4' }}>{cluster.locationName}</h2>
                                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
                                                    {cluster.records.length} intervento{cluster.records.length !== 1 ? 'i' : 'o'}
                                                </p>
                                            </div>
                                            <span style={{
                                                background: 'rgba(211,47,47,0.15)', color: 'var(--accent)', padding: '4px 10px',
                                                borderRadius: '20px', fontSize: '0.8rem', fontWeight: '700'
                                            }}>
                                                #{idx + 1}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Lista veicoli */}
                                    <div style={{ padding: '12px 0' }}>
                                        {cluster.records.map((rec, rIdx) => (
                                            <div key={rIdx} style={{
                                                display: 'flex', gap: '14px', padding: '12px 20px',
                                                borderBottom: rIdx < cluster.records.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
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
                                                            {rec.cliente && (
                                                                <span style={{ fontSize: '0.85rem', color: 'var(--accent)', fontWeight: '500', marginTop: '2px' }}>
                                                                    🏢 {rec.cliente}
                                                                </span>
                                                            )}
                                                            {rec.marca_modello_tachigrafo && (
                                                                <span style={{ fontSize: '0.8rem', color: '#e57373', marginTop: '2px' }}>
                                                                    ⏱️ {rec.marca_modello_tachigrafo}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                                {new Date(rec.timestamp).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                            <button
                                                                onClick={() => handleSinglePDF(rec, cluster.locationName)}
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
                                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '6px' }}>
                                                        {rec.lavorazione_eseguita || rec.note || '—'}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            ))}
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
