
## Vollstaendige Projektdaten speichern und wiederherstellen

### Problem

Aktuell speichert ein Projekt nur Tiles und Connections. Folgende Daten gehen verloren:
- Papierformat und Orientierung (A4/A3, Hoch-/Querformat)
- Zeichenkopf (Projekt, Zeichnungsnummer, Blatt, Gezeichnet/Geprueft, Aenderungen)
- Annotationen (Linien und Texte auf dem Zeichenblatt)
- Tile-Beschriftungen (automatisch generierte Labels mit Farben)
- BOM-Zusatzdaten (Beschreibungen, Kategorien, Marken, Modelle, Preise, benutzerdefinierte Felder)

### Loesung

Das `SavedPlanData`-Interface und alle Speicher-/Lade-Funktionen werden erweitert, sodass der komplette Zeichnungszustand gespeichert und beim Oeffnen eines Projekts vollstaendig wiederhergestellt wird.

---

### Technische Aenderungen

#### 1. `src/hooks/useSavedPlans.tsx` - Datenmodell erweitern

`DrawingData` erhaelt alle fehlenden Felder:

```
DrawingData {
  tiles, connections                          // (bereits vorhanden)
  annotationLines?: AnnotationLine[]          // NEU
  annotationTexts?: AnnotationText[]          // NEU
  tileLabels?: Record<string, {label, color}> // NEU (Map als Object serialisiert)
}
```

`SavedPlanData` erhaelt:

```
SavedPlanData {
  ...                                          // (bereits vorhanden)
  paperFormat?: PaperFormat                    // NEU
  orientation?: Orientation                    // NEU
  titleBlockData?: TitleBlockData              // NEU
  projectDescriptions?: Record<string, string[]>   // NEU
  projectKategorien?: Record<string, string>        // NEU
  projectMarken?: Record<string, string>            // NEU
  projectModelle?: Record<string, string>            // NEU
  projectPreise?: Record<string, number>             // NEU
  projectCustomFields?: Record<string, Record<string, string|number>> // NEU
}
```

`savePlan` Signatur wird erweitert um ein optionales `metadata`-Objekt mit allen Zusatzdaten.

#### 2. `src/components/schematic/SchematicEditor.tsx` - Speichern anpassen

Alle drei Save-Funktionen (`handleSaveProjectFromToolbar`, `handleSaveProjectAndExportImage`, `handleSaveProjectAndExportPdf`) uebergeben die vollstaendigen Daten:

- `canvasState.paperFormat` und `canvasState.orientation`
- `titleBlockData`
- `annotationLines` und `annotationTexts`
- `tileLabels` (als serialisierbares Object)
- Alle BOM-Maps (`projectDescriptions`, `projectKategorien`, etc.) als serialisierbare Objects

#### 3. `src/components/schematic/ProjectInfoDialog.tsx` - Neuer Info-Dialog

Zeigt alle gespeicherten Projektinformationen:
- Komponentenliste mit Stueckzahlen
- Papierformat und Orientierung
- Zeichenkopf-Daten (falls ausgefuellt)
- Anzahl Annotationen und Verbindungen
- Erstellungsdatum

#### 4. `src/components/schematic/ComponentLibrary.tsx` - Kontextmenu und Info

Projekte erhalten:
- **Info-Button** (i-Icon) der den ProjectInfoDialog oeffnet
- **Kontextmenu** mit:
  - "Oeffnen" - Ersetzt die aktuelle Zeichnung komplett
  - "Als Vorlage verwenden" - Fuegt zur bestehenden Zeichnung hinzu
  - "Info" - Oeffnet den Info-Dialog
  - "Loeschen" - Loescht das Projekt

Neue Props: `onOpenPlan`, `onUsePlanAsTemplate`

#### 5. `src/components/schematic/SchematicEditor.tsx` - Projekt oeffnen

Neue Funktion `handleOpenPlan(plan)`:
1. Leert aktuelle Tiles, Connections, Annotationen, Labels
2. Setzt `paperFormat` und `orientation` aus dem Plan
3. Stellt `titleBlockData` wieder her
4. Platziert alle Tiles und Connections
5. Stellt Annotationen und Labels wieder her
6. Stellt BOM-Daten wieder her (Beschreibungen, Kategorien, Marken, etc.)
7. Ruft `handleResetView` auf fuer optimale Ansicht

Neue Funktion `handleUsePlanAsTemplate(plan)`:
- Fuegt Tiles und Connections hinzu (mit neuen IDs), ohne bestehende Inhalte zu loeschen

---

### Zusammenfassung der Dateien

| Datei | Aenderung |
|---|---|
| `src/hooks/useSavedPlans.tsx` | `DrawingData` und `SavedPlanData` erweitern, `savePlan` Parameter erweitern |
| `src/components/schematic/ProjectInfoDialog.tsx` | Neue Datei - Info-Dialog |
| `src/components/schematic/ComponentLibrary.tsx` | Kontextmenu, Info-Button, neue Props |
| `src/components/schematic/SchematicEditor.tsx` | Vollstaendige Daten beim Speichern uebergeben; `handleOpenPlan` und `handleUsePlanAsTemplate` implementieren |
