
# Plan: Auto-Verbindungen Feature für Komponenten

## Übersicht
Diese Funktion ermöglicht das Aktivieren von "Auto-Verbindungen" für Komponenten. Wenn aktiviert, werden automatisch dünne gestrichelte Verbindungslinien von dieser Komponente zu allen Komponenten mit aktivierter Beschriftung (labeling) gezeichnet.

## Technische Änderungen

### 1. Datenbank-Migration
**Neue Spalte in `components` Tabelle:**
- `auto_connections_enabled` (boolean, nullable, default: false)

### 2. TypeScript Types
**Datei: `src/types/schematic.ts`**
- Neue Eigenschaft im `Component` Interface:
  ```typescript
  autoConnectionsEnabled?: boolean; // Auto-Verbindungen zu beschrifteten Komponenten
  ```

### 3. Component Editor Dialog
**Datei: `src/components/schematic/ComponentEditorDialog.tsx`**
- Neuer State: `autoConnectionsEnabled`
- Neue UI-Sektion unter "Beschriftung":
  - Switch für "Auto Verbindungen aktivieren"
  - Erklärungstext: "Zeichnet automatisch gestrichelte Linien zu allen beschrifteten Komponenten"
- Props-Anpassung: `onSave` und `onUpdate` um `autoConnectionsEnabled` erweitern
- `handleSave` anpassen um den neuen Wert zu übergeben
- `handleClose` anpassen um State zurückzusetzen
- `useEffect` für Laden bestehender Komponenten anpassen

### 4. useComponents Hook
**Datei: `src/hooks/useComponents.tsx`**
- `saveComponent` Funktion erweitern um `autoConnectionsEnabled` Parameter
- `updateComponent` Funktion erweitern um `autoConnectionsEnabled` Parameter
- Mapping von Datenbankwerten zu Component-Objekten anpassen
- Insert/Update Queries anpassen

### 5. Schematic Editor
**Datei: `src/components/schematic/SchematicEditor.tsx`**
- Handler-Funktionen für Save/Update anpassen um neuen Parameter weiterzuleiten
- Neue Funktion: `generateAutoConnections` - berechnet alle Auto-Verbindungslinien
  - Findet alle Tiles mit `autoConnectionsEnabled`
  - Findet alle Tiles mit `labelingEnabled`
  - Generiert Linien zwischen deren Zentren
- Neuer State oder useMemo: `autoConnectionLines` - Array von Linien-Objekten

### 6. Canvas Rendering
**Datei: `src/components/schematic/Canvas.tsx`**
- Neue Props: `autoConnectionLines` (Array von Linien-Definitionen)
- Render-Logik für gestrichelte Linien:
  - Dünne Linienstärke (ca. 0.02 * tileSize)
  - Gestrichelt (`strokeDasharray`)
  - Farbe: grau oder konfigurierbar
  - Von Tile-Zentrum zu Tile-Zentrum

## Visuelles Konzept
```text
+--------+                    +--------+
|  BHKW  | - - - - - - - - -> | 1.1    |
| (Auto) |                    | Speich |
+--------+                    +--------+
     |
     | (gestrichelte Linie)
     v
+--------+
| 1.2    |
| Pumpe  |
+--------+
```

## Implementierungsreihenfolge
1. Datenbank-Migration für neue Spalte
2. TypeScript Types erweitern
3. useComponents Hook anpassen
4. ComponentEditorDialog UI hinzufügen
5. SchematicEditor Logik für Auto-Verbindungen
6. Canvas Rendering der gestrichelten Linien
