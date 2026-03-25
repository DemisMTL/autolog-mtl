import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

/**
 * Genera il certificato PDF basato sul file originale (DEMO) sovrascrivendo i dati.
 * @param record Il record dell'intervento con i dati nuovi
 */
export async function generateSidewayCertification(record: any) {
    // 1. Carica il template originale dalla cartella public
    const url = '/sideway_template.pdf';
    const existingPdfBytes = await fetch(url).then(res => res.arrayBuffer());

    // 2. Carica il documento
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const { width, height } = firstPage.getSize();

    // 3. Carica il font
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Funzione helper per "sbiancare" e scrivere sopra
    const replaceText = (newText: string, x: number, y: number, w: number, h: number, isBold = false) => {
        // Disegna un rettangolo bianco per coprire il vecchio testo
        firstPage.drawRectangle({
            x: x - 1,
            y: y - 2,
            width: w + 2,
            height: h + 4,
            color: rgb(1, 1, 1),
        });
        // Scrive il nuovo testo
        firstPage.drawText(newText || '—', {
            x: x,
            y: y,
            size: 10,
            font: isBold ? fontBold : font,
            color: rgb(0, 0, 0),
        });
    };

    // --- COORDINATE ESTIMATE (A4 595x842) ---
    // Nota: Le coordinate Y partono dal basso (0)
    // AROSIO si trova circa a metà altezza nel testo
    
    // 1. Cliente (Ditta)
    // "sui mezzi della ditta AROSIO qui elencati"
    // Supponiamo sia intorno a Y=600 (dal basso)
    // Dovrò fare dei test per centrarlo bene.
    replaceText(record.cliente || 'N/A', 112, 638, 150, 12, true);

    // 2. Tabella Dati (Targa, Telaio, Seriale)
    // FY465DJ (Targa)
    replaceText(record.targa || '—', 58, 597, 60, 12);
    
    // Telaio
    replaceText(record.telaio || '—', 145, 597, 160, 12);
    
    // Seriale Dispositivo
    replaceText(record.seriale_centralina || '—', 415, 597, 150, 12);

    // 3. Data (TREVISO lì 09/09/2024)
    const today = new Date();
    const dateStr = `${today.getDate().toString().padStart(2, '0')} / ${(today.getMonth() + 1).toString().padStart(2, '0')} / ${today.getFullYear()}`;
    replaceText(dateStr, 125, 239, 80, 12);

    // 4. Se vogliamo cambiare anche il Tecnico (opzionale)
    // replaceText(record.tecnico || 'EDOARDO ZAGO', 40, ...);

    // 5. Salva e Avvia Download
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Certificato_SIDEWAY_${record.targa || 'VEICOLO'}.pdf`;
    link.click();
}
