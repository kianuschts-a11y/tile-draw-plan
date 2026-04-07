

## Plan: Gruppen-Erkennung in Projekten — Info-Dialog & Insertion-Fix

### Überblick

Beim Anzeigen der Projektinformationen (Info-Dialog, "i"-Button) soll automatisch erkannt und angezeigt werden, welche bekannten Gruppen im Projekt enthalten sind. Gleichzeitig wird die Gruppen-Erkennung beim Einfügen von Projekten korrigiert, indem Connection-Blöcke beim Matching ignoriert werden.

### Änderungen

#### 1. Gruppen-Erkennungslogik als shared Utility auslagern

Neue Datei `src/lib/groupMatching.ts`:
- Funktion `identifyGroupsInPlan(planTiles, groups)` die erkennt, welche Gruppen in einem Plan enthalten sind
- Beim Matching werden Connection-Blöcke (`connection-*`) ignoriert — nur echte Komponenten müssen an den richtigen relativen Positionen vorhanden sein
- Connection-Blöcke an Gruppen-Positionen werden automatisch mit geschützt
- Rückgabe: Array von `{ group, matchedTileIds }` sowie ein Set aller geschützten Tile-IDs

#### 2. ProjectInfoDialog um Gruppen-Anzeige erweitern

`src/components/schematic/ProjectInfoDialog.tsx`:
- Neue Prop `groups: ComponentGroup[]` hinzufügen
- Beim Öffnen die `identifyGroupsInPlan`-Funktion mit den Plan-Tiles und allen bekannten Gruppen aufrufen
- Erkannte Gruppen als eigene Sektion im Dialog anzeigen (z.B. "Enthaltene Gruppen: 4 Heizkreise")
- Pro erkannte Gruppe: Name und Anzahl der zugehörigen Tiles als Badge

#### 3. ComponentLibrary — groups-Prop durchreichen

`src/components/schematic/ComponentLibrary.tsx`:
- `groups`-Prop an `ProjectInfoDialog` weiterreichen (ist bereits als Prop vorhanden)

#### 4. SchematicEditor — Insertion-Logik korrigieren

`src/components/schematic/SchematicEditor.tsx`:
- In `onInsertPlan` die bisherige Gruppen-Erkennung (Zeilen ~2606–2655) durch Aufruf der neuen `identifyGroupsInPlan`-Utility ersetzen
- Connection-Blöcke werden beim Matching automatisch ignoriert

### Betroffene Dateien

| Datei | Änderung |
|-------|----------|
| `src/lib/groupMatching.ts` | **Neu** — Shared Utility für Gruppen-Erkennung (Connection-Blöcke ignorieren) |
| `src/components/schematic/ProjectInfoDialog.tsx` | `groups`-Prop hinzufügen, erkannte Gruppen im Info-Dialog anzeigen |
| `src/components/schematic/ComponentLibrary.tsx` | `groups`-Prop an ProjectInfoDialog durchreichen |
| `src/components/schematic/SchematicEditor.tsx` | Gruppen-Erkennung in `onInsertPlan` durch shared Utility ersetzen |

