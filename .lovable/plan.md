

## Plan: Text-Interaktion ändern + Gruppen-Daten vollständig speichern

### 1. Text-Verschiebung: Drag statt Click-to-Move

**Aktuell**: Erster Klick wählt aus, zweiter Klick aktiviert "Move-Modus" (Text folgt Cursor), dritter Klick platziert.

**Neu**: Standard-Drag-Verhalten im Select-Modus:
- Klick auf Text = auswählen
- Maustaste gedrückt halten + ziehen = Text verschieben
- Doppelklick = Text bearbeiten (Textarea öffnet sich mit bestehendem Text)
- `movingAnnotationId`-Logik entfernen, stattdessen bestehendes `isDraggingAnnotation` nutzen

**Änderungen in `Canvas.tsx`**:
- `onMouseDown` auf Text: Auswählen + Drag starten (wie bisher bei erstem Klick)
- Zweiter-Klick-Move-Logik komplett entfernen
- `onDoubleClick` auf Text: Textarea mit bestehendem Text öffnen, nach Bestätigung Text aktualisieren statt neu erstellen
- State `movingAnnotationId` entfernen

### 2. Text-Eingabe: Enter bestätigt, Shift+Enter neue Zeile

**Aktuell**: Enter = neue Zeile, Shift+Enter = bestätigen

**Neu**: Umkehren:
- Enter = Text bestätigen
- Shift+Enter = neue Zeile einfügen

**Änderung in `Canvas.tsx`**: `onKeyDown`-Handler im textarea anpassen.

### 3. Gruppen: arrowDirection mitspeichern

**Problem**: `GroupConnectionData` hat kein `arrowDirection`-Feld. Beim Speichern geht die Pfeilrichtung verloren.

**Änderungen**:
- **`src/types/schematic.ts`**: `arrowDirection` zu `GroupConnectionData` hinzufügen
- **`src/components/schematic/SchematicEditor.tsx`**: Beim Erstellen von `connectionData` auch `arrowDirection: conn.arrowDirection` mitspeichern (an beiden Stellen: `handleSaveGroup` und `handleCreateGroupFromAllTiles`)
- **Beim Platzieren einer Gruppe**: `arrowDirection` aus `GroupConnectionData` wiederherstellen

### 4. Prüfung weiterer fehlender Daten bei Gruppen-Speicherung

Vollständige Prüfung der `CellConnection`-Felder vs. `GroupConnectionData`:
- `color` ✅ wird bereits gespeichert
- `arrowDirection` ❌ fehlt → wird hinzugefügt

Alle anderen Felder (fromTileIndex, fromCellX/Y, fromSide, toTileIndex, toCellX/Y, toSide) werden korrekt gemappt.

### Technische Änderungen

| Datei | Änderung |
|-------|----------|
| `src/types/schematic.ts` | `arrowDirection?: 'none' \| 'forward' \| 'backward'` zu `GroupConnectionData` |
| `src/components/schematic/SchematicEditor.tsx` | `arrowDirection` in beiden Group-Save-Funktionen mitspeichern + beim Platzieren wiederherstellen |
| `src/components/schematic/Canvas.tsx` | Text: Drag-to-move statt Click-to-move, Doppelklick für Bearbeitung, Enter/Shift+Enter tauschen |

