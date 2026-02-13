
# Umstellung auf lokale Datenhaltung (ohne Datenbank)

## Uebersicht

Alle Daten werden kuenftig im `localStorage` des Browsers gespeichert statt in der externen Datenbank. Authentifizierung, Firmenkonten und Login werden komplett entfernt. Die App startet direkt im Editor ohne Anmeldeseite.

---

## Bestehende Daten aus der Datenbank

Die folgenden Daten werden als JSON-Dateien im Projekt hinterlegt (unter `src/data/`), damit sie beim ersten Start automatisch in den localStorage geladen werden:

- **24 Komponenten** (z.B. Palletkessel, Gas-Kessel, BHKW, Waermepumpe, Pumpe, etc.) mit allen Shapes, Variationen und Einstellungen
- **11 Gruppen** (z.B. test, 70499-2, 4 Heizkreise, H1-H4) mit Layout-Daten und Verbindungen
- **5 Kategorien** (Erzeugung, Speicherung, Verteilung, Sicherheit, Hydraulik) mit Tags
- **2 gespeicherte Plaene** (Schoefer, 70499-2) mit kompletten Zeichnungsdaten
- **0 Projekte** (Tabelle ist leer)

---

## Dateien die ENTFERNT werden

| Datei | Grund |
|-------|-------|
| `src/pages/Auth.tsx` | Login-Seite nicht mehr noetig |
| `src/hooks/useAuth.tsx` | Authentifizierung entfaellt |
| `src/lib/errorUtils.ts` | Nur fuer DB-/Auth-Fehlermeldungen genutzt |

---

## Dateien die NEU erstellt werden

| Datei | Inhalt |
|-------|--------|
| `src/data/defaultComponents.ts` | Alle 24 Komponenten als TypeScript-Array exportiert |
| `src/data/defaultGroups.ts` | Alle 11 Gruppen als TypeScript-Array exportiert |
| `src/data/defaultCategories.ts` | Alle 5 Kategorien als TypeScript-Array exportiert |
| `src/data/defaultSavedPlans.ts` | Alle 2 gespeicherten Plaene als TypeScript-Array exportiert |

---

## Dateien die UMGEBAUT werden

### 1. `src/hooks/useComponents.tsx`
- Supabase-Imports und Auth-Abhaengigkeit entfernen
- Alle CRUD-Operationen auf localStorage umstellen
- Beim ersten Start: Default-Daten aus `src/data/defaultComponents.ts` laden
- Neue IDs per `crypto.randomUUID()` generieren

### 2. `src/hooks/useComponentGroups.tsx`
- Gleiche Umstellung wie useComponents
- localStorage-Key: `schematic-editor-groups`

### 3. `src/hooks/useGroupCategories.tsx`
- Gleiche Umstellung
- Default-Kategorien aus `src/data/defaultCategories.ts` statt DB-Seeding
- localStorage-Key: `schematic-editor-categories`

### 4. `src/hooks/useProjects.tsx`
- Gleiche Umstellung
- localStorage-Key: `schematic-editor-projects`

### 5. `src/hooks/useSavedPlans.tsx`
- Gleiche Umstellung
- localStorage-Key: `schematic-editor-saved-plans`

### 6. `src/pages/Index.tsx`
- Auth-Check und Redirect entfernen
- Direkt `<SchematicEditor />` rendern

### 7. `src/App.tsx`
- `AuthProvider` entfernen
- `/auth`-Route entfernen
- Supabase-Query-Client kann bleiben (wird ggf. fuer andere Zwecke genutzt)

### 8. `src/components/schematic/SchematicEditor.tsx`
- `useAuth` Import entfernen
- `companyName` und `signOut` Referenzen entfernen
- Abmelde-Button und Firmenname aus dem Header/Dropdown entfernen
- Statischen Titel "Schema-Editor" / "Anlagen-Diagramm Zeichner" beibehalten

---

## Technische Details

### localStorage-Schema

Jeder Hook folgt demselben Muster:

```text
1. Beim Laden: localStorage lesen
2. Falls leer: Default-Daten aus src/data/ laden und in localStorage schreiben
3. Bei CRUD: State + localStorage synchron aktualisieren
4. IDs: crypto.randomUUID() fuer neue Eintraege
```

### Hilfsfunktion fuer localStorage-Persistenz

```text
function loadFromStorage<T>(key: string, defaults: T[]): T[] {
  const stored = localStorage.getItem(key);
  if (stored) {
    try { return JSON.parse(stored); } catch { /* fall through */ }
  }
  localStorage.setItem(key, JSON.stringify(defaults));
  return defaults;
}

function saveToStorage<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data));
}
```

### Datenmigration

- Die vollstaendigen JSON-Daten aller 24 Komponenten, 11 Gruppen, 5 Kategorien und 2 Plaene werden aus der Datenbank exportiert und als TypeScript-Konstanten in `src/data/` abgelegt
- Shapes, Variationen, Layout-Daten und Verbindungen werden 1:1 uebernommen
- Bestehende IDs bleiben erhalten, damit Referenzen (z.B. componentIds in Gruppen) konsistent bleiben

---

## Was NICHT geaendert wird

- Alle UI-Komponenten (Canvas, Toolbar, Dialoge, etc.) bleiben unveraendert
- Die Typen in `src/types/schematic.ts` bleiben identisch
- Die gesamte Zeichenlogik, Export-Funktionen, Drag-and-Drop etc. sind nicht betroffen
- `src/integrations/supabase/` Dateien werden nicht geloescht (sind auto-generiert), aber nicht mehr importiert

