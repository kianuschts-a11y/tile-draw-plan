## Plan: Suchleiste im Komponenten-Auswahl-Dialog

### Änderung

Eine Suchleiste wird oberhalb der Komponentenliste eingefügt, die:
1. **Automatisch fokussiert** wird, sobald der Dialog geöffnet wird (autoFocus)
2. **Komponenten filtert** nach Name (case-insensitive)
3. **Nach Komponentenauswahl** (+/- Klick) den Suchtext behält und der Fokus zurück auf die Suchleiste gesetzt wird, damit direkt die nächste Suche gestartet werden kann

### Umsetzung

**`src/components/schematic/ComponentSelectorDialog.tsx`**:

1. Neuer State `searchTerm` (string), wird beim Dialog-Öffnen zurückgesetzt
2. `useRef` für das Input-Element, `autoFocus` auf dem Input
3. Input-Feld zwischen "Verfügbare Komponenten"-Header und der ScrollArea
4. Komponentenliste wird nach `searchTerm` gefiltert (Name enthält Suchbegriff)
5. Nach `updateQuantity`/`setQuantity` wird `inputRef.current?.focus()` aufgerufen, um den Fokus zurückzusetzen

| Datei | Änderung |
|-------|----------|
| `src/components/schematic/ComponentSelectorDialog.tsx` | Suchleiste mit Auto-Fokus und Filter-Logik hinzufügen |
