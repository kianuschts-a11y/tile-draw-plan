

## Plan: Projekt-Einfügung mit Gruppen-Erkennung für Excess-Markierung

### Problem

Wenn ein Projekt eingefügt wird, das eine Gruppe (z.B. "4 Heizkreise") enthält, werden alle Komponenten der Gruppe, die nicht explizit in den ausgewählten Mengen enthalten sind, rot markiert. Die Gruppe enthält aber Verbindungskomponenten und Hilfskomponenten, die zusammengehören und nicht einzeln geprüft werden sollten.

### Lösung

Beim Einfügen eines Projekts/Plans soll erkannt werden, welche Tiles zu einer bekannten Gruppe gehören. Nur Komponenten, die **weder** in den gewählten Mengen noch als Teil einer erkannten Gruppe vorhanden sind, werden rot markiert.

### Umsetzung

**`src/components/schematic/SchematicEditor.tsx`** — `onInsertPlan` Callback erweitern:

1. Nach dem Erstellen der neuen Tiles: Prüfen welche Komponenten im Plan zu einer bekannten `ComponentGroup` gehören
2. Dazu die `groups`-Liste durchgehen und für jede Gruppe prüfen, ob ihre `layoutData.tiles` (Komponenten-IDs und relative Positionen) im Plan enthalten sind
3. Alle Tile-IDs, die zu einer erkannten Gruppe gehören, als "Gruppen-Tiles" markieren
4. Excess-Logik anwenden: Nur Tiles rot markieren, die:
   - Nicht zu einer erkannten Gruppe gehören **UND**
   - Nicht in den `projectQuantities` als verfügbar gelistet sind
5. Gruppen-Tiles, deren zugehörige Gruppe vollständig im Plan vorhanden ist, werden **nicht** als excess markiert
6. Bei der Mengen-Subtraktion im `ComponentSelectorDialog.handleInsertPlan`: Gruppen-Komponenten korrekt von den `originalQuantities` abziehen, sodass die Anzeige konsistent bleibt

**Konkret:**
- Neue Hilfsfunktion `identifyGroupTilesInPlan(planTiles, groups)` die zurückgibt, welche Tile-IDs zu welcher Gruppe gehören
- `onInsertPlan` Callback: Nach Tile-Erstellung Excess-Berechnung analog zu `handleInsertGroupFromSelector` durchführen, aber Gruppen-Tiles ausschließen

| Datei | Änderung |
|-------|----------|
| `src/components/schematic/SchematicEditor.tsx` | `onInsertPlan` um Gruppen-Erkennung und selektive Excess-Markierung erweitern |

