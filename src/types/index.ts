
export interface InterventRecord {
  id: number;
  timestamp: string;
  targa: string | null;
  tipo_veicolo: string | null;
  numero_veicolo: string | null;
  lavorazione_eseguita: string | null;
  note: string;
  lat: number | null;
  lng: number | null;
  cliente?: string | null;
  telaio?: string | null;
  seriale_centralina?: string | null;
  marca_veicolo?: string | null;
  anno_immatricolazione?: string | null;
  marca_modello_tachigrafo?: string | null;
  fornitore_servizio?: string | null;
  tecnico?: string | null;
  is_matched?: boolean;
  matched_ticket?: string | null;
  signed_ticket_url?: string | null;
  tipo_lavorazione?: string | null;
  collaudo_url?: string | null; // URL certificato di collaudo WAY
}
