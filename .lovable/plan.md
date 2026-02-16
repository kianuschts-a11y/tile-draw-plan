
## Dreieck-Anschluss-Problem beheben

### Ursache

Dreiecke in Komponenten verwenden eine `rotation`-Eigenschaft (z.B. 180°, 270°), um ihre Ausrichtung zu bestimmen. Die SVG-Darstellung dreht das Dreieck korrekt ueber ein `transform="rotate(...)"`. Jedoch ignoriert die Anschlusslinien-Berechnung in `connectionUtils.ts` die `rotation`-Eigenschaft komplett. Sie versucht stattdessen die Ausrichtung anhand des Breite/Hoehe-Verhaeltnisses zu erraten - was fast immer falsch ist.

Das fuehrt dazu, dass die Anschlusslinie an der falschen Kante stoppt oder durch das Dreieck hindurchgeht.

### Loesung

Die Funktion `getShapeEdges` in `connectionUtils.ts` wird so angepasst, dass sie bei Dreiecken (und allen anderen Formen) die `rotation`-Eigenschaft beruecksichtigt:

1. Die Dreieck-Punkte werden immer als "Spitze oben, Basis unten" definiert (wie in der SVG-Darstellung)
2. Falls `shape.rotation` gesetzt ist, werden alle Kantenpunkte um den Mittelpunkt der Shape rotiert
3. Dies gilt universell fuer alle Shape-Typen mit Rotation

### Technische Aenderung

**Datei: `src/lib/connectionUtils.ts`**

- Neue Hilfsfunktion `rotatePoint(px, py, cx, cy, angleDeg)` die einen Punkt um einen Mittelpunkt dreht
- Am Ende von `getShapeEdges`: Falls `shape.rotation` gesetzt ist, werden alle Kantenpunkte durch `rotatePoint` transformiert
- Der bisherige Code fuer Dreiecke wird vereinfacht: Keine Orientierungserkennung ueber Seitenverhaeltnis mehr, immer "Spitze oben" als Basis, Rotation uebernimmt die korrekte Ausrichtung
- Die Funktion bekommt den `rotation`-Parameter aus dem Shape-Objekt

### Betroffene Dateien

| Datei | Aenderung |
|---|---|
| `src/lib/connectionUtils.ts` | `rotatePoint` Hilfsfunktion hinzufuegen; `getShapeEdges` vereinfachen und Rotation auf alle Kanten anwenden |
