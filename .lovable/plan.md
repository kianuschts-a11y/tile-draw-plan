

## Plan: Komponenten-Filter als individuelle Checkliste

### Änderung

Die bisherige Kategorie-basierte Filterung (Switches pro Kategorie + Messkomponenten) wird ersetzt durch eine **individuelle Komponenten-Checkliste**. Beim Klick auf das Filter-Zahnrad öffnet sich ein separater Dialog mit allen vorhandenen Komponenten, jeweils mit Checkbox.

### Umsetzung

**Neue Datei: `src/components/schematic/ComponentFilterDialog.tsx`**
- Eigener Dialog mit Liste aller Komponenten (Name + Checkbox)
- ScrollArea für lange Listen
- "Alle auswählen" / "Alle abwählen" Buttons oben
- State: `Set<string>` mit IDs der **ausgeschlossenen** Komponenten
- Standardmäßig alle einbezogen (leeres Set), außer Messkomponenten (labelingEnabled) die standardmäßig ausgeschlossen sind

**Änderungen in `ComponentSelectorDialog.tsx`**:
- `excludedCategories` + `allComponentCategories` + `toggleCategoryExclusion` entfernen
- Neuer State: `excludedComponentIds: Set<string>` (IDs der nicht einbezogenen Komponenten)
- Default: alle Komponenten mit `labelingEnabled === true` sind ausgeschlossen
- Filter-Zahnrad öffnet den neuen `ComponentFilterDialog` statt das inline Panel
- `isComponentExcluded` prüft nur noch ob `comp.id` in `excludedComponentIds` ist
- `filteredQuantities` filtert anhand der Component-IDs statt Kategorien
- Das inline Filter-Panel (Kategorien-Switches) wird entfernt, der Rest (Übereinstimmung-Slider, nur vollständige Matches) bleibt inline

### UI des neuen Dialogs

```text
┌─ Komponenten-Filter ──────────────────┐
│                                        │
│  [Alle auswählen]  [Alle abwählen]     │
│                                        │
│  ☑ Wärmepumpe                          │
│  ☑ Pufferspeicher                      │
│  ☑ Heizkreisverteiler                  │
│  ☐ Temperaturfühler                    │
│  ☐ Drucksensor                         │
│  ...                                   │
│                                        │
│                          [Übernehmen]  │
└────────────────────────────────────────┘
```

### Dateien

| Datei | Änderung |
|-------|----------|
| `src/components/schematic/ComponentFilterDialog.tsx` | Neu: Dialog mit Komponenten-Checkliste |
| `src/components/schematic/ComponentSelectorDialog.tsx` | Kategorie-Filter → Komponenten-ID-Filter, Filter-Button öffnet neuen Dialog |

