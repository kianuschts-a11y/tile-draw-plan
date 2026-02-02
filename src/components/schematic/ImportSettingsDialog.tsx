import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Trash2, Settings } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

// Default column mappings - Menge wird automatisch berechnet
const DEFAULT_COLUMN_MAPPINGS: ColumnMapping[] = [
  { id: 'komponente', label: 'Komponente', columnName: 'Objektbezeichnung1', required: true },
  { id: 'kategorie', label: 'Kategorie', columnName: 'Kategorie', required: false },
  { id: 'preis', label: 'Preis', columnName: 'Preis', required: false },
  { id: 'beschreibung', label: 'Beschreibung', columnName: 'Beschreibung', required: false },
];

export interface ColumnMapping {
  id: string;
  label: string;
  columnName: string;
  required: boolean;
}

interface ImportSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columnMappings: ColumnMapping[];
  onColumnMappingsChange: (mappings: ColumnMapping[]) => void;
}

export function ImportSettingsDialog({
  open,
  onOpenChange,
  columnMappings,
  onColumnMappingsChange
}: ImportSettingsDialogProps) {
  const [localMappings, setLocalMappings] = useState<ColumnMapping[]>(columnMappings);

  useEffect(() => {
    if (open) {
      setLocalMappings([...columnMappings]);
    }
  }, [open, columnMappings]);

  const updateMapping = (id: string, field: keyof ColumnMapping, value: string | boolean) => {
    setLocalMappings(prev => prev.map(m => 
      m.id === id ? { ...m, [field]: value } : m
    ));
  };

  const addCustomMapping = () => {
    const newId = `custom_${Date.now()}`;
    const newMapping: ColumnMapping = {
      id: newId,
      label: 'Neue Spalte',
      columnName: '',
      required: false
    };
    setLocalMappings(prev => [...prev, newMapping]);
  };

  const removeMapping = (id: string) => {
    // Don't allow removing the komponente mapping
    if (id === 'komponente') return;
    setLocalMappings(prev => prev.filter(m => m.id !== id));
  };

  const handleSave = () => {
    onColumnMappingsChange(localMappings);
    onOpenChange(false);
  };

  const handleReset = () => {
    setLocalMappings([...DEFAULT_COLUMN_MAPPINGS]);
  };

  const isDefaultMapping = (id: string) => {
    return ['komponente', 'kategorie', 'preis', 'beschreibung'].includes(id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Import-Einstellungen
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          <p className="text-sm text-muted-foreground flex-shrink-0">
            Konfigurieren Sie, welche Spalten aus der Import-Datei gelesen werden sollen. 
            Die Menge wird automatisch durch Zählen identischer Zeilen berechnet.
          </p>

          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4 pb-2">
              {localMappings.map((mapping) => (
                <div key={mapping.id} className="flex items-end gap-2">
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">
                        {isDefaultMapping(mapping.id) ? mapping.label : (
                          <Input
                            value={mapping.label}
                            onChange={(e) => updateMapping(mapping.id, 'label', e.target.value)}
                            placeholder="Feldname..."
                            className="h-6 text-xs px-2"
                          />
                        )}
                      </Label>
                      {mapping.id === 'komponente' && (
                        <span className="text-xs text-destructive">*</span>
                      )}
                    </div>
                    <Input
                      value={mapping.columnName}
                      onChange={(e) => updateMapping(mapping.id, 'columnName', e.target.value)}
                      placeholder="Spaltenname in Datei..."
                      className="h-9 text-sm"
                    />
                  </div>
                  {!isDefaultMapping(mapping.id) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-9 w-9 p-0 flex-shrink-0"
                      onClick={() => removeMapping(mapping.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>

          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1 flex-shrink-0"
            onClick={addCustomMapping}
            type="button"
          >
            <Plus className="w-4 h-4" />
            Eigene Spalte hinzufügen
          </Button>

          <p className="text-xs text-muted-foreground flex-shrink-0">
            * Pflichtfeld. Komponente wird gegen vorhandene Komponenten abgeglichen.
            Identische Zeilen werden zusammengefasst und als Menge gezählt.
          </p>
        </div>

        <DialogFooter className="gap-2 flex-shrink-0">
          <Button variant="outline" onClick={handleReset} type="button">
            Zurücksetzen
          </Button>
          <Button onClick={handleSave} type="button">
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { DEFAULT_COLUMN_MAPPINGS };
