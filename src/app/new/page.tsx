"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function NewRecord() {
    const router = useRouter();
    const [isRecording, setIsRecording] = useState(false);
    const [noteText, setNoteText] = useState("");
    const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [reviewData, setReviewData] = useState<any>(null);

    // Riferimento all'istanza
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        // GPS
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition((pos) => {
                setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            }, (err) => console.log("GPS non autorizzato", err));
        }
    }, []);

    // Inizializza o recupera l'istanza di SpeechRecognition
    const getRecognition = useCallback(() => {
        if (recognitionRef.current) return recognitionRef.current;

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Il tuo browser non supporta la dettatura vocale.");
            return null;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        // Su mobile a volte interimResults crea blocchi o loop, lo settiamo a false per maggior stabilità
        recognition.interimResults = false;
        recognition.lang = 'it-IT';

        recognition.onresult = (event: any) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript + ' ';
                }
            }
            if (finalTranscript) {
                setNoteText((prev) => prev + finalTranscript);
            }
        };

        recognition.onerror = (event: any) => {
            console.error('Speech recognition error', event.error);
            setIsRecording(false);
            if (event.error !== 'no-speech') {
                alert("Errore microfono: " + event.error);
            }
        };

        recognition.onend = () => {
            setIsRecording(false);
        };

        recognitionRef.current = recognition;
        return recognition;
    }, []);


    const handleToggleRecord = () => {
        const recognition = getRecognition();
        if (!recognition) return;

        if (isRecording) {
            recognition.stop();
            setIsRecording(false);
        } else {
            try {
                recognition.start();
                setIsRecording(true);
            } catch (err) {
                console.error("Errore avvio registrazione", err);
                setIsRecording(false);
            }
        }
    };

    const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (ev) => {
                setPhotoPreview(ev.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleAnalyze = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!photoPreview) {
            alert("Scatta prima una foto del veicolo!");
            return;
        }

        setIsAnalyzing(true);
        try {
            const res = await fetch("/api/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    imageBase64: photoPreview,
                    notes: noteText
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Errore API backend");
            }

            setReviewData(data.data);

        } catch (err: any) {
            alert("⚠️ Errore IA:\n" + err.message + "\n\nAssicurati che: \n1. Il file .env.local contenga la chiave esatta\n2. Di aver RIAVVIATO il server inserita la chiave.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleFinalSave = async () => {
        const newRecord = {
            id: Date.now().toString(),
            targa: reviewData?.targa || null,
            tipo_veicolo: reviewData?.tipo_veicolo || null,
            numero_veicolo: reviewData?.numero_veicolo || null,
            lavorazione_eseguita: reviewData?.lavorazione_eseguita || null,
            note: noteText,
            location: location,
            timestamp: new Date().toISOString(),
        };

        // 1. Salvataggio locale (sempre, anche offline)
        const existing = localStorage.getItem('autolog_records');
        const records = existing ? JSON.parse(existing) : [];
        records.push(newRecord);
        localStorage.setItem('autolog_records', JSON.stringify(records));

        // 2. Salvataggio cloud su Google Sheets (in background, non blocca)
        try {
            await fetch('/api/save-record', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newRecord),
            });
        } catch (cloudErr) {
            console.warn('Salvataggio cloud fallito (sarà ritentato al prossimo avvio):', cloudErr);
        }

        router.push('/');
    };


    // ------------------------------------------------------------------------
    // SCHERMATA DI REVIEW
    // ------------------------------------------------------------------------
    if (reviewData) {
        return (
            <main className="app-container">
                <div className="bg-glow"></div>
                <header className="header" style={{ marginBottom: '24px' }}>
                    <h1 style={{ fontSize: '1.4rem' }}>Revisione Dati IA</h1>
                </header>

                <section className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                        Controlla e correggi i dati estratti prima di salvarli nel Cloud.
                    </p>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--accent)', marginBottom: '8px' }}>Targa Veicolo</label>
                        <input
                            type="text"
                            value={reviewData.targa || ""}
                            onChange={e => setReviewData({ ...reviewData, targa: e.target.value })}
                            style={{ width: '100%', padding: '12px', borderRadius: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', color: 'white', fontSize: '1.1rem', textTransform: 'uppercase' }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--accent)', marginBottom: '8px' }}>Tipo Veicolo</label>
                        <input
                            type="text"
                            value={reviewData.tipo_veicolo || ""}
                            onChange={e => setReviewData({ ...reviewData, tipo_veicolo: e.target.value })}
                            style={{ width: '100%', padding: '12px', borderRadius: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', color: 'white', fontSize: '1.1rem' }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--accent)', marginBottom: '8px' }}>Numero Veicolo Aziendale</label>
                        <input
                            type="text"
                            placeholder="Es. Furgone 3 o Nessuno"
                            value={reviewData.numero_veicolo || ""}
                            onChange={e => setReviewData({ ...reviewData, numero_veicolo: e.target.value })}
                            style={{ width: '100%', padding: '12px', borderRadius: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', color: 'white', fontSize: '1.1rem' }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--accent)', marginBottom: '8px' }}>Lavorazione Eseguita</label>
                        <textarea
                            value={reviewData.lavorazione_eseguita || ""}
                            onChange={e => setReviewData({ ...reviewData, lavorazione_eseguita: e.target.value })}
                            style={{ width: '100%', padding: '12px', borderRadius: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', color: 'white', fontSize: '1rem', minHeight: '100px', resize: 'vertical', fontFamily: 'inherit' }}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                        <button
                            onClick={() => setReviewData(null)}
                            style={{ flex: 1, padding: '14px', borderRadius: '16px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', fontWeight: '600', cursor: 'pointer' }}
                        >
                            Rifai Analisi
                        </button>
                        <button
                            onClick={handleFinalSave}
                            className="btn-primary"
                            style={{ flex: 2, padding: '14px', borderRadius: '16px' }}
                        >
                            Salva Intervento
                        </button>
                    </div>
                </section>
            </main>
        );
    }

    // ------------------------------------------------------------------------
    // SCHERMATA FORM INIZIALE
    // ------------------------------------------------------------------------
    return (
        <main className="app-container">
            <div className="bg-glow"></div>

            <header className="header" style={{ marginBottom: '24px' }}>
                <Link href="/" style={{ color: 'var(--text-primary)', textDecoration: 'none', fontSize: '1.2rem', background: 'rgba(255,255,255,0.1)', padding: '8px 16px', borderRadius: '12px' }}>
                    ← Indietro
                </Link>
                <h1 style={{ fontSize: '1.4rem' }}>Nuovo Intervento</h1>
                <div style={{ width: '40px' }}></div> {/* Spacer */}
            </header>

            <form onSubmit={handleAnalyze} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                {/* Foto Section */}
                <section className="glass-panel" style={{ padding: '20px' }}>
                    <h2 style={{ fontSize: '1.1rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>📷</span> Acquisizione Foto
                    </h2>

                    {/* Anteprima */}
                    <div style={{ position: 'relative', width: '100%', height: photoPreview ? 'auto' : '160px', background: 'rgba(0,0,0,0.3)', borderRadius: '16px', border: '2px dashed var(--glass-border)', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', marginBottom: '16px' }}>
                        {photoPreview ? (
                            <img src={photoPreview} alt="Anteprima" style={{ width: '100%', height: 'auto', display: 'block' }} />
                        ) : (
                            <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                                <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '8px', opacity: 0.8 }}>📸</span>
                                <p>Nessuna foto selezionata</p>
                            </div>
                        )}
                    </div>

                    {/* Due bottoni: Fotocamera e Libreria */}
                    <div style={{ display: 'flex', gap: '12px' }}>
                        {/* Scatta foto */}
                        <label style={{ flex: 1 }}>
                            <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={handlePhotoCapture}
                                style={{ display: 'none' }}
                            />
                            <span style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                padding: '14px', borderRadius: '16px',
                                background: 'linear-gradient(135deg, rgba(14,165,233,0.25), rgba(59,130,246,0.2))',
                                border: '1px solid rgba(56,189,248,0.3)',
                                color: 'var(--accent)', fontWeight: '600', cursor: 'pointer',
                                fontSize: '1rem', userSelect: 'none'
                            }}>
                                📷 Fotocamera
                            </span>
                        </label>

                        {/* Scegli dalla libreria */}
                        <label style={{ flex: 1 }}>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handlePhotoCapture}
                                style={{ display: 'none' }}
                            />
                            <span style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                padding: '14px', borderRadius: '16px',
                                background: 'rgba(255,255,255,0.06)',
                                border: '1px solid var(--glass-border)',
                                color: 'var(--text-secondary)', fontWeight: '600', cursor: 'pointer',
                                fontSize: '1rem', userSelect: 'none'
                            }}>
                                🖼 Libreria
                            </span>
                        </label>
                    </div>
                </section>


                {/* Note e Dettatura */}
                <section className="glass-panel" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h2 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>📝</span> Appunti
                        </h2>
                        <button
                            type="button"
                            onClick={handleToggleRecord}
                            disabled={isAnalyzing}
                            style={{
                                background: isRecording ? 'var(--danger)' : 'rgba(56, 189, 248, 0.2)',
                                color: isRecording ? '#fff' : 'var(--accent)',
                                border: '1px solid ' + (isRecording ? 'transparent' : 'rgba(56, 189, 248, 0.3)'),
                                padding: '10px 16px',
                                borderRadius: '20px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                fontWeight: '600'
                            }}
                        >
                            <span className={isRecording ? "recording-pulse" : ""} style={{ display: 'inline-block' }}>
                                {isRecording ? '🔴' : '🎙'}
                            </span>
                            {isRecording ? 'In ascolto...' : 'Detta'}
                        </button>
                    </div>
                    <textarea
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Descrivi la lavorazione eseguita... (oppure usa la voce e attendi la fine per leggere il testo)"
                        style={{
                            width: '100%',
                            minHeight: '120px',
                            background: 'rgba(0,0,0,0.25)',
                            border: '1px solid var(--glass-border)',
                            borderRadius: '16px',
                            padding: '16px',
                            color: 'var(--text-primary)',
                            fontSize: '1.05rem',
                            resize: 'vertical',
                            fontFamily: 'inherit'
                        }}
                    />
                </section>

                {/* Info Extra */}
                <section className="glass-panel" style={{ padding: '16px 20px', background: 'rgba(56, 189, 248, 0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span>📍</span> GPS:</span>
                        <span style={{ fontFamily: 'monospace' }}>
                            {location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : "Rilevamento in corso..."}
                        </span>
                    </div>
                </section>

                <button
                    type="submit"
                    disabled={isAnalyzing}
                    className="btn-primary"
                    style={{
                        marginTop: '8px', padding: '18px', fontSize: '1.2rem', borderRadius: '20px',
                        opacity: isAnalyzing ? 0.7 : 1, cursor: isAnalyzing ? 'wait' : 'pointer',
                        justifyContent: 'center'
                    }}
                >
                    {isAnalyzing ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="recording-pulse">⏳</span> Analisi IA Multi-Modale...
                        </span>
                    ) : (
                        <>
                            <span style={{ fontSize: '1.4rem' }}>✨</span> Analizza e Ricava Dati
                        </>
                    )}
                </button>

            </form>

            <style dangerouslySetInnerHTML={{
                __html: `
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.2); opacity: 0.8; }
          100% { transform: scale(1); opacity: 1; }
        }
        .recording-pulse {
          animation: pulse 1.5s infinite;
        }
      `}} />
        </main>
    );
}
