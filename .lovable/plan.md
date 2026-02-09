
# Plan: Auto-Verbindungslinien Optimierung + Annotationsebene (Linien & Text)

## Zusammenfassung

Drei Aufgaben werden umgesetzt:

1. **Überlappende Auto-Verbindungslinien verhindern** -- Die gestrichelten Auto-Verbindungslinien werden dedupliziert, damit keine Linien auf identischen Pfaden doppelt gezeichnet werden.

2. **Freie Markierungslinien** -- Neue Werkzeuge zum Zeichnen von Linien auf dem Canvas, die nicht an Komponenten gebunden sind und rein zur Bereichsmarkierung dienen. Verschiedene Linienstile waehlbar (durchgezogen, gestrichelt, gepunktet, strich-punkt).

3. **Freie Textfelder** -- Positionierbare Textfelder auf dem Canvas mit aenderbarer Schriftgroesse.

Sowohl Markierungslinien als auch Textfelder liegen auf einer separaten **Annotationsebene** und haben keinen Einfluss auf die Zeichenebene (keine Interaktion mit Verbindungen, Stuckliste oder Messkonzept).

---

## Technische Details

### 1. Ueberlappende Auto-Verbindungslinien verhindern

**Datei:** `src/components/schematic/SchematicEditor.tsx` (Zeilen 621-767)

Das bestehende `autoConnectionLines` useMemo berechnet fuer jede Auto-Connect-Komponente Linien zu allen beschrifteten Komponenten. Wenn z.B. zwei Quellkomponenten dieselbe Zielkomponente verbinden, koennen Liniensegmente uebereinanderliegen.

**Loesung:** Nach Berechnung aller Linien wird ein Deduplizierungs-Schritt eingefuegt:
- Jedes Liniensegment (horizontal oder vertikal) wird auf einen Schluessel normalisiert (gerundete Koordinaten + Richtung)
- Segmente, die auf demselben Pfad liegen (gleiche Achse, ueberlappender Bereich), werden erkannt
- Bei Ueberlappung wird nur ein Segment behalten, oder die ueberlappenden Segmente werden leicht versetzt (Y-Offset fuer horizontale, X-Offset fuer vertikale Segmente)
- Der Versatz-Algorithmus nutzt den bestehenden `offsetStep`-Mechanismus und erweitert ihn auf Mid-/Endpunkte

### 2. Neue Typen fuer Annotationsebene

**Datei:** `src/types/schematic.ts`

Neue Interfaces hinzufuegen:

```text
AnnotationLine {
  id: string
  fromX: number (Grid-Koordinaten)
  fromY: number
  toX: number
  toY: number
  color: string
  strokeWidth: number
  lineStyle: 'solid' | 'dashed' | 'dotted' | 'dash-dot'
}

AnnotationText {
  id: string
  x: number (Grid-Koordinaten)
  y: number
  text: string
  fontSize: number
  color: string
  fontWeight?: 'normal' | 'bold'
}
```

### 3. Neue Toolbar-Werkzeuge

**Datei:** `src/components/schematic/Toolbar.tsx`

- `MainToolType` erweitern um `'annotate-line' | 'annotate-text'`
- Zwei neue `ToolButton`-Eintraege unterhalb einer neuen Separator-Linie:
  - **Markierungslinie** (Icon: `Minus` oder `Pencil`) -- Shortcut: `L`
  - **Textfeld** (Icon: `Type`) -- Shortcut: `T`
- Bei aktivem Linien-Tool: Popover fuer Linientyp-Auswahl (4 Stile: durchgezogen, gestrichelt, gepunktet, strich-punkt) und Farbauswahl
- Bei aktivem Text-Tool: Popover fuer Schriftgroesse-Einstellung (Slider oder Eingabefeld)

### 4. State-Management fuer Annotationen

**Datei:** `src/components/schematic/SchematicEditor.tsx`

Neuer State:
- `annotationLines: AnnotationLine[]`
- `annotationTexts: AnnotationText[]`
- `annotationLineStyle: 'solid' | 'dashed' | 'dotted' | 'dash-dot'`
- `annotationColor: string` (Standard: '#000000')
- `annotationFontSize: number` (Standard: 14)

Diese werden als Props an Canvas weitergereicht. Die Annotations-Daten werden NICHT in die Undo/Redo-History der Zeichnung einbezogen (separate Ebene), koennen aber optional spaeter hinzugefuegt werden.

**Wichtig:** Annotationen haben keinen Einfluss auf:
- `generateSingleConnectionLine` (connectionUtils.ts)
- Auto-Verbindungslinien-Berechnung
- Stuckliste (BOM)
- Messkonzept
- Gruppen-Erstellung

### 5. Canvas-Interaktion fuer Annotationen

**Datei:** `src/components/schematic/Canvas.tsx`

**Markierungslinien zeichnen:**
- Bei `activeTool === 'annotate-line'`: MouseDown setzt Startpunkt, MouseMove zeigt Preview-Linie, MouseUp setzt Endpunkt und erstellt die Annotation
- Linien werden frei positioniert (nicht an Grid-Zellen gebunden, aber optional snapping)
- Rendering als SVG `<line>` mit entsprechendem `strokeDasharray` je nach Linienstil

**Textfelder platzieren:**
- Bei `activeTool === 'annotate-text'`: Click auf Canvas oeffnet ein Inline-Eingabefeld (foreignObject oder positioniertes HTML-Input)
- Nach Enter oder Blur wird der Text als `AnnotationText` gespeichert
- Im Canvas als SVG `<text>` gerendert mit konfigurierbarer Schriftgroesse

**Annotationsebene rendern:**
- Neue SVG-Gruppe `{/* Annotationsebene */}` die NACH den Tiles aber VOR den UI-Elementen (Selection Box, Path Preview) gerendert wird
- Annotationen werden beim Export (PNG/PDF) mit exportiert
- Annotationen sind im Select-Modus auswaehlbar und verschiebbar (aehnlich wie Tiles, aber unabhaengig)

### 6. Export-Integration

**Datei:** `src/components/schematic/SchematicEditor.tsx`

- PNG-Export: Annotationen werden automatisch mit gerendert (da sie im SVG sind)
- PDF-Export: Annotationen werden mit exportiert
- Annotationen werden NICHT in Gruppen gespeichert
- Annotationen haben keinen Einfluss auf die Stuckliste oder das Messkonzept

### 7. Annotations-Auswahl und Bearbeitung

- Im Select-Modus koennen Annotations angeklickt und verschoben werden
- Delete-Taste loescht ausgewaehlte Annotations
- Doppelklick auf Text oeffnet Bearbeitungsmodus
- Schriftgroesse kann per Popover oder Kontextmenue geaendert werden

---

## Aenderungs-Uebersicht

| Datei | Aenderung |
|-------|-----------|
| `src/types/schematic.ts` | Neue Interfaces `AnnotationLine`, `AnnotationText` |
| `src/components/schematic/Toolbar.tsx` | Neue Tools `annotate-line`, `annotate-text` mit Stil-/Groessen-Optionen |
| `src/components/schematic/SchematicEditor.tsx` | Neuer State fuer Annotationen, Deduplizierung der Auto-Verbindungslinien, Props an Canvas |
| `src/components/schematic/Canvas.tsx` | Rendering der Annotationsebene, Mouse-Interaktion fuer Linien-/Text-Erstellung, Auswahl/Verschieben |

