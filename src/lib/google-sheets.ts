import { google } from 'googleapis';

export function getGoogleAuth() {
    const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!keyJson) {
        throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY non configurata nel file .env.local');
    }
    const key = JSON.parse(
        Buffer.from(keyJson, 'base64').toString('utf-8')
    );
    return new google.auth.GoogleAuth({
        credentials: key,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
}

export function getSheetsClient() {
    return google.sheets({ version: 'v4', auth: getGoogleAuth() });
}

export const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID || '';
export const SHEET_NAME = 'AutoLog Records';
// Colonne: Timestamp | Targa | TipoVeicolo | NumeroVeicolo | Lavorazione | Note | Lat | Lng
export const HEADER_ROW = [
    'Timestamp', 'Targa', 'Tipo Veicolo', 'Numero Veicolo', 'Lavorazione Eseguita', 'Note', 'Latitudine', 'Longitudine'
];
