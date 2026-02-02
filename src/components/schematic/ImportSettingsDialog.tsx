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

// Default column mappings
const DEFAULT_COLUMN_MAPPINGS: ColumnMapping[] = [
  { id: 'komponente', label: 'Komponente', columnName: 'Komponente', required: true },
  { id: 'menge', label: 'Menge', columnName: 'Menge', required: true },
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
    setLocalMappings(prev => [...prev, {
      id: newId,
      label: 'Neue Spalte',
      columnName: '',
      required: false
    }]);
  };

  const removeMapping = (id: string) => {
    // Don't allow removing required mappings (komponente, menge)
    const mapping = localMappings.find(m => m.id === id);
    if (mapping?.id === 'komponente' || mapping?.id === 'menge') return;
    
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
    return ['komponente', 'menge', 'kategorie', 'preis', 'beschreibung'].includes(id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Import-Einstellungen
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Konfigurieren Sie, welche Spalten aus der Import-Datei gelesen werden sollen.
          </p>

          <ScrollArea className="max-h-[300px]">
            <div className="space-y-3 pr-4">
              {localMappings.map((mapping) => (
                <div key={mapping.id} className="flex items-center gap-2">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs text-muted-foreground">{mapping.label}</Label>
                    <Input
                      value={mapping.columnName}
                      onChange={(e) => updateMapping(mapping.id, 'columnName', e.target.value)}
                      placeholder="Spaltenname in Datei..."
                      className="h-8 text-sm"
                    />
                  </div>
                  {!isDefaultMapping(mapping.id) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 mt-5"
                      onClick={() => removeMapping(mapping.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                  {mapping.id === 'komponente' || mapping.id === 'menge' ? (
                    <span className="text-xs text-muted-foreground mt-5">*</span>
                  ) : null}
                </div>
              ))}
            </div>
          </ScrollArea>

          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1"
            onClick={addCustomMapping}
          >
            <Plus className="w-4 h-4" />
            Eigene Spalte hinzufügen
          </Button>

          <p className="text-xs text-muted-foreground">
            * Pflichtfelder. Komponente wird gegen vorhandene Komponenten abgeglichen.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleReset}>
            Zurücksetzen
          </Button>
          <Button onClick={handleSave}>
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { DEFAULT_COLUMN_MAPPINGS };
