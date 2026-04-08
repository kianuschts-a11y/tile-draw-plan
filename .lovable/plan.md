
Ziel: Die Pfeilfunktion so korrigieren, dass wiederholtes Klicken auf dieselbe Verbindung nur die Richtung dieser einen Verbindung umschaltet und nicht auf eine benachbarte Rasterlinie springt.

1. Ursache im Arrow-Cycling beheben
- In `src/components/schematic/Canvas.tsx` wird aktuell bei jedem Klick `findConnectionsNearPoint(x, y)` neu berechnet und danach mit `lastArrowClickPos` + `lastArrowClickIndex` zyklisch durch die Trefferliste geschaltet.
- Das ist die eigentliche Fehlerquelle:
  - Nach dem ersten Klick existiert ein Pfeil.
  - Beim zweiten Klick auf fast dieselbe Stelle kann sich die sortierte Trefferliste minimal ändern.
  - Dann zeigt derselbe `idx` plötzlich auf eine andere nahe Verbindung.
- Ich würde die Logik daher von „Zyklus pro Klickposition“ auf „Zyklus pro tatsächlich gewählter Verbindung / Treffergruppe“ umstellen.

2. Treffer stabilisieren statt nur nach Pixelposition zu vergleichen
- Die aktuelle Schlüsselbildung `posKey = Math.round(x),Math.round(y)` ist zu empfindlich und zugleich nicht semantisch genug.
- Stattdessen:
  - die nächste Verbindung eindeutig bestimmen,
  - optional zusätzlich eine kleine „Treffergruppe“ aus wirklich überlappenden Verbindungen bilden,
  - und den letzten Zyklus nur dann fortsetzen, wenn dieselbe Treffergruppe erneut angeklickt wurde.
- Dadurch bleibt dieselbe Linie ausgewählt, auch wenn sich durch minimale Distanzunterschiede die Reihenfolge benachbarter Linien ändert.

3. Arrow-Interaktion fachlich vereinfachen
- Für den von dir beschriebenen Fall ist das robusteste Verhalten:
  - Wenn nur eine sinnvolle Verbindung an der Stelle getroffen wird: immer genau diese toggeln (`none -> forward -> backward -> none`)
  - Nur wenn mehrere Verbindungen wirklich am selben Punkt konkurrieren, darf zyklisch zwischen ihnen gewechselt werden.
- Damit wird verhindert, dass ein bereits vorhandener Pfeil „den Fokus“ auf die Nachbarlinie verschiebt.

4. `findConnectionsNearPoint` robuster machen
- In `src/components/schematic/Canvas.tsx` würde ich die Treffermenge enger definieren:
  - nächsten Treffer mit Distanz bestimmen,
  - nur Verbindungen in einem kleinen Toleranzbereich zu diesem besten Treffer als konkurrierende Kandidaten zulassen.
- So werden benachbarte, aber eigentlich nicht gemeinte Linien aus dem Klickkontext ausgeschlossen.

5. Einheitliche Logik an beiden Einstiegspunkten
- Die Arrow-Logik existiert doppelt:
  - in `handleMouseDown`
  - in `handleTileMouseDown`
- Beide Stellen müssen dieselbe neue Auswahl- und Zykluslogik verwenden, idealerweise über eine gemeinsame Hilfsfunktion im `Canvas`.
- Sonst bleibt der Fehler je nach Klickziel unterschiedlich bestehen.

6. Vorhandenen Pfeil nicht als neuen Zielanker fehlinterpretieren
- Die Session-Replay-Daten sprechen dafür, dass nach dem Umschalten der Richtung beim nächsten Klick eine andere nahe Verbindung ausgewählt wird.
- Deshalb würde ich den Zykluszustand an folgende Daten koppeln:
  - IDs der konkurrierenden Verbindungen
  - primär gewählte Verbindungs-ID
  - optional quantisierte Klickposition entlang derselben Linie
- Nicht mehr nur an rohe Mauskoordinaten.

Technische Umsetzung
- Datei: `src/components/schematic/Canvas.tsx`
- Geplante Anpassungen:
  - neue Helper-Funktion für stabile Arrow-Kandidaten an einem Klickpunkt
  - neue Helper-Funktion für Toggle-/Cycle-Entscheidung
  - Ersetzen der aktuellen `posKey`-/`lastArrowClickIndex`-Logik
  - Vereinheitlichung in `handleMouseDown` und `handleTileMouseDown`

Erwartetes Verhalten nach der Änderung
- Erster Klick setzt den Pfeil auf die nächstgelegene richtige Verbindung.
- Zweiter Klick auf dieselbe Stelle ändert nur die Richtung derselben Verbindung.
- Erst wenn wirklich mehrere Verbindungen dieselbe Klickstelle teilen, wird zwischen diesen umgeschaltet.
- Benachbarte Rasterlinien werden nicht mehr „bevorzugt“, nur weil bereits ein Pfeil existiert.

Betroffene Datei
- `src/components/schematic/Canvas.tsx`

<lov-actions>
<lov-suggestion message="Teste die Pfeilfunktion end-to-end und prüfe, ob wiederholte Klicks auf dieselbe Verbindung jetzt nur noch die Richtung derselben Linie umschalten.">Verify that it works</lov-suggestion>
<lov-suggestion message="Implementiere die stabile Pfeil-Auswahl mit Treffergruppen und ersetze die bisherige posKey-/cycle-Logik in Canvas.tsx.">Pfeil-Logik stabilisieren</lov-suggestion>
<lov-suggestion message="Füge für die Pfeilfunktion eine visuelle Hover-Vorschau hinzu, damit vor dem Klick klar ist, welche Verbindung ausgewählt wird.">Hover-Vorschau für Pfeile</lov-suggestion>
</lov-actions>
