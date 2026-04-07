
## Plan: Suchleiste im Komponenten-Auswahl-Dialog

### Änderung

Eine Suchleiste wird oberhalb der Komponentenliste eingefügt, die:
1. **Automatisch fokussiert** wird, sobald der Dialog geöffnet wird (autoFocus)
2. **Komponenten filtert** nach Name (case-insensitive)
3. **Nach Komponentenauswahl** (+/- Klick) den Fokus zurück auf die Suchleiste setzt, damit direkt die nächste Suche gestartet werden kann

### Umsetzung

**`src/components/schematic/ComponentSelectorDialog.tsx`**:

1. Neuer State `searchTerm` + `useRef<HTMLInputElement>` für die Suchleiste
2. `searchTerm` wird beim Dialog-Öffnen zurückgesetzt (`""`)
3. Input-Feld mit `autoFocus` zwischen Header und ScrollArea einfügen
4. Komponentenliste nach `searchTerm` filtern (Name enthält Suchbegriff, case-insensitive)
5. Nach `updateQuantity`/`setQuantity` wird `searchInputRef.current?.focus()` aufgerufen

| Datei | Änderung |
|-------|----------|
| `src/components/schematic/ComponentSelectorDialog.tsx` | Suchleiste mit Auto-Fokus, Filter-Logik und Refokus nach Auswahl |
