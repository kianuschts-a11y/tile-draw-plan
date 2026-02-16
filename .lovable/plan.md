

## Drei Verbesserungen

### 1. Text nachtraeglich bearbeiten (Textinhalt aendern)

Aktuell koennen Farbe und Schriftgroesse eines ausgewaehlten Textes geaendert werden, aber nicht der Textinhalt selbst. 

**Loesung:** Im "Text bearbeiten"-Panel in der Toolbar (das erscheint wenn ein Text im Select-Modus ausgewaehlt ist) wird ein Eingabefeld fuer den Textinhalt hinzugefuegt. Die `onAnnotationTextUpdate`-Funktion wird erweitert, um auch `text`-Aenderungen zu unterstuetzen.

**Aenderungen:**
- `Toolbar.tsx`: Ein Input-Feld im "Text bearbeiten"-Panel hinzufuegen. Die `selectedAnnotationText`-Prop um `text: string` erweitern.
- `SchematicEditor.tsx`: Die `selectedAnnotationText`-Berechnung um `text` erweitern. Die `handleAnnotationTextUpdate`-Funktion akzeptiert bereits generische Updates, muss nur den Typ erweitern.

### 2. Auswahl-Markierung aus Export entfernen

Aktuell wird die blaue Auswahl-Hervorhebung (Hintergrundfarbe und Rahmen) von selektierten Tiles mit exportiert, weil der Export den SVG-Zustand klont ohne die Selektion zurueckzusetzen.

**Loesung:** Vor dem Export die Selektion leeren ODER im geklonten SVG die Selektions-Elemente entfernen. Am einfachsten: Vor dem Export `selectedTileIds` und `selectedAnnotationId` leeren. Alternativ: Im Export-Code die Selektions-Highlights im geklonten SVG zuruecksetzen.

**Aenderungen:**
- `SchematicEditor.tsx`: In `handleExport` und `handleExportPdf` vor dem SVG-Klonen die Selektion leeren (`setSelectedTileIds(new Set())` und `setSelectedAnnotationId(null)`). Da der Export asynchron ist (Image-Loading), reicht ein State-Update vor dem Clone nicht. Stattdessen: Im geklonten SVG alle Tile-Hintergrund-Rects zuruecksetzen - die mit `hsl(var(--primary) / 0.1)` als Fill und `hsl(var(--primary))` als Stroke. Ausserdem die gestrichelten Selektions-Rechtecke der Annotationen entfernen.

### 3. "Projekt speichern" Option beim Gruppe-Erstellen

Im Gruppen-Modus (Toolbar) gibt es aktuell nur die Option "Gruppe erstellen". Zusaetzlich soll ein "Als Projekt speichern"-Button erscheinen.

**Aenderungen:**
- `Toolbar.tsx`: Im Gruppen-Modus-Panel einen zusaetzlichen "Projekt speichern"-Button hinzufuegen. Neue Prop `onSaveProject: (name: string) => void` hinzufuegen.
- `SchematicEditor.tsx`: Eine `handleSaveProjectFromToolbar`-Funktion erstellen, die die aktuelle Zeichnung als Projekt speichert (gleiche Logik wie `handleSaveProjectAndExportImage`, aber ohne Export). Diese Funktion an die Toolbar weitergeben.

---

### Technische Details

**Dateien die geaendert werden:**

1. **`src/components/schematic/Toolbar.tsx`**
   - `selectedAnnotationText` Typ erweitern um `text: string`
   - Input-Feld im "Text bearbeiten"-Panel fuer Textinhalt
   - `onAnnotationTextUpdate` Typ erweitern: `{ color?: string; fontSize?: number; text?: string }`
   - Neue Prop `onSaveProject: (name: string) => void`
   - Im Gruppen-Panel einen zweiten Button "Projekt speichern"

2. **`src/components/schematic/SchematicEditor.tsx`**
   - `selectedAnnotationText` Berechnung um `text` erweitern
   - `handleAnnotationTextUpdate` Typ erweitern um `text`
   - Export-Funktionen: Im geklonten SVG Selektions-Highlights entfernen (Tile-Hintergruende auf neutral setzen, Annotations-Selektionsrahmen entfernen)
   - Neue Funktion `handleSaveProjectFromToolbar` fuer Projekt-Speicherung ohne Export

3. **`src/components/schematic/Canvas.tsx`**
   - Tile-Selektions-Hintergruende und Annotations-Selektionsrahmen mit `data-export-ignore` markieren, damit sie im Export zuverlaessig entfernt werden

