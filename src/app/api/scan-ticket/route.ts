import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent";

export async function POST(req: NextRequest) {
  try {
    const { imageBase64 } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;
    const syncKey = process.env.SYNC_API_KEY;
    const ticketAppUrl = process.env.TICKET_APP_URL || process.env.NEXT_PUBLIC_TICKET_APP_URL || 'https://app-ticket-sigma.vercel.app';

    if (!imageBase64) return NextResponse.json({ error: "No image" }, { status: 400 });
    if (!apiKey || !syncKey) return NextResponse.json({ error: "Missing keys" }, { status: 500 });

    // 1. Analyze with Gemini to find a SERIAL or PLATE
    const prompt = `Sei un esperto di sistemi telematici per veicoli. 
    Analizza questa immagine (può essere un'etichetta di un dispositivo, una targa o uno scontrino) 
    ed estrai il SERIALE del dispositivo (es. FMC650-..., AUTA-..., 3036...) o la TARGA del veicolo.
    
    Cerca codici che iniziano per FMC, FMB, FMC650, FMC130, o codici numerici lunghi.
    Restituisci SOLO un JSON con il campo "code" (il valore trovato) o null se non trovi nulla.
    
    Esempio: {"code": "FMC650-23Q2-00035"}`;

    const base64Data = imageBase64.replace(/^data:image\/[^;]+;base64,/, "");
    const mimeType = imageBase64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9+.-]+);base64,/)?.[1] || "image/jpeg";

    const geminiRes = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inlineData: { data: base64Data, mimeType } }
          ]
        }],
        generationConfig: { temperature: 0.1 }
      })
    });

    if (!geminiRes.ok) throw new Error("Gemini API error");
    const geminiData = await geminiRes.json();
    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const { code } = JSON.parse(text.replace(/```json/g, "").replace(/```/g, "").trim());

    if (!code) {
      return NextResponse.json({ success: false, message: "Non ho trovato codici seriali o targhe leggibili." });
    }

    console.log(`[SCAN] Extracted code: ${code}`);

    // 2. Lookup ticket in App-Ticket
    const lookupRes = await fetch(`${ticketAppUrl}/api/tickets/lookup?serial=${encodeURIComponent(code)}`, {
      method: "GET",
      headers: { "x-api-key": syncKey }
    });

    if (!lookupRes.ok) {
       return NextResponse.json({ success: false, message: `Errore durante la ricerca del ticket per: ${code}` });
    }

    const { success, ticket } = await lookupRes.json();

    if (!success || !ticket) {
      return NextResponse.json({ success: false, message: `Nessun ticket trovato corrispondente al codice: ${code}` });
    }

    // 3. Generate Signed URL for the found ticket
    const timestamp = Date.now();
    const signature = crypto
      .createHmac('sha256', syncKey)
      .update(`${ticket.commessa}:${timestamp}`)
      .digest('hex');

    const signedUrl = `${ticketAppUrl}/view?commessa=${ticket.commessa}&embed=true&ts=${timestamp}&sig=${signature}`;

    return NextResponse.json({
      success: true,
      code_found: code,
      ticket: {
        ...ticket,
        signedUrl
      }
    });

  } catch (error: any) {
    console.error("[SCAN ERROR]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
