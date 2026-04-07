

## Plan: Quantities-Anzeige im Komponenten-Dialog korrigieren

### Problem

Wenn der Nutzer 4 Heizkreise auswählt und eine Gruppe einfügt, wird `projectQuantities` reduziert (auf 0). Nach dem Löschen der Tiles vom Canvas zeigt der Dialog "0" zwischen - und + an, statt der ursprünglich gewählten "4". Die `originalSelectedQuantities` sind zwar korrekt gespeichert, werden aber nicht für die Anzeige verwendet.

### Lösung

Die Anzeige im Dialog soll immer die **originalSelectedQuantities** als Grundlage verwenden, nicht die verbleibenden `quantities`. Die `quantities` (remaining) werden weiterhin intern für die Vorlagen-Suche verwendet, aber der Nutzer sieht immer seine ursprüngliche Auswahl.

### Änderungen

**`src/components/schematic/ComponentSelectorDialog.tsx`**:

1. **Anzeige-Wert ändern**: Der Wert zwischen - und + zeigt `originalQty` statt `remainingQty` an
2. **Placed-Indikator immer zeigen**: `{placedQty}/{originalQty} platziert` wird immer angezeigt wenn `originalQty > 0`, nicht nur wenn `placedQty > 0`
3. **+/- Buttons wirken auf originalSelectedQuantities**: Wenn der Nutzer + oder - drückt, wird die Original-Menge angepasst und die remaining Menge entsprechend synchronisiert (`remaining = original - placed`)
4. **Highlight/Expand-Logik**: Prüft `originalQty > 0` statt nur `qty > 0` für das Styling und die Expand-Buttons

### Logik-Anpassung

```text
Vorher:
  Anzeige: remainingQty (= original - inserted)  → zeigt 0 nach Gruppen-Insert
  
Nachher:
  Anzeige: originalQty (= was der Nutzer gewählt hat) → zeigt immer 4
  Darunter: placedQty/originalQty platziert → zeigt 0/4, 2/4, 4/4
  remaining (intern): originalQty - placedQty → für Vorlagen-Matching
```

### Synchronisation

Wenn Tiles auf dem Canvas gelöscht werden, muss `projectQuantities` (remaining) automatisch neu berechnet werden als `originalQty - placedQty`. Dies geschieht durch einen `useEffect` in SchematicEditor oder durch Neuberechnung beim Öffnen des Dialogs.

| Datei | Änderung |
|-------|----------|
| `src/components/schematic/ComponentSelectorDialog.tsx` | Anzeige auf `originalQty` umstellen, remaining intern aus `original - placed` berechnen |
| `src/components/schematic/SchematicEditor.tsx` | `projectQuantities` bei Tile-Änderungen synchronisieren: `remaining = original - actual placed count` |

