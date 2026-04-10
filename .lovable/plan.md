

## Plan: Multi-Sheet Support (Zeichenblatt hinzufügen)

### Kernkonzept

Jedes Blatt ist eigenständig — eigene Tiles, eigene Connections, eigene Auto-Verbindungen, eigener Zeichenkopf. Blätter werden nebeneinander auf dem Canvas dargestellt.

### Datenmodell

**Neuer State in `SchematicEditor.tsx`:**
- `sheetCount: number` (startet bei 1)
- `titleBlockDataPerSheet: TitleBlockData[]` — Array mit einem TitleBlockData pro Blatt, jedes mit eigenem `blattNr` und `blattzahl`
- `editingSheetIndex: number` — welches Blatt im TitleBlockEditor bearbeitet wird

**Blatt-Zuordnung von Tiles:**
- Tiles behalten ihre `gridX`/`gridY`-Koordinaten
- Blatt eines Tiles wird berechnet: `sheetIndex = Math.floor(tile.gridX / gridCols)`
- Blatt 2 startet bei `gridX = gridCols`, Blatt 3 bei `gridX = 2 * gridCols`

### Änderungen pro Datei

**1. `PaperSettings.tsx`**
- Neue Props: `sheetCount`, `onSheetCountChange`
- UI: Neben den Kachel-Einstellungen ein "+/−"-Button-Paar mit Anzeige "1 Blatt" / "2 Blätter"
- Minus nur aktiv wenn `sheetCount > 1`

**2. `Canvas.tsx`**
- Prop: `sheetCount` hinzufügen
- Paper-Background, Grid und TitleBlock in einer Schleife `for i in 0..sheetCount-1` rendern, jeweils um `i * (gridCols * tileSize + GAP)` nach rechts verschoben (GAP ~20px)
- `getGridFromCanvas` und `canPlaceTile` erweitern: erlaubter X-Bereich = `0` bis `sheetCount * gridCols + (sheetCount-1) * gapCols`
- Tile-Placement muss den Gap-Bereich aussparen (kein Platzieren im Zwischenraum)

**3. `SchematicEditor.tsx` — Auto-Verbindungen**
- `autoConnectionLines` useMemo: Tiles nach Sheet gruppieren (`Math.floor(gridX / gridCols)`)
- Nur Tiles auf dem gleichen Sheet verbinden — keine blattübergreifenden Auto-Verbindungen

**4. `SchematicEditor.tsx` — Zentrierlogik (`handleResetView`)**
- Gesamtbreite = `sheetCount * paperWidthPx + (sheetCount - 1) * GAP`
- Zoom und Pan auf diese Gesamtbreite berechnen

**5. `SchematicEditor.tsx` — Export PNG (`handleExport`)**
- ViewBox erweitern auf Gesamtbreite aller Blätter inkl. Gaps
- Ein PNG mit allen Blättern nebeneinander

**6. `SchematicEditor.tsx` — Export PDF (`handleExportPdf`)**
- Pro Blatt eine eigene PDF-Seite
- SVG-Clone pro Blatt mit `viewBox` auf den jeweiligen Blattbereich clippen
- BOM/Messkonzept als weitere Seiten am Ende

**7. `TitleBlockEditor.tsx` — Blattauswahl**
- Neue Props: `sheetCount`, `activeSheetIndex`, `onSheetIndexChange`, `allSheetData: TitleBlockData[]`
- Wenn `sheetCount > 1`: Oben im Dialog eine Auswahl (Tabs oder ToggleGroup) "Blatt 1 | Blatt 2 | ..."
- Beim Wechsel wird das aktive Blatt umgeschaltet und die Felder zeigen die Daten des gewählten Blattes
- `onSave` gibt den `sheetIndex` mit zurück

**8. `types/schematic.ts`**
- Keine Änderung nötig — `TitleBlockData` hat bereits `blattNr` und `blattzahl`

### Eigenständigkeit der Blätter

| Feature | Blattübergreifend? |
|---|---|
| Tile-Placement | Nein — Tiles gehören zu einem Blatt |
| CellConnections | Ja erlaubt (gleicher Canvas), aber Auto-Verbindungen nur innerhalb |
| Auto-Verbindungen | Nein — nur innerhalb eines Blattes |
| Zeichenkopf | Eigenständig pro Blatt (eigene Felder, automatische Nummerierung) |
| BOM | Über alle Blätter aggregiert |
| Export | PNG: alle nebeneinander, PDF: ein Blatt pro Seite |

