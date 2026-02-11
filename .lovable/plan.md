
# Fix: Auto-Verbindungslinien enden nicht korrekt an Komponenten-Boxen

## Problem

Die gestrichelten Auto-Verbindungslinien enden teilweise nicht an den tatsaechlichen Koerperkanten der Zielkomponenten. Ursachen:

1. **Fehlende Polygon-/Polyline-Unterstuetzung in `getShapeBounds`**: Die Funktion berechnet Grenzen nur ueber `shape.x + shape.width`, ignoriert aber `shape.points`-Arrays bei Polygonen/Polylines, deren visuelle Grenzen davon abweichen koennen.

2. **Endpunkte werden durch Spreading ausserhalb der Koerper verschoben**: Der Spreizungs-Algorithmus (Zeilen 901-930) verschiebt `toX` und `fromY` um feste Offsets, ohne zu pruefen, ob der Punkt noch innerhalb der Komponentengrenzen liegt.

3. **Fester `endpointOffset` statt kantenbasierter Berechnung**: Der Endpunkt wird pauschal um 0.15 Grid-Einheiten vom Zentrum verschoben, anstatt exakt an der Koerperkante zu landen.

---

## Technische Aenderungen

### Datei: `src/components/schematic/SchematicEditor.tsx`

**1. `getShapeBounds` erweitern (Zeilen 767-792)**

Polygon- und Polyline-Shapes mit `points`-Arrays korrekt beruecksichtigen:

```text
for (const shape of boundaryShapes) {
  if ((shape.type === 'polygon' || shape.type === 'polyline') && shape.points?.length) {
    for (const p of shape.points) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
  } else {
    minX = Math.min(minX, shape.x);
    maxX = Math.max(maxX, shape.x + shape.width);
    minY = Math.min(minY, shape.y);
    maxY = Math.max(maxY, shape.y + shape.height);
  }
}
```

**2. Endpunkte an Koerperkanten clampen (nach Zeile 873)**

Nach der Berechnung von `toX`/`toY` auf die tatsaechlichen Koerpergrenzen der Zielkomponente begrenzen:

```text
// Clamp toX auf die tatsaechlichen Koerpergrenzen
const targetLeft = labeledTile.gridX + labelBounds.minX;
const targetRight = labeledTile.gridX + labelBounds.maxX;
toX = Math.max(targetLeft, Math.min(targetRight, toX));
```

**3. Startpunkte clampen (nach Zeile 849)**

Ebenso `fromY`/`fromX` auf die Quellkomponenten-Grenzen begrenzen:

```text
// Clamp fromY auf Quellkomponenten-Grenzen
const autoTop = autoTile.gridY + autoBounds.minY;
const autoBottom = autoTile.gridY + autoBounds.maxY;
fromY = Math.max(autoTop, Math.min(autoBottom, fromY));

// Clamp fromX analog
const autoLeft = autoTile.gridX + autoBounds.minX;
const autoRight = autoTile.gridX + autoBounds.maxX;
fromX = Math.max(autoLeft, Math.min(autoRight, fromX));
```

**4. Spreading-Ergebnisse ebenfalls clampen (nach Zeilen 907 und 927)**

Nach dem Spreading-Algorithmus die verschobenen Endpunkte nochmals auf die jeweiligen Komponentengrenzen begrenzen. Dafuer muessen die Bounds pro Ziel-Tile in einer Map zwischengespeichert werden, damit sie nach dem Spreading verfuegbar sind.

---

## Zusammenfassung

| Stelle | Aenderung |
|--------|-----------|
| `getShapeBounds` | Polygon/Polyline `points`-Arrays einbeziehen |
| Start-Endpunkt | `fromX`/`fromY` auf Quell-Bounds clampen |
| Ziel-Endpunkt | `toX`/`toY` auf Ziel-Bounds clampen |
| Spreading | Nach Versatz erneut auf Bounds clampen |

Nur eine Datei betroffen: `src/components/schematic/SchematicEditor.tsx` (autoConnectionLines useMemo, Zeilen 747-933).
