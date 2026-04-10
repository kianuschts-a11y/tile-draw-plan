

## Plan: "Verbindung lösen" — Gesamte Linie in gewählter Richtung entfernen

### Problem

Aktuell entfernt das Disconnect-Tool nur die `CellConnection`-Objekte zwischen den ausgewählten Zellen. Die Verbindungsblock-Kacheln (horizontale Linien, Kreuzungen, T-Stücke etc.) bleiben dabei unverändert stehen.

### Gewünschtes Verhalten

1. **Richtung erkennen**: Aus dem ausgewählten Pfad die Hauptrichtung(en) bestimmen (horizontal, vertikal, oder beides bei 90°-Ecken)
2. **Verbindungsblöcke anpassen**: Alle im Pfad liegenden Verbindungsblöcke entweder:
   - **Entfernen** (wenn sie nur diese Richtung haben, z.B. horizontale Linie bei horizontalem Löschen)
   - **Downgraden** (z.B. Kreuzung → vertikale Linie, T-Stück → gerade Linie oder Ecke)
3. **Connections entfernen**: Alle `CellConnection`-Objekte entfernen, die zur gelöschten Richtung gehören

### Beispiel aus den Bildern

- Horizontale Linie kreuzt eine vertikale Linie (Kreuzungsblock)
- Nutzer wählt die gesamte horizontale Strecke (links nach rechts über die Kreuzung)
- Ergebnis: Horizontale Blöcke werden entfernt, Kreuzung wird zu vertikaler Linie, vertikale Verbindungen bleiben bestehen

### Szenarien

| Ausgewählt | Block-Typ | Aktion |
|---|---|---|
| Horizontal | Horizontal | Entfernen |
| Horizontal | Kreuzung (┼) | Downgrade → Vertikal |
| Horizontal | T-Stück (┬/┴) | Downgrade → Vertikal |
| Horizontal | T-Stück (├/┤) | Downgrade → Ecke |
| Vertikal | Vertikal | Entfernen |
| Vertikal | Kreuzung | Downgrade → Horizontal |
| 90° Ecke | Ecke | Entfernen |
| 90° L-Pfad | Horizontale + vertikale Segmente | Beide Richtungen pro Segment verarbeiten |

### Technische Änderung

**Datei: `src/components/schematic/Canvas.tsx`** — Block im `disconnect`-Zweig der `handleMouseUp`-Funktion

1. **Richtung pro Pfadsegment ermitteln**: Für jedes Paar aufeinanderfolgender Zellen im Pfad bestimmen ob horizontal (dx≠0) oder vertikal (dy≠0)
2. **Betroffene Verbindungsblöcke sammeln**: Alle Connection-Block-Tiles auf dem Pfad identifizieren
3. **Pro Block entscheiden**:
   - `getExistingBlockDirections()` aufrufen
   - Die zu löschenden Richtungen (aus Pfad) abziehen
   - Verbleibende Richtungen → passenden Block aus `CONNECTION_BLOCKS` finden oder Tile entfernen
4. **CellConnections entfernen**: Alle Connections entfernen, die an gelöschte Seiten grenzen
5. **Tiles aktualisieren**: `onTilesChange()` mit aktualisierten/entfernten Tiles aufrufen

