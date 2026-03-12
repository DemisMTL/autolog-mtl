import { NextRequest, NextResponse } from "next/server";
import { getDb, ensureTable } from '@/lib/db';

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Chiama la REST API Gemini direttamente su v1 (non v1beta che ha modelli deprecati)
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent";

export async function POST(req: NextRequest) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: "Chiave API Gemini (GEMINI_API_KEY) mancante sul server." },
                { status: 500 }
            );
        }

        const body = await req.json();
        const rawImages: string[] = body.imagesBase64 ?? (body.imageBase64 ? [body.imageBase64] : []);
        const notes: string = body.notes || "";
        const location: { lat: number, lng: number } | null = body.location || null;

        if (rawImages.length === 0) {
            return NextResponse.json({ error: "Nessuna immagine fornita." }, { status: 400 });
        }

        // 1. Controllo Continuità Cliente (raggio 200m dallo stesso giorno)
        let clienteBloccato: string | null = null;
        if (location) {
            try {
                await ensureTable();
                const sql = getDb();
                const lastRecord = await sql`
                    SELECT lat, lng, cliente, timestamp
                    FROM records
                    WHERE lat IS NOT NULL AND lng IS NOT NULL AND cliente IS NOT NULL
                    ORDER BY timestamp DESC LIMIT 1
                `;
                if (lastRecord.length > 0) {
                    const rec = lastRecord[0];
                    const now = new Date();
                    const recTime = new Date(rec.timestamp);
                    // Controllo se è della stessa giornata e se la distanza è <= 200m
                    if (now.getDate() === recTime.getDate() && now.getMonth() === recTime.getMonth() && now.getFullYear() === recTime.getFullYear()) {
                        const dist = haversineMeters(rec.lat, rec.lng, location.lat, location.lng);
                        if (dist <= 200) {
                            clienteBloccato = rec.cliente;
                            console.log(`Continuità Cliente attivata: distanza ${dist.toFixed(0)}m, cliente: ${clienteBloccato}`);
                        }
                    }
                }
            } catch (err) {
                console.error("Errore fetch continuità cliente:", err);
            }
        }

        // 2. Ricerca aziende vicine tramite Google Places API se abbiamo le coordinate E non abbiamo bloccato il cliente
        let nearbyCompaniesText = "";
        let companyNamesList: string[] = [];
        if (location && process.env.GOOGLE_MAPS_API_KEY && !clienteBloccato) {
            try {
                const placesRes = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
                    method: "POST",
                    headers: {
                        "X-Goog-Api-Key": process.env.GOOGLE_MAPS_API_KEY,
                        "X-Goog-FieldMask": "places.displayName",
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        maxResultCount: 20,
                        locationRestriction: {
                            circle: {
                                center: {
                                    latitude: location.lat,
                                    longitude: location.lng
                                },
                                radius: 500.0
                            }
                        }
                    })
                });
                const placesData = await placesRes.json();

                if (placesData.places && placesData.places.length > 0) {
                    const companyNamesArray = placesData.places
                        .map((p: any) => p.displayName?.text)
                        // Filtra nomi vuoti, generici o troppo corti
                        .filter((name: string) => name && name.length > 3)
                        .slice(0, 15); // Prendi le prime 15

                    if (companyNamesArray.length > 0) {
                        companyNamesList = companyNamesArray;
                        const companyNamesStr = companyNamesArray.join(", ");
                        nearbyCompaniesText = `\n\nCONTESTO GEOGRAFICO:\nLe foto sono state scattate vicino a queste aziende/luoghi: ${companyNamesStr}.\nUsa questo elenco per dedurre il "cliente" se riconosci loghi, scritte sul veicolo o contesto affine.`;
                    }
                }
                console.log(`Trovate ${companyNamesList.length} aziende nei paraggi (500m):`, companyNamesList);
            } catch (err) {
                console.warn("Errore fetch Google Places API (New):", err);
            }
        }

        let continuityText = "";
        if (clienteBloccato) {
            continuityText = `\n\nCLIENTE BLOCCATO: Il sistema ha determinato, in base alla posizione geografica invariata dall'ultimo veicolo analizzato, che il cliente proprietario o luogo lavori è ESATTAMENTE "${clienteBloccato}". IMPONILO nel campo 'cliente' senza porsi dubbi e ignorando nomi di conducenti o etichette discordanti.`;
        }

        const prompt = `Sei un assistente specializzato per officine meccaniche, in particolare per veicoli pesanti (camion, autocarri, semirimorchi).
Analizza ${rawImages.length > 1 ? `queste ${rawImages.length} immagini dello stesso veicolo` : "questa immagine del veicolo"} insieme alle seguenti note dettate a voce: "${notes || "Nessuna nota inserita"}".${nearbyCompaniesText}${continuityText}

Estrai le seguenti informazioni e restituiscile ESCLUSIVAMENTE in formato JSON puro (senza markdown, senza backtick).

Regole obbligatorie per ogni campo:
- "targa": MAIUSCOLO e SENZA SPAZI. Sugli scontrini VDO/tachigrafo la targa appare spesso nel formato "I /FE993NH" o "I /AB123CD" (dove "I /" è la sigla del paese Italia) — in quel caso estrai solo la parte alfanumerica senza la sigla paese (es. "FE993NH"). Può anche apparire come "TR / 5 3 4 1 8 8 2 2" (Turchia) o altri formati europei. Cerca la riga subito sotto "N. Telaio" o accanto alla sigla nazione. Se non visibile usa null.
- "telaio": numero di telaio/VIN. Spesso su targhette VDO, scontrini ("N. Telaio"), etichette adesive. 17 caratteri alfanumerici (es. "WDF9634031B984316"). Senza spazi. Se non visibile usa null.
- "seriale_centralina": seriale del dispositivo/tachigrafo (es. "FMC640-23Q2-00032", "AUTA-FMC361"). Cerca sigle FMC, VR, Continental, Stoneridge, Siemens VDO. Se non visibile usa null.
- "marca_veicolo": marca del veicolo. REGOLA OBBLIGATORIA: se estrai un "telaio", DEVI dedurre la marca dalle sue prime tre lettere (WMI): se inizia per "YV" è "Volvo", per "XLR" è "DAF", per "WJM" o "ZC" è "Iveco", per "WDF" o "W1" è "Mercedes-Benz", per "YS" è "Scania", per "WMA" è "MAN", per "VF" è "Renault Trucks". Se non è in queste o manca il telaio, deducila dai loghi. Altrimenti usa null.
- "numero_veicolo": numero aziendale interno (es. "893"). Se non visibile usa null.
- "cliente": Il nome del cliente / azienda proprietaria del veicolo. Deducibile dai loghi sulle portiere (es. "CABLOG", "FERCAM"). Se hai un CONTESTO GEOGRAFICO, incrocia i nomi dell'elenco aziendale col veicolo: se in foto intravedi un adesivo o una scritta simile a uno dei NOMI IN ELENCO GPS, consideralo una chiara conferma ed elegge quello come Cliente indiscusso. ATTENZIONE: Se la foto è uno scontrino tachigrafico, i nomi propri di persona (es. "Crisman Massimo") appartengono al CONDUCENTE, non al Cliente! Non usare MAI nomi propri di conducenti come Cliente. Se non riesci a dedurlo o non hai conferme incrociate sicure, usa null. (Ignora se CLIENTE BLOCCATO è presente).
- "tipo_veicolo": REGOLE OBBLIGATORIE: 1) Se la targa inizia per "XA" oppure ha 2 lettere e 5 numeri (es. AB12345), il tipo di veicolo DEVE ESSERE SOLO "Rimorchio". 2) Se nella foto c'è uno scontrino tachigrafico o i loghi VDO o STONERIDGE, il tipo DEVE ESSERE "Mezzo pesante > 3,5 ton". 3) Se dalle forme o loghi deduci si tratti di trattore d'agricoltura, falciatrice, aratro, mietitrebbia o simile veicolo da campi agricoli, il tipo DEVE ESSERE "Macchina Agricola". 4) Altrimenti usa nomi come "Trattore stradale", "Camion", "Furgone", "Berlina", ecc.
- "lavorazione_eseguita": tipo di intervento in buon italiano tecnico.
- "anno_immatricolazione": l'anno di immatricolazione del veicolo (es. "2020", "2018"). Dedurlo dalla targa italiana calcolando grossomodo l'anno (es. FG..=2016/17, FX..=2019/20, GA..=2020/21) o leggendo le date di installazione/calibrazione dallo scontrino tachigrafico se presente. Se impossibile stimarlo, usa null.
- "marca_modello_tachigrafo": MARCA E VERSIONE COMPLETA del Tachigrafo, da leggere rigorosamente se la foto è uno scontrino tachigrafico. Cerca esplicitamente la marca (VDO o Stoneridge) e accoppiala a TUTTE le sigle di versione presenti. Spesso c'è una sigla in alto (es. "GEN2 v2", "GEN 2") e un'altra più in basso (es. "V 1619", "V 4140", "V 4072", "V 2223"). DEVI UNIRLE in un'unica stringa. Esempi esatti di output atteso: "Stoneridge GEN2 v2 V 1619", "VDO GEN2 v2 V 4140", "VDO GEN 2 V 4072". Non tralasciare i pezzi, uniscili sempre. Se non riesci a trovare nulla usa null.
- "fornitore_servizio": Il fornitore del servizio telematico/satellitare, scegliendo rigorosamente tra: GEOTAB, W.A.Y., WEBFLEET, FLOTTAWEB, GOLIA, MULTIPROTEXION, ALTRO. Deducibile dai dispositivi fotografati. Regole aggiuntive: se sul seriale vedi in mezzo "22Q1 -xxxx" (o formati simili con Q) è "W.A.Y."; se compare la scritta "raliacom", "Geotab" o "VISIRUN", usa "GEOTAB". Se non visibile, usa null.

Schema JSON:
{
  "targa": "stringa senza spazi o null",
  "telaio": "stringa senza spazi o null",
  "seriale_centralina": "stringa o null",
  "marca_veicolo": "stringa o null",
  "numero_veicolo": "stringa o null",
  "cliente": "stringa o null",
  "tipo_veicolo": "stringa",
  "lavorazione_eseguita": "stringa",
  "anno_immatricolazione": "stringa (solo anno a 4 cifre) o null",
  "marca_modello_tachigrafo": "stringa o null",
  "fornitore_servizio": "stringa o null"
}`;

        // Costruisce le parti per ogni immagine
        const imageParts = rawImages.map((img: string) => {
            const mimeMatch = img.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9+.-]+);base64,/);
            const mimeType = mimeMatch?.[1] || "image/jpeg";
            const base64Data = img.replace(/^data:image\/[^;]+;base64,/, "");
            return { inlineData: { data: base64Data, mimeType } };
        });

        const requestBody = {
            contents: [{
                parts: [
                    { text: prompt },
                    ...imageParts
                ]
            }],
            generationConfig: {
                temperature: 0.1,
                topK: 1,
                topP: 1,
            }
        };

        const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("Gemini API error:", response.status, errText);
            return NextResponse.json(
                { error: `Errore API Gemini (${response.status}): ${errText.slice(0, 200)}` },
                { status: 500 }
            );
        }

        const data = await response.json();
        let text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        text = text.replace(/```json/g, "").replace(/```/g, "").trim();

        try {
            const parsedData = JSON.parse(text);
            if (parsedData.targa) parsedData.targa = parsedData.targa.replace(/\s+/g, "").toUpperCase();
            if (parsedData.telaio) parsedData.telaio = parsedData.telaio.replace(/\s+/g, "").toUpperCase();

            // Ritorna le aziende dirette trovate da Google (se presenti)
            const debugInfo = {
                hasLocation: !!location,
                hasMapKey: !!process.env.GOOGLE_MAPS_API_KEY,
                placesFound: companyNamesList.length,
                cliente_bloccato: !!clienteBloccato
            };
            return NextResponse.json({ success: true, data: parsedData, nearby_companies: companyNamesList, debug_info: debugInfo });
        } catch {
            console.error("JSON parsing error. Raw:", text);
            return NextResponse.json({ error: "Il modello non ha restituito un JSON valido." }, { status: 500 });
        }
    } catch (error: any) {
        console.error("Analyze error:", error.message);
        return NextResponse.json({ error: "Errore: " + error.message }, { status: 500 });
    }
}
