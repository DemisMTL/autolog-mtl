import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "missing_key");

export async function POST(req: NextRequest) {
    try {
        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json(
                { error: "Chiave API Gemini (GEMINI_API_KEY) mancante sul server." },
                { status: 500 }
            );
        }

        const body = await req.json();
        // Supporta sia singola immagine (imageBase64) che array (imagesBase64)
        const rawImages: string[] = body.imagesBase64 ?? (body.imageBase64 ? [body.imageBase64] : []);
        const notes: string = body.notes || "";

        if (rawImages.length === 0) {
            return NextResponse.json({ error: "Nessuna immagine fornita." }, { status: 400 });
        }

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `Sei un assistente per meccanici. Analizza ${rawImages.length > 1 ? `queste ${rawImages.length} immagini dello stesso veicolo` : "questa immagine del veicolo"} insieme alle seguenti note dettate a voce: "${notes || "Nessuna nota inserita"}".

Estrai le seguenti informazioni e restituiscile ESCLUSIVAMENTE in formato JSON puro (senza markdown, senza backtick).
Regole obbligatorie:
- "targa": sempre in MAIUSCOLO e SENZA SPAZI (es. "AB123CD", non "AB 123 CD"). Se non deducibile usa null.
- "numero_veicolo": identificativo aziendale o numero interno del veicolo se visibile. Se non presente usa null.
- "tipo_veicolo": es. "Berlina", "SUV", "Furgone", "Moto", "Trattore", ecc.
- "lavorazione_eseguita": il tipo di intervento, dedotto sia dalle foto che dalle note (scritto in buon italiano tecnico).

Schema JSON richiesto:
{
  "targa": "stringa senza spazi o null",
  "numero_veicolo": "stringa o null",
  "tipo_veicolo": "stringa",
  "lavorazione_eseguita": "stringa"
}`;

        // Costruisce le parti immagine per ogni foto
        const imageParts = rawImages.map((img: string) => ({
            inlineData: {
                data: img.replace(/^data:image\/\w+;base64,/, ""),
                mimeType: "image/jpeg" as const,
            },
        }));

        const result = await model.generateContent([prompt, ...imageParts]);
        const response = await result.response;
        let text = response.text();
        text = text.replace(/```json/g, "").replace(/```/g, "").trim();

        try {
            const parsedData = JSON.parse(text);
            // Normalizzazione forzata lato server: targa sempre senza spazi e maiuscola
            if (parsedData.targa) {
                parsedData.targa = parsedData.targa.replace(/\s+/g, "").toUpperCase();
            }
            return NextResponse.json({ success: true, data: parsedData });
        } catch {
            console.error("JSON parsing error. Raw output:", text);
            return NextResponse.json(
                { error: "Il modello non ha restituito un JSON valido." },
                { status: 500 }
            );
        }
    } catch (error: any) {
        console.error("API /analyze endpoint error:", error.message);
        return NextResponse.json(
            { error: "Errore durante l'analisi AI: " + error.message },
            { status: 500 }
        );
    }
}
