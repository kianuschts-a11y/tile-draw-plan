

## Plan: Vereinfachte Gruppen-Erkennung — Verbindungsblöcke ignorieren

### Problem

Die aktuelle Gruppen-Erkennung in `onInsertPlan` vergleicht **alle** Tiles der Gruppe (inkl. Connection-Blöcke) exakt nach `componentId` und Position. In einem Projekt ändern sich Connection-Blöcke oft (z.B. `connection-horizontal` → `connection-t-top`), weil zusätzliche Leitungen angeschlossen werden. Dadurch scheitert der Match.

### Lösung

Beim Gruppen-Matching werden **Connection-Blöcke komplett ignoriert**. Es werden nur die echten Komponenten (nicht `connection-*`) der Gruppe mit den Tiles im Plan verglichen. Wenn alle Nicht-Connection-Komponenten einer Gruppe an den richtigen relativen Positionen vorhanden sind, gilt die Gruppe als erkannt.

### Umsetzung

**`src/components/schematic/SchematicEditor.tsx`** — Zeilen ~2606–2655 (Gruppen-Erkennung in `onInsertPlan`):

1. `group.layoutData.tiles` filtern: nur Tiles behalten, deren `componentId` **nicht** mit `connection-` beginnt
2. Wenn nach dem Filtern keine relevanten Tiles übrig bleiben → Gruppe überspringen
3. Anker-Suche und Positions-Matching nur mit den gefilterten (Nicht-Connection) Tiles durchführen
4. Bei einem Match: **alle** Plan-Tiles, die an Positionen der Gruppen-Connection-Blöcke liegen und `connection-*` IDs haben, ebenfalls als Gruppen-Tiles markieren (damit auch die Verbindungsblöcke nicht rot werden)

```text
Vorher:
  Alle Gruppen-Tiles (inkl. Connection) müssen exakt matchen
  → Scheitert bei veränderten Connection-Blöcken

Nachher:
  Nur echte Komponenten müssen matchen
  Connection-Blöcke an Gruppen-Positionen werden automatisch mit geschützt
  → Robustes Matching trotz geänderter Verbindungen
```

| Datei | Änderung |
|-------|----------|
| `src/components/schematic/SchematicEditor.tsx` | Gruppen-Erkennung: Connection-Tiles aus dem Matching ausschließen, nur funktionale Komponenten prüfen |

