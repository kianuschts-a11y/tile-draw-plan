

## M.O.P CSV-Export und Export-Dialog Umbenennung

### Uebersicht

Es wird eine CSV-Export-Funktion hinzugefuegt, die Projektdaten in der hierarchischen Struktur ausgibt, die M.O.P Technisches Objektmanagement erwartet. Zusaetzlich wird der Button "Zeichnung exportieren" zu "Exportieren" umbenannt und die CSV-Option im Export-Dialog integriert.

### M.O.P Baumstruktur (aus den Screenshots)

```text
1 - Projekte
  2 - Energielieferung
    5 - Realisierung          (Objekte hier)
    6 - Betrieb
    8 - Beendet
  3 - Fernwaermeoptimierung
    50 - Realisierung
    60 - Betrieb
    70 - Beendet
  4 - Energiemonitoring
    500 - Realisierung
    600 - Betrieb
    700 - Beendet
```

Unter einem Status-Ordner liegt ein **Objekt** (Haus-Icon):
`{Projektnummer}-1 - {Strasse}`

Darunter die **Technikzentrale**:
`{Projektnummer} TZ - Technikzentrale`

Darunter die **Komponenten** (aus der Stueckliste):
`{Projektnummer} {Kuerzel} - {Komponentenname}`

Jede Komponente hat: Objektsymbol, Bezeichnung, Objektart ("Produkt"), Teil von ("1 - Projekte"), Hersteller (aus Extradaten).

### Kuerzelliste (aus der hochgeladenen Excel-Datei)

Die Kuerzelliste wird fest im Code hinterlegt und mappt Komponentennamen auf Abkuerzungen:
- Technikzentrale -> TZ
- BHKW -> BHKW
- Waermepumpe -> WP
- Gaskessel -> GK
- Pufferspeicher -> PS
- Wechselrichter -> WR
- usw.

### Technische Aenderungen

#### 1. Neue Datei: `src/data/mopAbbreviations.ts`

Enthaelt die Kuerzelliste als Lookup-Map und eine Funktion, die den besten Match fuer einen Komponentennamen findet.

```
ABBREVIATIONS = {
  "Waermenetz": "WN",
  "Technikzentrale": "TZ",
  "BHKW": "BHKW",
  "Gaskessel": "GK",
  "Pufferspeicher": "PS",
  ...
}
```

#### 2. Neue Datei: `src/lib/mopCsvExport.ts`

Kernlogik fuer den CSV-Export. Erhaelt als Parameter:
- Projektnummer (aus Projektname extrahiert)
- Strasse (separates Eingabefeld)
- Bereich (Energielieferung / Fernwaermeoptimierung / Energiemonitoring)
- Status (Realisierung / Betrieb / Beendet)
- Trennzeichen (auswaehlbar: Semikolon oder Komma)
- Komponenten-Daten aus der Stueckliste (Name, Menge, Marke/Hersteller)

Erzeugt eine CSV-Datei mit folgenden Spalten (pro Zeile = ein Objekt in M.O.P):
- Ebene (Hierarchie-Tiefe)
- Objektnummer
- Objektsymbol (z.B. ObjektSymbol 8)
- Bezeichnung
- Objektart
- Teil_von
- Hersteller (nur bei Komponenten)
- Kuerzel

Die Hierarchie wird flach als nummerierte Zeilen abgebildet.

#### 3. Neue Datei: `src/components/schematic/MopExportDialog.tsx`

Ein Dialog mit folgenden Eingabefeldern:
- **Projektnummer**: Wird automatisch aus dem Projektnamen extrahiert (editierbar)
- **Strasse/Adresse**: Eingabefeld
- **Bereich**: Dropdown mit Energielieferung, Fernwaermeoptimierung, Energiemonitoring
- **Status**: Dropdown mit Realisierung, Betrieb, Beendet
- **Trennzeichen**: Dropdown mit Semikolon, Komma, Tab
- Vorschau der ersten Zeilen

Button "CSV exportieren" loest den Download aus.

#### 4. Aenderung: `src/components/schematic/ExportGroupDialog.tsx`

- Neuer Checkbox-Eintrag "M.O.P Import (CSV)" neben Zeichnung, Stueckliste, Messkonzept
- Wenn aktiviert, wird beim Exportieren der MopExportDialog geoeffnet

#### 5. Aenderung: `src/components/schematic/HeaderActions.tsx`

- Tooltip von "Zeichnung exportieren (E)" zu "Exportieren (E)" aendern

#### 6. Aenderung: `src/components/schematic/SchematicEditor.tsx`

- MopExportDialog einbinden und State verwalten
- Stuecklisten-Daten (tiles, projectMarken etc.) an den neuen Dialog weitergeben

### Zusammenfassung der Dateien

| Datei | Aenderung |
|---|---|
| `src/data/mopAbbreviations.ts` | Neue Datei - Kuerzelliste als Map |
| `src/lib/mopCsvExport.ts` | Neue Datei - CSV-Generierungslogik |
| `src/components/schematic/MopExportDialog.tsx` | Neue Datei - Export-Dialog mit Eingabefeldern |
| `src/components/schematic/ExportGroupDialog.tsx` | CSV-Checkbox hinzufuegen |
| `src/components/schematic/HeaderActions.tsx` | Tooltip umbenennen |
| `src/components/schematic/SchematicEditor.tsx` | MopExportDialog integrieren |

