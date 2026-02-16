import { findAbbreviation } from "@/data/mopAbbreviations";

export type MopBereich = 'Energielieferung' | 'Fernwärmeoptimierung' | 'Energiemonitoring';
export type MopStatus = 'Realisierung' | 'Betrieb' | 'Beendet';
export type CsvDelimiter = ';' | ',' | '\t';

// Bereich → Nummer-Mapping
const BEREICH_NUMMERN: Record<MopBereich, number> = {
  'Energielieferung': 2,
  'Fernwärmeoptimierung': 3,
  'Energiemonitoring': 4,
};

// Status-Nummern je Bereich
const STATUS_NUMMERN: Record<MopBereich, Record<MopStatus, number>> = {
  'Energielieferung': { 'Realisierung': 5, 'Betrieb': 6, 'Beendet': 8 },
  'Fernwärmeoptimierung': { 'Realisierung': 50, 'Betrieb': 60, 'Beendet': 70 },
  'Energiemonitoring': { 'Realisierung': 500, 'Betrieb': 600, 'Beendet': 700 },
};

export interface MopComponent {
  name: string;
  quantity: number;
  marke: string;
}

export interface MopExportParams {
  projektNummer: string;
  strasse: string;
  bereich: MopBereich;
  status: MopStatus;
  delimiter: CsvDelimiter;
  components: MopComponent[];
}

interface CsvRow {
  Ebene: number;
  Objektnummer: string;
  Objektsymbol: string;
  Bezeichnung: string;
  Objektart: string;
  Teil_von: string;
  Hersteller: string;
  Kuerzel: string;
}

const CSV_HEADERS: (keyof CsvRow)[] = [
  'Ebene', 'Objektnummer', 'Objektsymbol', 'Bezeichnung', 'Objektart', 'Teil_von', 'Hersteller', 'Kuerzel'
];

function escapeField(value: string | number, delimiter: CsvDelimiter): string {
  const str = String(value);
  if (str.includes(delimiter) || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function generateMopCsv(params: MopExportParams): string {
  const { projektNummer, strasse, bereich, status, delimiter, components } = params;
  const bereichNr = BEREICH_NUMMERN[bereich];
  const statusNr = STATUS_NUMMERN[bereich][status];
  const objNr = `${projektNummer}-1`;

  const rows: CsvRow[] = [];

  // Ebene 1: Projekte
  rows.push({
    Ebene: 1,
    Objektnummer: '1',
    Objektsymbol: '',
    Bezeichnung: '1 - Projekte',
    Objektart: '',
    Teil_von: '',
    Hersteller: '',
    Kuerzel: '',
  });

  // Ebene 2: Bereich
  const bereichBezeichnung = `${bereichNr} - ${bereich}`;
  rows.push({
    Ebene: 2,
    Objektnummer: String(bereichNr),
    Objektsymbol: 'ObjektSymbol 8',
    Bezeichnung: bereichBezeichnung,
    Objektart: 'Produkt',
    Teil_von: '1 - Projekte',
    Hersteller: '',
    Kuerzel: '',
  });

  // Ebene 3: Status
  const statusBezeichnung = `${statusNr} - ${status}`;
  rows.push({
    Ebene: 3,
    Objektnummer: String(statusNr),
    Objektsymbol: '',
    Bezeichnung: statusBezeichnung,
    Objektart: '',
    Teil_von: bereichBezeichnung,
    Hersteller: '',
    Kuerzel: '',
  });

  // Ebene 4: Objekt (Haus)
  const objektBezeichnung = `${objNr} - ${strasse}`;
  rows.push({
    Ebene: 4,
    Objektnummer: objNr,
    Objektsymbol: 'ObjektSymbol 8',
    Bezeichnung: objektBezeichnung,
    Objektart: '',
    Teil_von: statusBezeichnung,
    Hersteller: '',
    Kuerzel: '',
  });

  // Ebene 5: Technikzentrale
  const tzBezeichnung = `${objNr} TZ - Technikzentrale`;
  rows.push({
    Ebene: 5,
    Objektnummer: `${objNr} TZ`,
    Objektsymbol: '',
    Bezeichnung: tzBezeichnung,
    Objektart: 'Produkt',
    Teil_von: objektBezeichnung,
    Hersteller: '',
    Kuerzel: 'TZ',
  });

  // Ebene 6: Komponenten mit Mengenexpansion
  for (const comp of components) {
    const kuerzel = findAbbreviation(comp.name);
    const qty = Math.max(1, comp.quantity);

    for (let i = 1; i <= qty; i++) {
      const suffix = i === 1 ? '' : ` ${i}`;
      const objektnummer = `${objNr} ${kuerzel}${suffix}`;
      const bezeichnung = `${objektnummer} - ${comp.name}`;

      rows.push({
        Ebene: 6,
        Objektnummer: objektnummer,
        Objektsymbol: '',
        Bezeichnung: bezeichnung,
        Objektart: 'Produkt',
        Teil_von: tzBezeichnung,
        Hersteller: comp.marke || '',
        Kuerzel: kuerzel,
      });
    }
  }

  // CSV generieren
  const headerLine = CSV_HEADERS.map(h => escapeField(h, delimiter)).join(delimiter);
  const dataLines = rows.map(row =>
    CSV_HEADERS.map(h => escapeField(row[h], delimiter)).join(delimiter)
  );

  return [headerLine, ...dataLines].join('\n');
}

export function downloadCsv(csvContent: string, filename: string) {
  const BOM = '\uFEFF'; // UTF-8 BOM for Excel compatibility
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Extrahiert eine Projektnummer aus dem Projektnamen.
 * Sucht nach der ersten zusammenhängenden Ziffernfolge.
 */
export function extractProjectNumber(projectName: string): string {
  const match = projectName.match(/\d+/);
  return match ? match[0] : '';
}
