/**
 * Genera il certificato PDF per l'installazione SIDEWAY basato sul modello Word fornito
 * @param record Il record dell'intervento con i dati necessari
 */
export async function generateSidewayCertification(record: any) {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 25;

    // Titolo centrato
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('DICHIARAZIONE DI CORRETTA INSTALLAZIONE SISTEMA SIDEWAY', pageWidth / 2, y, { align: 'center' });
    
    y += 15;
    
    // Testo introduttivo
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    const introText = `Il sottoscritto EDOARDO ZAGO, nato il 05/03/1988 a ISOLA DELLA SCALA (VR) e residente a TREVENZUOLO (VR) in Via SANT’EUROSIA n. 12/C Codice Fiscale ZGADRD88C05E349V, della ditta MECTRONIC LAB con sede a VERONA (VR) in Via GIUSEPPE SIRTORI n. 5/A CAP 37128 P.IVA: 04826920235 e Codice Fiscale: 04826920235`;
    const splitIntro = doc.splitTextToSize(introText, pageWidth - (margin * 2));
    doc.text(splitIntro, margin, y);
    
    y += (splitIntro.length * 6) + 5;
    
    doc.setFont('helvetica', 'bold');
    doc.text('DICHIARA:', margin, y);
    y += 8;
    
    doc.setFont('helvetica', 'normal');
    const dichiaraText = `di aver effettuato l’installazione di dispositivi di rilevazione dell’angolo cieco, sui mezzi della ditta ${record.cliente || 'AROSIO'} qui elencati:`;
    const splitDichiara = doc.splitTextToSize(dichiaraText, pageWidth - (margin * 2));
    doc.text(splitDichiara, margin, y);
    
    y += 12;

    // Tabella dati veicolo
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Targa mezzo', margin, y);
    doc.text('Telaio mezzo', margin + 30, y);
    doc.text('Marca dispositivo', margin + 85, y);
    doc.text('Matricola Dispositivo', margin + 125, y);
    
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.text(record.targa || '—', margin, y);
    doc.text(record.telaio || '—', margin + 30, y);
    doc.text('SIDEWAY', margin + 85, y);
    doc.text(record.seriale_centralina || '—', margin + 125, y);
    
    y += 15;
    
    doc.setFont('helvetica', 'bold');
    doc.text('Altresì dichiara :', margin, y);
    y += 8;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const points = [
        "che l’installazione è fatta a regola d’arte e secondo le norme vigenti ;",
        "che l’installazione non compromette la conformità del bene su cui avviene ed è conforme alle prescrizioni applicabili al momento dell’installazione;",
        "che l’installazione non compromette la garanzia del bene su cui avviene;",
        "che l’installazione è fatta in osservanza delle istruzioni d’uso e raccomandazioni del fabbricante del bene su cui avviene;",
        "che i dispositivi ed i componenti installati rispettano le normative applicabili per la destinazione d’uso per cui avviene l’installazione;",
        "che i dispositivi ed i componenti installati non compromettono la conformità del bene su cui vengono installati secondo le prescrizioni applicabili al momento dell’installazione;",
        "che i dispositivi ed i componenti installati non compromettono la garanzia del bene su cui vengono installati;",
        "che i dispositivi ed i componenti installati sono compatibili con le istruzioni d’uso e raccomandazioni del fabbricante del bene su cui vengono installati."
    ];

    points.forEach(point => {
        const splitPoint = doc.splitTextToSize(`• ${point}`, pageWidth - (margin * 2) - 5);
        doc.text(splitPoint, margin, y);
        y += (splitPoint.length * 5) + 2;
    });
    
    y += 5;
    const finalStatement = "Si dichiara altresì che l’installazione è stata controllata con esito positivo ai fini della sicurezza e funzionalità.";
    doc.text(finalStatement, margin, y);
    
    y += 15;
    const today = new Date();
    const dateStr = `${today.getDate().toString().padStart(2, '0')} / ${ (today.getMonth() + 1).toString().padStart(2, '0') } / ${today.getFullYear()}`;
    doc.text(`TREVISO lì ${dateStr}`, margin, y);
    
    y += 20;
    doc.text('__________________', margin, y);
    doc.text('__________________', margin + 100, y);
    y += 5;
    doc.setFontSize(9);
    doc.text('Per il Cliente', margin + 10, y);
    doc.text("L'installatore", margin + 115, y);

    // Salva il file
    const fileName = `Certificato_SIDEWAY_${record.targa || 'VEICOLO'}_${new Date().getTime()}.pdf`;
    doc.save(fileName);
}
