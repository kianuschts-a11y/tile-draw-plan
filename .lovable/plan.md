

## Plan: Intelligentere Vorlagen-Übereinstimmung mit Subset-Erkennung

### Problem

Wenn der Nutzer 4 Heizkreise + 1 Alonco Box auswählt, zeigt eine Gruppe die nur 4 Heizkreise enthält 80% an. Obwohl die Gruppe alle ihre Komponenten zu 100% aus dem Projekt bedienen kann, wird sie nicht als "vollständige Übereinstimmung" markiert. Der Nutzer erwartet, dass das System erkennt: "Diese Gruppe deckt einen Teil komplett ab, nur die Alonco Box muss manuell platziert werden."

### Lösung

Zwei Verbesserungen:

1. **"Gruppen-Erfüllbarkeit" zusätzlich anzeigen**: Neben der Coverage-Prozent (wie viel vom Gesamtprojekt) wird ein zweiter Indikator eingeführt — ob die Gruppe selbst vollständig erfüllbar ist (alle Komponenten der Gruppe sind im Projekt vorhanden). Das ist der entscheidende Unterschied zwischen "diese Gruppe passt komplett" vs. "diese Gruppe passt teilweise".

2. **Verbleibende Komponenten nach Gruppen-Einfügung anzeigen**: Bei erfüllbaren Gruppen wird angezeigt, welche Komponenten danach noch manuell platziert werden müssen (z.B. "Danach verbleibend: 1× Alonco Box").

### UI-Änderungen

```text
┌─────────────────────────────┐
│  [Preview]  H4              │
│  ✓ Vollständig einfügbar    │  ← NEU: grüner Hinweis
│  Deckt 80% des Projekts ab  │  ← bisherige Coverage
│  Verbleibend: 1× Alonco Box │  ← NEU: was übrig bleibt
│  [→ Einfügen]               │
└─────────────────────────────┘
```

### Sortierung anpassen

Aktuelle Sortierung: `possibleCount > 0` zuerst, dann nach `coveragePercent`.

Neue Sortierung:
1. Vollständig erfüllbare Gruppen zuerst (alle Gruppen-Komponenten verfügbar)
2. Innerhalb dessen: höchste Coverage zuerst
3. Dann teilweise passende Gruppen nach Coverage

### Technische Änderungen

**`src/components/schematic/ComponentSelectorDialog.tsx`**:

1. **`GroupSuggestion` erweitern**: Neues Feld `isFullyFulfillable: boolean` und `remainingAfterInsert: Map<string, number>` (was nach Einfügen übrig bleibt)
2. **`matchingGroups` berechnen**: Bei erfüllbaren Gruppen die verbleibenden Komponenten berechnen und mitspeichern
3. **Rendering**: Unter dem Coverage-Badge zusätzlich anzeigen:
   - "✓ Vollständig einfügbar" (grün) wenn alle Gruppen-Komponenten vorhanden
   - "Verbleibend: X× Komponente A, Y× Komponente B" — die nach Einfügen noch manuell platzierten Komponenten
4. **Sortierung**: Erfüllbare Gruppen priorisieren, dann nach Coverage

| Datei | Änderung |
|-------|----------|
| `src/components/schematic/ComponentSelectorDialog.tsx` | `GroupSuggestion` erweitern, verbleibende Komponenten berechnen und anzeigen, Sortierung anpassen |

