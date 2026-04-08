

## Plan: "Als Vorlage verwenden" — Komponente duplizieren

### Überblick

Im Rechtsklick-Kontextmenü jeder Komponente wird eine dritte Option **"Als Vorlage verwenden"** hinzugefügt. Diese öffnet den Komponenten-Editor mit allen Daten der bestehenden Komponente (Shapes, Kachelgröße, Kategorie, etc.) — aber als **neue Komponente** (ohne ID), sodass der Benutzer sie anpassen und unter neuem Namen speichern kann.

### Änderungen

| Datei | Änderung |
|-------|----------|
| `src/components/schematic/ComponentLibrary.tsx` | Neue Prop `onUseAsTemplate`, neuer Menüeintrag "Als Vorlage verwenden" mit Copy-Icon im Kontextmenü |
| `src/components/schematic/SchematicEditor.tsx` | Neue Callback-Funktion: Kopiert die Komponente ohne ID, setzt `editingComponent` auf die Kopie und öffnet den Editor im Erstellungsmodus |

### Verhalten

- Klick auf "Als Vorlage verwenden" → Editor öffnet sich mit allen Shapes, Einstellungen und Kategorie der Vorlage
- Name wird auf `"[Originalname] (Kopie)"` gesetzt
- Da keine ID gesetzt ist, speichert der Editor die Komponente als **neue** Komponente
- Der Benutzer kann alles anpassen bevor er speichert

