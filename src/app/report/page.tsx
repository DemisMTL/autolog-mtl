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
}

interface LocationCluster {
    locationName: string;
    lat: number;
    lng: number;
    records: SheetRecord[];
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

// ─── Generazione PDF ──────────────────────────────────────────────────────────
async function generatePDF(clusters: LocationCluster[], dateLabel: string) {
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();

    // Intestazione
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 30, 'F');
    doc.setTextColor(248, 250, 252);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('AutoLog — Report Giornaliero', 14, 14);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Data: ${dateLabel}  |  Ubicazioni: ${clusters.length}  |  Totale interventi: ${clusters.reduce((s, c) => s + c.records.length, 0)}`, 14, 23);

    let y = 38;

    for (const cluster of clusters) {
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
            r.tipo_veicolo || '—',
            r.lavorazione_eseguita || r.note || '—',
        ]);

        autoTable(doc, {
            startY: y,
            head: [['Orario', 'Targa', 'Tipo Veicolo', 'Lavorazione']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [30, 41, 59], textColor: [248, 250, 252] },
            styles: { fontSize: 9, cellPadding: 3 },
            columnStyles: {
                0: { cellWidth: 20 },
                1: { cellWidth: 28 },
                2: { cellWidth: 35 },
                3: { cellWidth: 'auto' },
            },
            margin: { left: 14, right: 14 },
        });

        y = (doc as any).lastAutoTable.finalY + 12;
        if (y > 270) {
            doc.addPage();
            y = 20;
        }
    }

    doc.save(`AutoLog_Report_${dateLabel.replace(/\//g, '-')}.pdf`);
}

// ─── Componente principale ────────────────────────────────────────────────────
export default function ReportPage() {
    const today = new Date().toISOString().split('T')[0];
    const [selectedDate, setSelectedDate] = useState(today);
    const [clusters, setClusters] = useState<LocationCluster[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadReport = useCallback(async (date: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/get-records?date=${date}`);
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
        loadReport(selectedDate);
    }, [selectedDate, loadReport]);

    const handleDownloadPDF = async () => {
        setIsGeneratingPDF(true);
        const label = new Date(selectedDate + 'T12:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
        await generatePDF(clusters, label);
        setIsGeneratingPDF(false);
    };

    const totalInterventions = clusters.reduce((s, c) => s + c.records.length, 0);

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

            {/* Selettore Data */}
            <section className="glass-panel" style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '1.3rem' }}>📅</span>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={e => setSelectedDate(e.target.value)}
                            style={{
                                background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)',
                                color: 'var(--text-primary)', borderRadius: '12px', padding: '10px 14px',
                                fontSize: '1rem', fontFamily: 'inherit',
                            }}
                        />
                    </div>
                    {totalInterventions > 0 && (
                        <button
                            onClick={handleDownloadPDF}
                            disabled={isGeneratingPDF}
                            className="btn-primary"
                            style={{ padding: '10px 20px', fontSize: '1rem', borderRadius: '14px', gap: '8px' }}
                        >
                            {isGeneratingPDF ? '⏳ Generando...' : '⬇️ Scarica PDF'}
                        </button>
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
                            <span style={{ display: 'block', fontSize: '2rem', fontWeight: 'bold', color: 'var(--accent)' }}>{clusters.length}</span>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>UBICAZIONI</span>
                        </div>
                        <div style={{ flex: 1, background: 'rgba(0,0,0,0.25)', padding: '20px', borderRadius: '16px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.04)' }}>
                            <span style={{ display: 'block', fontSize: '2rem', fontWeight: 'bold', color: 'var(--success)' }}>{totalInterventions}</span>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>INTERVENTI</span>
                        </div>
                    </section>

                    {/* Lista Cluster per ubicazione */}
                    {clusters.length === 0 ? (
                        <div className="glass-panel" style={{ textAlign: 'center', padding: '48px 24px', opacity: 0.7 }}>
                            <span style={{ fontSize: '3rem', display: 'block', marginBottom: '16px' }}>📋</span>
                            <p style={{ color: 'var(--text-secondary)' }}>Nessun intervento registrato per questa data.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '48px' }}>
                            {clusters.map((cluster, idx) => (
                                <section key={idx} className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
                                    {/* Header ubicazione */}
                                    <div style={{ padding: '18px 20px', background: 'rgba(56,189,248,0.07)', borderBottom: '1px solid var(--glass-border)' }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                            <span style={{ fontSize: '1.4rem', marginTop: '2px' }}>📍</span>
                                            <div style={{ flex: 1 }}>
                                                <h2 style={{ fontSize: '1.05rem', lineHeight: '1.4' }}>{cluster.locationName}</h2>
                                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
                                                    {cluster.records.length} intervento{cluster.records.length !== 1 ? 'i' : 'o'}
                                                </p>
                                            </div>
                                            <span style={{
                                                background: 'rgba(56,189,248,0.15)', color: 'var(--accent)', padding: '4px 10px',
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
                                                <span style={{ fontSize: '1.4rem', lineHeight: '1' }}>🚗</span>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                        <span style={{ fontWeight: '700', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                                                            {rec.targa || rec.tipo_veicolo || 'Veicolo'}
                                                        </span>
                                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                            {new Date(rec.timestamp).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
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
