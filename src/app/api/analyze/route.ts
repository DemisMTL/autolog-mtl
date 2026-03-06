import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "missing_key");

export async function POST(req: NextRequest) {
    try {
        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json(
                { error: "Chiave API Gemini (GEMINI_API_KEY) mancante sul server. Impossibile analizzare l'immagine." },
                { status: 500 }
            );
        }

        const body = await req.json();
        const { imageBase64, notes } = body;

        if (!imageBase64) {
            return NextResponse.json({ error: "Nessuna immagine fornita." }, { status: 400 });
        }

        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `Sei un assistente per meccanici. Analizza l'immagine di questo veicolo insieme alle seguenti note dettate a voce: "${notes || "Nessuna nota inserita"}".
Estrai le seguenti informazioni e restituiscile ESCLUSIVAMENTE in formato JSON puro.
Se non riesci a risalire ad un campo (es. la targa è coperta o non deducibile), inserisci null o stringa vuota.

Schema richiesto:
{
  "targa": "stringa o null",
  "numero_veicolo": "identificativo aziendale o numero veicolo se visibile (stringa o null)",
  "tipo_veicolo": "es. Berlina, SUV, Furgone, Moto, Trattore, etc.",
  "lavorazione_eseguita": "il tipo di intervento in corso, dedotto sia dalla foto che dalle note (scritto in buon italiano tecnico)"
}`;

        const imageParts = [
            {
                inlineData: {
                    data: base64Data,
                    mimeType: "image/jpeg",
                },
            },
        ];

        const result = await model.generateContent([prompt, ...imageParts]);
        const response = await result.response;
        let text = response.text();
        text = text.replace(/```json/g, "").replace(/```/g, "").trim();

        try {
            const parsedData = JSON.parse(text);
            return NextResponse.json({ success: true, data: parsedData });
        } catch (e) {
            console.error("JSON parsing error. Raw output:", text);
            return NextResponse.json(
                { error: "Il modello non ha restituito un JSON valido." },
                { status: 500 }
            );
        }
    } catch (error: any) {
        console.error("API /analyze endpoint error:", error);
        return NextResponse.json(
            { error: "Errore durante il processo di analisi AI." },
            { status: 500 }
        );
    }
}
