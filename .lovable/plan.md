

## Plan: Pfeile an Kreuzungen + Text-Verbesserungen

### Problem 1: Pfeile an Kreuzungen nicht setzbar

**Ursache**: `findConnectionAtPosition()` prüft nur die `from`- und `to`-Endpunkte jeder Verbindung. An einer Kreuzung (z.B. `connection-cross`) treffen sich Verbindungen, aber ihre Endpunkte liegen auf den anliegenden Zellen, nicht auf der Kreuzungszelle selbst. Daher findet das Arrow-Tool dort keine Verbindung.

**Lösung**: `findConnectionAtPosition()` erweitern, um auch Verbindungen zu finden, die **durch** eine Zelle hindurchgehen. Wenn eine Verbindung von Zelle A nach Zelle B geht und die Zielzelle direkt an der Kreuzung angrenzt, muss die Kreuzungszelle als gültige Position erkannt werden. Konkret:
- Prüfen ob die geklickte Zelle zwischen `from` und `to` einer Verbindung liegt (bei orthogonalen Verbindungen: gleiche Zeile/Spalte und zwischen den Endpunkten)
- Bei einer Kreuzung mit mehreren Verbindungen: Alle passenden Verbindungen finden und dem Nutzer die Wahl ermöglichen (z.B. durch zyklisches Durchschalten oder eine Liste)
- Alternative einfachere Lösung: Wenn auf eine Kachel mit Verbindungsblock geklickt wird, alle Verbindungen finden die an dieser Kachel angeschlossen sind (from/to TileId), und zyklisch durchschalten

### Problem 2: Text-Bausteine per Klick verschieben

**Aktuell**: Text kann nur im Select-Modus per Drag verschoben werden (mouseDown + mousMove).

**Lösung**: Im Select-Modus soll ein einzelner Klick auf einen Text-Baustein diesen auswählen und in einen "Move-Modus" versetzen. Der Text folgt dann dem Mauszeiger bis zum nächsten Klick, der die neue Position bestätigt.

### Problem 3: Mehrzeilige Texte mit Leertaste/Enter

**Aktuell**: Das Textfeld ist ein `<input>` (einzeilig), Enter bestätigt den Text.

**Lösung**: 
- `<input>` durch `<textarea>` ersetzen
- Enter erzeugt eine neue Zeile
- Shift+Enter oder Escape bestätigt/schließt den Text
- SVG-`<text>` Rendering anpassen: Mehrzeilige Texte mit `<tspan>` pro Zeile rendern (Zeilenumbruch bei `\n`)

### Technische Änderungen

**Datei: `src/components/schematic/Canvas.tsx`**

1. **`findConnectionAtPosition`** erweitern: Zusätzlich prüfen ob an der geklickten Grid-Position eine Verbindungsblock-Kachel liegt und alle Verbindungen finden, die diese Kachel als fromTileId oder toTileId referenzieren
2. **Arrow-Tool Handler**: Bei mehreren gefundenen Verbindungen an einer Position zyklisch durchschalten (State für letzten Arrow-Toggle-Index)
3. **Text-Input**: `<input>` → `<textarea>`, Enter für Zeilenumbruch, Shift+Enter oder Ctrl+Enter zum Bestätigen
4. **Text-Rendering**: SVG `<text>` mit `<tspan>` Elementen für mehrzeilige Darstellung (split by `\n`)
5. **Text-Click-to-Move**: Im Select-Modus bei Klick auf Text: Wenn bereits ausgewählt, in Move-Modus wechseln; Text folgt Maus bis zum nächsten Klick

**Datei: `src/components/schematic/GroupPreview.tsx`** (falls Text dort auch gerendert wird)
- Gleiches mehrzeiliges Text-Rendering

