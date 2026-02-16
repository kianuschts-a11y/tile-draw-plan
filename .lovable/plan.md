

## Korrektur des M.O.P CSV-Exports

### Gefundene Fehler

Vergleich der exportierten CSV mit der M.O.P-Baumstruktur aus den Screenshots ergibt folgende Abweichungen:

| Problem | Aktuell (falsch) | Korrekt (laut Screenshots) |
|---|---|---|
| Objektnummer TZ | `1234 TZ` | `1234-1 TZ` |
| Objektnummer Komponenten | `1234 GK` | `1234-1 GK` |
| Teil_von TZ | `1 - Projekte` | `1234-1 - {Strasse}` (Objekt/Haus) |
| Teil_von Komponenten | `1 - Projekte` | `1234-1 TZ - Technikzentrale` |
| Mengenexpansion | 1 Zeile fuer 3 Pufferspeicher | 3 Zeilen: PS, PS 2, PS 3 |
| Bezeichnung TZ | `1234 TZ - Technikzentrale` | `1234-1 TZ - Technikzentrale` |
| Bezeichnung Komp. | `1234 GK - Gas Kessel` | `1234-1 GK - Gas Kessel` |
| Bereich Objektsymbol | leer | `ObjektSymbol 8` |
| Bereich Objektart | leer | `Produkt` |

### Korrekte Hierarchie (Teil_von-Kette)

```text
1 - Projekte
  2 - Energielieferung          (Teil_von: 1 - Projekte, Objektart: Produkt, ObjektSymbol 8)
    5 - Realisierung            (Teil_von: 2 - Energielieferung)
      1234-1 - Teststrasse      (Teil_von: 5 - Realisierung)
        1234-1 TZ - TZ          (Teil_von: 1234-1 - Teststrasse)
          1234-1 GK - Gas Kessel   (Teil_von: 1234-1 TZ - Technikzentrale)
          1234-1 PS - Pufferspeicher
          1234-1 PS 2 - Pufferspeicher
          1234-1 PS 3 - Pufferspeicher
```

### Mengenexpansion

Wenn eine Komponente die Menge 3 hat, werden 3 separate Zeilen erzeugt:
- `{projNr}-1 {Kuerzel} - {Name}` (erstes Stueck)
- `{projNr}-1 {Kuerzel} 2 - {Name}` (zweites Stueck)
- `{projNr}-1 {Kuerzel} 3 - {Name}` (drittes Stueck)

### Technische Aenderungen

Nur eine Datei muss geaendert werden: `src/lib/mopCsvExport.ts`

1. **Objektnummern-Format**: Ueberall `{projNr}-1` statt `{projNr}` verwenden fuer TZ und Komponenten
2. **Teil_von-Kette**: Korrekte Eltern-Kind-Beziehungen:
   - TZ: `Teil_von` = Objekt-Bezeichnung
   - Komponenten: `Teil_von` = TZ-Bezeichnung
3. **Bereich-Zeile**: `Objektsymbol: ObjektSymbol 8` und `Objektart: Produkt` setzen
4. **Mengenexpansion**: Schleife ueber `comp.quantity`, mit Nummerierung ab dem 2. Stueck
5. **Eindeutige Kuerzel**: Wenn mehrere verschiedene Komponenten dasselbe Kuerzel haben, diese ebenfalls nummerieren

### Erwartetes CSV-Ergebnis (Beispiel)

```text
Ebene;Objektnummer;Objektsymbol;Bezeichnung;Objektart;Teil_von;Hersteller;Kuerzel
1;1;;1 - Projekte;;;;
2;2;ObjektSymbol 8;2 - Energielieferung;Produkt;1 - Projekte;;
3;5;;5 - Realisierung;;2 - Energielieferung;;
4;1234-1;ObjektSymbol 8;1234-1 - Teststrasse;;5 - Realisierung;;
5;1234-1 TZ;;1234-1 TZ - Technikzentrale;Produkt;1234-1 - Teststrasse;;TZ
6;1234-1 GK;;1234-1 GK - Gas Kessel;Produkt;1234-1 TZ - Technikzentrale;;GK
6;1234-1 PS;;1234-1 PS - Pufferspeicher;Produkt;1234-1 TZ - Technikzentrale;;PS
6;1234-1 PS 2;;1234-1 PS 2 - Pufferspeicher;Produkt;1234-1 TZ - Technikzentrale;;PS
6;1234-1 BHKW;;1234-1 BHKW - BHKW;Produkt;1234-1 TZ - Technikzentrale;Vaillant;BHKW
```
