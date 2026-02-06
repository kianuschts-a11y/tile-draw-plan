

# Export-Dialog verbessern: Bild & interaktive PDF

## Zusammenfassung

Der aktuelle Export-Dialog wird erweitert um:
1. **Verbessertes Eingabefeld** fur den Gruppennamen
2. **Auswahl des Exportformats**: Bild (PNG) oder PDF
3. **Interaktive PDF**: Komponenten sind anklickbar und zeigen Informationen wie Hersteller, Modell und technische Daten (wie in der Stuckliste)

---

## Ablauf fur den Benutzer

1. Benutzer klickt "Exportieren" oder druckt `E`
2. Der verbesserte Dialog erscheint mit:
   - Optional: Zeichnung als Gruppe speichern (Gruppenname-Eingabe)
   - **Formatauswahl**: Bild (PNG) oder PDF
3. Bei **Bild**: Export wie bisher als PNG
4. Bei **PDF**: 
   - Seite 1: Die Zeichnung als Vektorgrafik
   - Jede Komponente in der Zeichnung ist mit einem unsichtbaren Link hinterlegt
   - Seite 2+: Stuckliste mit allen Komponenteninformationen (Pos., Name, Kategorie, Marke, Modell, Menge, Preis)
   - Klick auf eine Komponente in der Zeichnung springt zur entsprechenden Zeile in der Stuckliste

---

## Technische Details

### 1. Neue Abhangigkeit: `jspdf`
- `jspdf` wird als Dependency hinzugefugt fur die PDF-Erzeugung
- Keine weiteren externen Abhangigkeiten notig (SVG wird als Bild eingebettet)

### 2. Datei: `src/components/schematic/ExportGroupDialog.tsx` (Uberarbeitung)

**Neue Props:**
- `onExportImage: () => void` - Export als PNG
- `onExportPdf: () => void` - Export als PDF
- `onSaveGroupAndExportImage: (name: string) => void`
- `onSaveGroupAndExportPdf: (name: string) => void`

**UI-Anderungen:**
- Gruppenname-Bereich wird kompakter gestaltet mit Checkbox statt separatem Bereich
- Neuer Abschnitt "Exportformat" mit zwei grossen, klar erkennbaren Optionskarten:
  - **Bild (PNG)**: Icon + kurze Beschreibung
  - **PDF (interaktiv)**: Icon + Beschreibung ("Komponenten anklickbar mit Herstellerinformationen")
- Zwei Aktions-Buttons am Ende: "Exportieren" (abhangig vom gewahlten Format) und optional "Als Gruppe speichern & exportieren"

### 3. Datei: `src/components/schematic/SchematicEditor.tsx` (Erweiterung)

**Neue Funktion `handleExportPdf`:**
- Klont das SVG wie beim Bild-Export
- Rendert es auf ein Canvas und erzeugt ein Bild
- Erstellt ein PDF im gewahlten Papierformat (A4, A3, etc.) mit `jspdf`
- Seite 1: Zeichnung als eingebettetes Bild
  - Fur jede platzierte Komponente (kein Verbindungsblock) wird ein unsichtbarer Link-Bereich uber der Position erstellt, der auf die Stucklisten-Seite verweist
- Seite 2: Stuckliste als Tabelle
  - Spalten: Pos., Komponente, Kategorie, Marke, Modell, Menge, Preis, Gesamt
  - Jede Zeile hat einen benannten Anker, auf den die Links von Seite 1 verweisen
  - Gesamtkosten am Ende

**Angepasste Callback-Funktionen:**
- `handleSaveGroupAndExport` wird aufgeteilt in `handleSaveGroupAndExportImage` und `handleSaveGroupAndExportPdf`
- `handleExportOnly` wird aufgeteilt in `handleExportImageOnly` und `handleExportPdfOnly`

### 4. Datei: `src/components/schematic/HeaderActions.tsx` (keine Anderung notig)
- Der bestehende Export-Button offnet weiterhin den Dialog

---

## PDF-Struktur im Detail

```text
+----------------------------------+
|          SEITE 1: ZEICHNUNG      |
|                                  |
|   +------+    +------+           |
|   | Komp |----| Komp |           |
|   |  A   |    |  B   |           |
|   +------+    +------+           |
|       |                          |
|   [Klickbare Bereiche uber       |
|    jeder Komponente -> Seite 2]  |
|                                  |
+----------------------------------+

+----------------------------------+
|       SEITE 2: STUCKLISTE        |
|                                  |
|  Projekt: [Name]                 |
|  Datum: [Datum]                  |
|                                  |
|  Pos | Name | Kat. | Marke |...  |
|  ----|------|------|-------|---- |
|   1  | A    | ...  | ...   |...  |
|   2  | B    | ...  | ...   |...  |
|                                  |
|  Gesamt: X Teile, Y.YY Euro     |
+----------------------------------+
```

---

## Dateien die erstellt/geandert werden

| Datei | Aktion |
|-------|--------|
| `src/components/schematic/ExportGroupDialog.tsx` | Komplett uberarbeiten - neues Layout mit Formatauswahl |
| `src/components/schematic/SchematicEditor.tsx` | Neue `handleExportPdf` Funktion + angepasste Callbacks |
| `package.json` | `jspdf` als Dependency hinzufugen |

