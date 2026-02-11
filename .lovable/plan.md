

# Plan: Projekte-Reiter + Gruppen-Kategorisierung

## Zusammenfassung

1. **Neuer "Projekte"-Reiter** in der Bibliothek -- fertige Zeichnungen werden hier gespeichert statt in Gruppen
2. **Gruppen-Kategorien und Tags** -- beim Erstellen einer Gruppe wird eine Kategorie und optionale Tags zugewiesen
3. **Kategorien-Verwaltung** -- Kategorien koennen hinzugefuegt, bearbeitet und geloescht werden

---

## Technische Details

### 1. Datenbank-Aenderungen

**Tabelle `component_groups` erweitern:**
- Neue Spalte `category` (text, nullable) -- z.B. "Erzeugung", "Speicherung"
- Neue Spalte `tags` (text[], nullable) -- z.B. ["Waerme", "Kaelte"]

**Neue Tabelle `group_categories` erstellen:**
- `id` (uuid, PK)
- `company_id` (uuid, NOT NULL)
- `name` (text, NOT NULL) -- Kategoriename
- `tags` (text[], default '{}') -- Verfuegbare Tags fuer diese Kategorie
- `sort_order` (integer, default 0)
- `created_at` (timestamptz)

RLS-Policies analog zu den bestehenden Tabellen (company_id-basiert).

**Initiale Kategorien** werden als Seed-Daten beim ersten Laden eingefuegt (ueber die App, nicht als Migration), damit sie pro Firma existieren:
- Erzeugung (Tags: Waerme, Kaelte)
- Speicherung (Tags: Waermespeicher, Kaeltespeicher, Stromspeicher)
- Verteilung (Tags: Heizkreisgruppen, Kaelteverteilung, Trinkwasser, Fernwaerme)
- Hydraulik (keine Tags)
- Sicherheit (keine Tags)

### 2. Neuer Hook: `useGroupCategories`

**Datei:** `src/hooks/useGroupCategories.tsx`

- Laedt Kategorien aus `group_categories` Tabelle
- CRUD-Operationen: `createCategory`, `updateCategory`, `deleteCategory`
- Seed-Funktion: Beim ersten Laden (keine Kategorien vorhanden) werden die Standard-Kategorien angelegt
- Gibt `categories` und die CRUD-Funktionen zurueck

### 3. Hook `useComponentGroups` erweitern

**Datei:** `src/hooks/useComponentGroups.tsx`

- `createGroup` erhaelt zusaetzliche Parameter: `category?: string`, `tags?: string[]`
- `updateGroup` erhaelt ebenfalls `category` und `tags`
- Mapping der neuen Spalten beim Laden

### 4. Typ-Erweiterung

**Datei:** `src/types/schematic.ts`

```text
ComponentGroup erweitern um:
  category?: string
  tags?: string[]

Neues Interface:
GroupCategory {
  id: string
  name: string
  tags: string[]
  sortOrder: number
}
```

### 5. ComponentLibrary: 3 Tabs + Gruppen-Filterung

**Datei:** `src/components/schematic/ComponentLibrary.tsx`

- `LibraryTab` erweitern: `'components' | 'groups' | 'projects'`
- TabsList wird `grid-cols-3` mit "Komponenten", "Gruppen", "Projekte"
- **Gruppen-Tab**: Filterung nach Kategorie (Accordion oder Dropdown) und Tags (Chips)
- **Projekte-Tab**: Zeigt gespeicherte Plaene (aus `useSavedPlans`), per Drag-and-Drop platzierbar, mit Loeschen-Option
- Neue Props: `savedPlans`, `onDeletePlan`, `categories`, Kategorie-/Tag-Filter-State

### 6. Gruppen-Erstellung mit Kategorie-Dialog

**Neue Datei:** `src/components/schematic/GroupCategoryDialog.tsx`

Dialog der beim Erstellen einer Gruppe erscheint (nach dem Benennen):
- Dropdown/Select fuer Kategorie (aus `group_categories`)
- Multi-Select Chips fuer Tags (gefiltert nach gewaehlter Kategorie)
- Button zum Verwalten der Kategorien (oeffnet Unter-Dialog)

### 7. Kategorien-Verwaltungsdialog

**Neue Datei:** `src/components/schematic/CategoryManagerDialog.tsx`

- Liste aller Kategorien mit Bearbeiten/Loeschen
- Neue Kategorie hinzufuegen (Name + Tags)
- Tags pro Kategorie bearbeitbar (hinzufuegen/entfernen)
- Inline-Editing oder Dialog-basiert

### 8. ExportGroupDialog anpassen

**Datei:** `src/components/schematic/ExportGroupDialog.tsx`

- "Zeichnung als Gruppe speichern" wird zu "Zeichnung als Projekt speichern"
- Statt `onSaveGroupAndExportImage/Pdf` wird `onSaveProjectAndExportImage/Pdf` verwendet
- Speichert ueber `useSavedPlans.savePlan` statt `createGroup`

### 9. SchematicEditor anpassen

**Datei:** `src/components/schematic/SchematicEditor.tsx`

- `libraryTab` State erweitern um `'projects'`
- `useGroupCategories` Hook einbinden
- Gruppen-Erstellung: Nach Benennung den Kategorie-Dialog oeffnen
- Export-Dialog: "Als Projekt speichern" statt "Als Gruppe speichern"
- Neue Props an ComponentLibrary weiterreichen (savedPlans, categories, etc.)
- `handleSaveGroupAndExport*` wird zu `handleSaveProjectAndExport*` (nutzt `savePlan`)

---

## Aenderungs-Uebersicht

| Datei | Aenderung |
|-------|-----------|
| Migration | Neue Tabelle `group_categories`, Spalten `category`/`tags` in `component_groups` |
| `src/types/schematic.ts` | `ComponentGroup` erweitern, neues Interface `GroupCategory` |
| `src/hooks/useGroupCategories.tsx` | Neuer Hook (CRUD + Seed) |
| `src/hooks/useComponentGroups.tsx` | `createGroup`/`updateGroup` um category/tags erweitern |
| `src/components/schematic/GroupCategoryDialog.tsx` | Neuer Dialog fuer Kategorie-/Tag-Auswahl beim Gruppen-Erstellen |
| `src/components/schematic/CategoryManagerDialog.tsx` | Neuer Dialog fuer Kategorien-Verwaltung |
| `src/components/schematic/ComponentLibrary.tsx` | 3 Tabs, Gruppen-Filterung nach Kategorie/Tag, Projekte-Tab |
| `src/components/schematic/ExportGroupDialog.tsx` | "Als Projekt speichern" statt "Als Gruppe speichern" |
| `src/components/schematic/SchematicEditor.tsx` | Neue Hooks, angepasste Handler, erweiterte Props |

