import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

/**
 * Genera il certificato PDF completo basandosi sul template con sola intestazione.
 * Scrive tutto il testo della dichiarazione e i dati dinamici.
 */
export async function generateSidewayCertification(record: any) {
    try {
        console.log("Inizio generazione PDF Alta Fedeltà...");
        
        // 1. Carica il template con sola intestazione
        const url = '/sideway_template.pdf';
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Template non trovato: ${res.status}`);
        const existingPdfBytes = await res.arrayBuffer();

        const pdfDoc = await PDFDocument.load(existingPdfBytes);
        const pages = pdfDoc.getPages();
        const firstPage = pages[0];
        const { width, height } = firstPage.getSize();

        // 2. Carica i font
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        let y = height - 125; // Spostato in basso di 2 righe rispetto a prima (era -100)
        const margin = 50;
        const colWidth = width - (2 * margin);

        // --- TITOLO ---
        y -= 30;
        firstPage.drawText('DICHIARAZIONE DI CORRETTA INSTALLAZIONE SISTEMA SIDEWAY', {
            x: width / 2 - 210, // Centrato approssimativamente
            y: y,
            size: 13,
            font: fontBold,
            color: rgb(0, 0, 0),
        });

        // --- INTRO TESTO ---
        y -= 40;
        const introText = `Il sottoscritto EDOARDO ZAGO, nato il 05/03/1988 a ISOLA DELLA SCALA (VR) e residente a TREVENZUOLO (VR) in Via SANT’EUROSIA n. 12/C Codice Fiscale ZGADRD88C05E349V, della ditta MECTRONIC LAB con sede a VERONA (VR) in Via GIUSEPPE SIRTORI n. 5/A CAP 37128 P.IVA: 04826920235 e Codice Fiscale: 04826920235`;
        
        const drawWrappedText = (text: string, x: number, currentY: number, maxWidth: number, fontSize: number, currentFont: any) => {
            const words = text.split(' ');
            let line = '';
            let lineY = currentY;
            for (let n = 0; n < words.length; n++) {
                const testLine = line + words[n] + ' ';
                const testWidth = currentFont.widthOfTextAtSize(testLine, fontSize);
                if (testWidth > maxWidth && n > 0) {
                    firstPage.drawText(line, { x, y: lineY, size: fontSize, font: currentFont });
                    line = words[n] + ' ';
                    lineY -= fontSize + 5;
                } else {
                    line = testLine;
                }
            }
            firstPage.drawText(line, { x, y: lineY, size: fontSize, font: currentFont });
            return lineY - (fontSize + 10);
        };

        y = drawWrappedText(introText, margin, y, colWidth, 10, font);

        // --- DICHIARA ---
        y -= 10;
        firstPage.drawText('DICHIARA:', { x: margin, y, size: 11, font: fontBold });
        y -= 15;
        
        const dichiaraText = `di aver effettuato l’installazione di dispositivi di rilevazione dell’angolo cieco, sui mezzi della ditta ${record.cliente || 'AROSIO'} qui elencati:`;
        y = drawWrappedText(dichiaraText, margin, y, colWidth, 10, font);

        // --- TABELLA DATI ---
        y -= 15;
        const tableY = y;
        firstPage.drawText('Targa mezzo', { x: margin, y, size: 10, font: fontBold });
        firstPage.drawText('Telaio mezzo', { x: margin + 90, y, size: 10, font: fontBold });
        firstPage.drawText('Marca dispositivo', { x: margin + 250, y, size: 10, font: fontBold });
        firstPage.drawText('Matricola Dispositivo', { x: margin + 360, y, size: 10, font: fontBold });

        y -= 15;
        firstPage.drawText(record.targa || '—', { x: margin, y, size: 10, font });
        firstPage.drawText(record.telaio || '—', { x: margin + 90, y, size: 10, font });
        firstPage.drawText('SIDEWAY', { x: margin + 250, y, size: 10, font });
        firstPage.drawText(record.seriale_centralina || '—', { x: margin + 360, y, size: 10, font });

        // --- ALTRESI DICHIARA ---
        y -= 30;
        firstPage.drawText('Altresì dichiara :', { x: margin, y, size: 10, font: fontBold });
        y -= 15;

        const bulletPoints = [
            "che l’installazione è fatta a regola d’arte e secondo le norme vigenti ;",
            "che l’installazione non compromette la conformità del bene su cui avviene ed è conforme alle prescrizioni applicabili al momento dell’installazione;",
            "che l’installazione non compromette la garanzia del bene su cui avviene;",
            "che l’installazione è fatta in osservanza delle istruzioni d’uso e raccomandazioni del fabbricante del bene su cui avviene;",
            "che i dispositivi ed i componenti installati rispettano le normative applicabili per la destinazione d’uso per cui avviene l’installazione;",
            "che i dispositivi ed i componenti installati non compromettono la conformità del bene su cui vengono installati secondo le prescrizioni applicabili al momento dell’installazione;",
            "che i dispositivi ed i componenti installati non compromettono la garanzia del bene su cui vengono installati;",
            "che i dispositivi ed i componenti installati sono compatibili con le istruzioni d’uso e raccomandazioni del fabbricante del bene su cui vengono installati."
        ];

        bulletPoints.forEach(point => {
            y = drawWrappedText(`• ${point}`, margin, y, colWidth, 9, font);
            y += 5; // Spazio extra tra i punti
        });

        // --- CONCLUSIONE ---
        y -= 10;
        const conclusionText = "Si dichiara altresì che l’installazione è stata controllata con esito positivo ai fini della sicurezza e funzionalità.";
        y = drawWrappedText(conclusionText, margin, y, colWidth, 10, font);

        // --- DATA ---
        y -= 30;
        const today = new Date();
        const dateStr = `${today.getDate().toString().padStart(2, '0')} / ${(today.getMonth() + 1).toString().padStart(2, '0')} / ${today.getFullYear()}`;
        firstPage.drawText(`TREVISO lì ${dateStr}`, { x: margin, y: y, size: 10, font });

        // 3. Salva e Avvia Download
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
        const downloadUrl = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `Certificato_SIDEWAY_${record.targa || 'Veicolo'}.pdf`;
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(downloadUrl);
        }, 100);

    } catch (err) {
        console.error("Errore fatale generazione PDF:", err);
        throw err;
    }
}
