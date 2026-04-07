

## Plan: "Platziert"-Anzeige korrigieren im Komponenten-Auswahl-Dialog

### Problem

Im **ComponentSelectorDialog** wird `placedQty` falsch berechnet als `originalQty - remainingQty`. Wenn der Nutzer z.B. 4 Heizkreise auswählt und dann eine Gruppe einfügt (die die `quantities` reduziert), zeigt der Dialog "4/4 platziert" — obwohl auf dem Canvas tatsächlich 0 platziert sind. Die **ComponentLibrary** macht es richtig: sie zählt die tatsächlichen `placedTiles` auf dem Canvas.

### Lösung

Die gleiche Logik wie in der ComponentLibrary verwenden: die tatsächlichen Canvas-Tiles (`placedTiles`) an den Dialog übergeben und daraus die platzierten Mengen berechnen.

### Änderungen

**`src/components/schematic/ComponentSelectorDialog.tsx`**:
- Neue Prop `placedTiles: PlacedTile[]` hinzufügen
- `placedQty` berechnen durch Zählen der tatsächlichen Tiles auf dem Canvas (wie in ComponentLibrary), nicht durch `originalQty - remainingQty`
- `placedComponentCounts` als useMemo aus `placedTiles` ableiten

**`src/components/schematic/SchematicEditor.tsx`**:
- `placedTiles={tiles}` als neue Prop an den ComponentSelectorDialog übergeben

### Betroffene Berechnung

```text
Vorher (falsch):
  placedQty = originalQty - remainingQty  (= 4 - 0 = 4)

Nachher (korrekt):
  placedQty = Anzahl Tiles mit dieser component.id auf dem Canvas (= 0)
```

