import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "missing_key");
const MODEL = "gemini-2.0-flash"; // Disponibile su v1beta con @google/generative-ai 0.24.x

export async function POST(req: NextRequest) {
    try {
        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json(
                { error: "Chiave API Gemini (GEMINI_API_KEY) mancante sul server." },
                { status: 500 }
            );
        }

        const body = await req.json();
        const rawImages: string[] = body.imagesBase64 ?? (body.imageBase64 ? [body.imageBase64] : []);
        const notes: string = body.notes || "";

        if (rawImages.length === 0) {
            return NextResponse.json({ error: "Nessuna immagine fornita." }, { status: 400 });
        }

        const model = genAI.getGenerativeModel({ model: MODEL });

        const prompt = `Sei un assistente specializzato per officine meccaniche, in particolare per veicoli pesanti (camion, autocarri, semirimorchi).
Analizza ${rawImages.length > 1 ? `queste ${rawImages.length} immagini dello stesso veicolo` : "questa immagine del veicolo"} insieme alle seguenti note dettate a voce: "${notes || "Nessuna nota inserita"}".

Estrai le seguenti informazioni e restituiscile ESCLUSIVAMENTE in formato JSON puro (senza markdown, senza backtick).

Regole obbligatorie per ogni campo:
- "targa": MAIUSCOLO e SENZA SPAZI (es. "AB123CD"). Se non visibile usa null.
- "telaio": numero di telaio/VIN del veicolo. Spesso visibile su targhette VDO, scontrini del tachigrafo (voce "N. Telaio" o "WDF..."), o etichette adesive sul montante porta. Formato tipico: 17 caratteri alfanumerici (es. "WDF9634031B984316"). Senza spazi. Se non visibile usa null.
- "seriale_centralina": numero seriale della centralina/tachigrafo digitale. Spesso impresso sull'etichetta del dispositivo elettronico (es. "FMC640-23Q2-00032", "AUTA-FMC361"). Cerca sigle come FMC, VR, Continental, Stoneridge, Siemens VDO, ecc. Se non visibile usa null.
- "marca_veicolo": marca del veicolo (es. "Mercedes Benz", "Volvo", "Scania", "DAF", "MAN", "Iveco", "Renault"). Deducibile dalla targa (WDF=Mercedes), dal corpo del veicolo, o dai documenti. Se non deducibile usa null.
- "numero_veicolo": numero aziendale interno del veicolo (spesso scritto sul montante o sulla cabina, es. "893"). Se non visibile usa null.
- "tipo_veicolo": es. "Trattore stradale", "Camion", "Furgone", "Berlina", "SUV", ecc.
- "lavorazione_eseguita": il tipo di intervento, dedotto sia dalle foto che dalle note (buon italiano tecnico).

Schema JSON da restituire:
{
  "targa": "stringa senza spazi o null",
  "telaio": "stringa senza spazi o null",
  "seriale_centralina": "stringa o null",
  "marca_veicolo": "stringa o null",
  "numero_veicolo": "stringa o null",
  "tipo_veicolo": "stringa",
  "lavorazione_eseguita": "stringa"
}`;

        // Costruisce le parti immagine estraendo il mimeType dal data URL
        const imageParts = rawImages.map((img: string) => {
            // Estrae il mimeType reale dal data URL (es. image/png, image/jpeg, image/heic)
            const mimeMatch = img.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9+.-]+);base64,/);
            const mimeType = (mimeMatch?.[1] || "image/jpeg") as "image/jpeg" | "image/png" | "image/webp" | "image/heic" | "image/heif";
            const base64Data = img.replace(/^data:image\/[^;]+;base64,/, "");
            return {
                inlineData: {
                    data: base64Data,
                    mimeType,
                },
            };
        });

        const result = await model.generateContent([prompt, ...imageParts]);
        const response = await result.response;
        let text = response.text();
        text = text.replace(/```json/g, "").replace(/```/g, "").trim();

        try {
            const parsedData = JSON.parse(text);
            // Normalizzazione server-side: targa e telaio senza spazi, maiuscoli
            if (parsedData.targa) parsedData.targa = parsedData.targa.replace(/\s+/g, "").toUpperCase();
            if (parsedData.telaio) parsedData.telaio = parsedData.telaio.replace(/\s+/g, "").toUpperCase();
            return NextResponse.json({ success: true, data: parsedData });
        } catch {
            console.error("JSON parsing error. Raw output:", text);
            return NextResponse.json(
                { error: "Il modello non ha restituito un JSON valido." },
                { status: 500 }
            );
        }
    } catch (error: any) {
        console.error("API /analyze error:", error.message);
        return NextResponse.json(
            { error: "Errore durante l'analisi AI: " + error.message },
            { status: 500 }
        );
    }
}
