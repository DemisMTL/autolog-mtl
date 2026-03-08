import { NextRequest, NextResponse } from "next/server";

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

        // Ricerca aziende vicine tramite Google Places API se abbiamo le coordinate
        let nearbyCompaniesText = "";
        let companyNamesList: string[] = [];
        if (location && process.env.GOOGLE_MAPS_API_KEY) {
            try {
                const placesUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location.lat},${location.lng}&radius=500&language=it&key=${process.env.GOOGLE_MAPS_API_KEY}`;
                const placesRes = await fetch(placesUrl);
                const placesData = await placesRes.json();

                if (placesData.results && placesData.results.length > 0) {
                    const companyNamesArray = placesData.results
                        .map((p: any) => p.name)
                        // Filtra nomi generici o troppo corti
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
                console.warn("Errore fetch Google Places API:", err);
            }
        }

        const prompt = `Sei un assistente specializzato per officine meccaniche, in particolare per veicoli pesanti (camion, autocarri, semirimorchi).
Analizza ${rawImages.length > 1 ? `queste ${rawImages.length} immagini dello stesso veicolo` : "questa immagine del veicolo"} insieme alle seguenti note dettate a voce: "${notes || "Nessuna nota inserita"}".${nearbyCompaniesText}

Estrai le seguenti informazioni e restituiscile ESCLUSIVAMENTE in formato JSON puro (senza markdown, senza backtick).

Regole obbligatorie per ogni campo:
- "targa": MAIUSCOLO e SENZA SPAZI. Sugli scontrini VDO/tachigrafo la targa appare spesso nel formato "I /FE993NH" o "I /AB123CD" (dove "I /" è la sigla del paese Italia) — in quel caso estrai solo la parte alfanumerica senza la sigla paese (es. "FE993NH"). Può anche apparire come "TR / 5 3 4 1 8 8 2 2" (Turchia) o altri formati europei. Cerca la riga subito sotto "N. Telaio" o accanto alla sigla nazione. Se non visibile usa null.
- "telaio": numero di telaio/VIN. Spesso su targhette VDO, scontrini ("N. Telaio"), etichette adesive. 17 caratteri alfanumerici (es. "WDF9634031B984316"). Senza spazi. Se non visibile usa null.
- "seriale_centralina": seriale del dispositivo/tachigrafo (es. "FMC640-23Q2-00032", "AUTA-FMC361"). Cerca sigle FMC, VR, Continental, Stoneridge, Siemens VDO. Se non visibile usa null.
- "marca_veicolo": marca del veicolo (es. "Mercedes Benz", "Volvo", "Scania", "DAF", "MAN", "Iveco"). Se non deducibile usa null.
- "numero_veicolo": numero aziendale interno (es. "893"). Se non visibile usa null.
- "cliente": Il nome del cliente / azienda proprietaria del veicolo. Dedotto dai loghi sulle portiere (es. "CABLOG", "FERCAM"), dalle note vocali, o incrociando i loghi/note con il CONTESTO GEOGRAFICO fornito sopra. Se non riesci a dedurlo, usa null.
- "tipo_veicolo": es. "Trattore stradale", "Camion", "Furgone", "Berlina", ecc.
- "lavorazione_eseguita": tipo di intervento in buon italiano tecnico.

Schema JSON:
{
  "targa": "stringa senza spazi o null",
  "telaio": "stringa senza spazi o null",
  "seriale_centralina": "stringa o null",
  "marca_veicolo": "stringa o null",
  "numero_veicolo": "stringa o null",
  "cliente": "stringa o null",
  "tipo_veicolo": "stringa",
  "lavorazione_eseguita": "stringa"
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
            return NextResponse.json({ success: true, data: parsedData, nearby_companies: companyNamesList });
        } catch {
            console.error("JSON parsing error. Raw:", text);
            return NextResponse.json({ error: "Il modello non ha restituito un JSON valido." }, { status: 500 });
        }
    } catch (error: any) {
        console.error("Analyze error:", error.message);
        return NextResponse.json({ error: "Errore: " + error.message }, { status: 500 });
    }
}
