import { useState, useRef, useCallback } from "react";
import { Component } from "@/types/schematic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, FileSpreadsheet, Settings, AlertCircle, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ColumnMapping, ImportSettingsDialog, DEFAULT_COLUMN_MAPPINGS } from "./ImportSettingsDialog";
import * as XLSX from 'xlsx';

interface ImportedRow {
  rawData: Record<string, string | number>;
  komponente: string;
  matchedComponent: Component | null;
  menge: number;
  kategorie?: string;
  preis?: number;
  marke?: string;
  modell?: string;
  customFields: Record<string, string | number>;
  // Key used for grouping identical rows
  groupKey: string;
}

interface ComponentImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  components: Component[];
  onImport: (data: {
    quantities: Map<string, number>;
    kategorien: Map<string, string>;
    preise: Map<string, number>;
    descriptions: Map<string, string[]>;
    customFields: Map<string, Record<string, string | number>>;
  }) => void;
}

export function ComponentImportDialog({
  open,
  onOpenChange,
  components,
  onImport
}: ComponentImportDialogProps) {
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>(DEFAULT_COLUMN_MAPPINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importedRows, setImportedRows] = useState<ImportedRow[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [error, setError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const findMatchingComponent = useCallback((name: string): Component | null => {
    if (!name) return null;
    const normalizedName = name.toLowerCase().trim();
    
    // Exact match first
    const exactMatch = components.find(c => c.name.toLowerCase() === normalizedName);
    if (exactMatch) return exactMatch;
    
    // Partial match
    const partialMatch = components.find(c => 
      c.name.toLowerCase().includes(normalizedName) || 
      normalizedName.includes(c.name.toLowerCase())
    );
    return partialMatch || null;
  }, [components]);

  // Normalize column name for comparison (lowercase, no accents, normalized whitespace)
  const normalizeColumnName = useCallback((name: string): string => {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove accents
      .replace(/[_\s]+/g, " ") // Normalize whitespace
      .trim();
  }, []);

  // Find the actual column name in the row that matches the configured column name
  const findMatchingColumn = useCallback((row: Record<string, string | number>, targetColumnName: string): string | null => {
    const normalizedTarget = normalizeColumnName(targetColumnName);
    const rowKeys = Object.keys(row);
    
    // Priority 1: Exact match
    const exactMatch = rowKeys.find(key => key === targetColumnName);
    if (exactMatch) return exactMatch;
    
    // Priority 2: Case-insensitive match
    const caseInsensitiveMatch = rowKeys.find(key => normalizeColumnName(key) === normalizedTarget);
    if (caseInsensitiveMatch) return caseInsensitiveMatch;
    
    // Priority 3: Starts with
    const startsWithMatch = rowKeys.find(key => normalizeColumnName(key).startsWith(normalizedTarget));
    if (startsWithMatch) return startsWithMatch;
    
    // Priority 4: Contains
    const containsMatch = rowKeys.find(key => normalizeColumnName(key).includes(normalizedTarget));
    if (containsMatch) return containsMatch;
    
    return null;
  }, [normalizeColumnName]);

  // Get value from row using flexible column matching
  const getRowValue = useCallback((row: Record<string, string | number>, columnName: string): string | number | undefined => {
    const matchedColumn = findMatchingColumn(row, columnName);
    return matchedColumn ? row[matchedColumn] : undefined;
  }, [findMatchingColumn]);

  // Create a key for grouping identical rows based on all mapped column values
  const createGroupKey = useCallback((row: Record<string, string | number>, mappings: ColumnMapping[]): string => {
    const values: string[] = [];
    for (const mapping of mappings) {
      if (mapping.columnName) {
        const value = getRowValue(row, mapping.columnName);
        if (value !== undefined) {
          values.push(`${mapping.id}:${String(value).trim()}`);
        }
      }
    }
    return values.sort().join('|');
  }, [getRowValue]);

  const parseFile = useCallback(async (file: File) => {
    setError("");
    setFileName(file.name);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, string | number>>(firstSheet);

      if (jsonData.length === 0) {
        setError("Die Datei enthält keine Daten.");
        return;
      }

      // Get column names from mappings
      const komponenteCol = columnMappings.find(m => m.id === 'komponente')?.columnName || 'Komponente';
      const kategorieCol = columnMappings.find(m => m.id === 'kategorie')?.columnName || 'Kategorie';
      const preisCol = columnMappings.find(m => m.id === 'preis')?.columnName || 'Preis';
      const markeCol = columnMappings.find(m => m.id === 'marke')?.columnName || 'Marke';
      const modellCol = columnMappings.find(m => m.id === 'modell')?.columnName || 'Modell';

      // Get custom column names
      const customMappings = columnMappings.filter(m => !['komponente', 'kategorie', 'preis', 'marke', 'modell'].includes(m.id));

      // First pass: create rows with group keys
      const rawRows = jsonData
        .filter(row => getRowValue(row, komponenteCol) !== undefined)
        .map(row => {
          const komponente = String(getRowValue(row, komponenteCol) || '');
          const groupKey = createGroupKey(row, columnMappings);
          
          const preisValue = getRowValue(row, preisCol);
          let preis: number | undefined;
          if (typeof preisValue === 'number') {
            preis = preisValue;
          } else if (preisValue !== undefined) {
            // Handle German number format (comma as decimal separator)
            const cleanedValue = String(preisValue).replace(/[^\d,.-]/g, '').replace(',', '.');
            const parsed = parseFloat(cleanedValue);
            preis = isNaN(parsed) ? undefined : parsed;
          }

          // Collect custom fields
          const customFields: Record<string, string | number> = {};
          for (const mapping of customMappings) {
            if (mapping.columnName) {
              const value = getRowValue(row, mapping.columnName);
              if (value !== undefined) {
                customFields[mapping.label] = value;
              }
            }
          }

          const kategorieValue = getRowValue(row, kategorieCol);
          const markeValue = getRowValue(row, markeCol);
          const modellValue = getRowValue(row, modellCol);

          return {
            rawData: row,
            komponente,
            matchedComponent: findMatchingComponent(komponente),
            menge: 1, // Will be updated after grouping
            kategorie: kategorieValue ? String(kategorieValue) : undefined,
            preis,
            marke: markeValue ? String(markeValue) : undefined,
            modell: modellValue ? String(modellValue) : undefined,
            customFields,
            groupKey
          };
        });

      // Second pass: group identical rows and count
      const groupedMap = new Map<string, ImportedRow>();
      for (const row of rawRows) {
        const existing = groupedMap.get(row.groupKey);
        if (existing) {
          existing.menge += 1;
        } else {
          groupedMap.set(row.groupKey, { ...row });
        }
      }

      const rows = Array.from(groupedMap.values());

      if (rows.length === 0) {
        setError(`Keine gültigen Zeilen gefunden. Stellen Sie sicher, dass die Spalte "${komponenteCol}" vorhanden ist.`);
        return;
      }

      setImportedRows(rows);
    } catch (err) {
      setError("Fehler beim Lesen der Datei. Bitte prüfen Sie das Format.");
      console.error("Import error:", err);
    }
  }, [columnMappings, findMatchingComponent, createGroupKey, getRowValue]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      parseFile(file);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      parseFile(file);
    }
  }, [parseFile]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleImport = () => {
    const quantities = new Map<string, number>();
    const kategorien = new Map<string, string>();
    const preise = new Map<string, number>();
    const descriptions = new Map<string, string[]>();
    const customFields = new Map<string, Record<string, string | number>>();

    for (const row of importedRows) {
      if (!row.matchedComponent) continue;

      const compId = row.matchedComponent.id;
      const currentQty = quantities.get(compId) || 0;
      quantities.set(compId, currentQty + row.menge);

      if (row.kategorie) {
        kategorien.set(compId, row.kategorie);
      }

      if (row.preis !== undefined) {
        preise.set(compId, row.preis);
      }

      // Add descriptions (combine marke and modell)
      const currentDescs = descriptions.get(compId) || [];
      const description = [row.marke, row.modell].filter(Boolean).join(' ');
      for (let i = 0; i < row.menge; i++) {
        currentDescs.push(description);
      }
      descriptions.set(compId, currentDescs);

      // Merge custom fields
      if (Object.keys(row.customFields).length > 0) {
        customFields.set(compId, { ...customFields.get(compId), ...row.customFields });
      }
    }

    onImport({ quantities, kategorien, preise, descriptions, customFields });
    handleClose();
  };

  const handleClose = () => {
    setImportedRows([]);
    setFileName("");
    setError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onOpenChange(false);
  };

  const matchedCount = importedRows.filter(r => r.matchedComponent).length;
  const unmatchedCount = importedRows.filter(r => !r.matchedComponent).length;

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              Komponenten importieren
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Settings button */}
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => setSettingsOpen(true)}
              >
                <Settings className="w-4 h-4" />
                Spalten konfigurieren
              </Button>
            </div>

            {/* File upload area */}
            {importedRows.length === 0 ? (
              <div
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium">Datei hierher ziehen</p>
                <p className="text-sm text-muted-foreground mt-1">
                  oder klicken zum Auswählen
                </p>
                <p className="text-xs text-muted-foreground mt-4">
                  Unterstützte Formate: CSV, Excel (.xlsx, .xls)
                </p>
              </div>
            ) : (
              /* Preview imported data */
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{fileName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="gap-1">
                      <Check className="w-3 h-3" />
                      {matchedCount} erkannt
                    </Badge>
                    {unmatchedCount > 0 && (
                      <Badge variant="destructive" className="gap-1">
                        <X className="w-3 h-3" />
                        {unmatchedCount} unbekannt
                      </Badge>
                    )}
                  </div>
                </div>

                <ScrollArea className="h-[300px] border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="text-left p-2">Status</th>
                        <th className="text-left p-2">Komponente</th>
                        <th className="text-right p-2">Menge</th>
                        <th className="text-left p-2">Marke</th>
                        <th className="text-left p-2">Modell</th>
                        <th className="text-right p-2">Preis</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importedRows.map((row, idx) => (
                        <tr key={idx} className={!row.matchedComponent ? 'bg-destructive/10' : ''}>
                          <td className="p-2">
                            {row.matchedComponent ? (
                              <Check className="w-4 h-4 text-green-600" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-destructive" />
                            )}
                          </td>
                          <td className="p-2">
                            <div>
                              <span className={!row.matchedComponent ? 'text-destructive' : ''}>
                                {row.komponente}
                              </span>
                              {row.matchedComponent && row.matchedComponent.name !== row.komponente && (
                                <span className="text-xs text-muted-foreground ml-2">
                                  → {row.matchedComponent.name}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-2 text-right">{row.menge}</td>
                          <td className="p-2 text-muted-foreground">{row.marke || '-'}</td>
                          <td className="p-2 text-muted-foreground">{row.modell || '-'}</td>
                          <td className="p-2 text-right">
                            {row.preis !== undefined ? `${row.preis.toFixed(2)} €` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>

                {unmatchedCount > 0 && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {unmatchedCount} Komponente(n) konnten nicht zugeordnet werden und werden übersprungen.
                  </p>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setImportedRows([]);
                    setFileName("");
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                >
                  Andere Datei wählen
                </Button>
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {error}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              Abbrechen
            </Button>
            <Button
              onClick={handleImport}
              disabled={matchedCount === 0}
            >
              {matchedCount} Komponenten importieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImportSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        columnMappings={columnMappings}
        onColumnMappingsChange={setColumnMappings}
      />
    </>
  );
}
