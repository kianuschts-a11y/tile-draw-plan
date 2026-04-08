import { useEffect, useMemo, useState } from "react";
import { Component } from "@/types/schematic";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface ComponentFilterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  components: Component[];
  excludedComponentIds: Set<string>;
  onExcludedComponentIdsChange: (ids: Set<string>) => void;
}

export function ComponentFilterDialog({
  open,
  onOpenChange,
  components,
  excludedComponentIds,
  onExcludedComponentIdsChange,
}: ComponentFilterDialogProps) {
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open) {
      setSearch("");
    }
  }, [open]);

  const filteredComponents = useMemo(() => {
    const term = search.toLowerCase().trim();
    const sorted = [...components].sort((a, b) => a.name.localeCompare(b.name));
    if (!term) return sorted;
    return sorted.filter(c => c.name.toLowerCase().includes(term));
  }, [components, search]);

  const toggleComponent = (id: string) => {
    const next = new Set(excludedComponentIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onExcludedComponentIdsChange(next);
  };

  const selectAll = () => {
    onExcludedComponentIdsChange(new Set());
  };

  const deselectAll = () => {
    onExcludedComponentIdsChange(new Set(components.map(c => c.id)));
  };

  const includedCount = components.filter(comp => !excludedComponentIds.has(comp.id)).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Komponenten-Filter</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 mb-2">
          <Button variant="outline" size="sm" onClick={selectAll}>
            Alle auswählen
          </Button>
          <Button variant="outline" size="sm" onClick={deselectAll}>
            Alle abwählen
          </Button>
          <span className="text-xs text-muted-foreground ml-auto">
            {includedCount}/{components.length}
          </span>
        </div>

        <Input
          placeholder="Komponente suchen..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-2"
        />

        <div className="border rounded-md p-2 overflow-y-auto" style={{ maxHeight: '50vh' }}>
          <div className="space-y-1">
            {filteredComponents.map(comp => (
              <div key={comp.id} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-accent/50">
                <Checkbox
                  id={`filter-${comp.id}`}
                  checked={!excludedComponentIds.has(comp.id)}
                  onCheckedChange={() => toggleComponent(comp.id)}
                />
                <Label
                  htmlFor={`filter-${comp.id}`}
                  className="text-sm cursor-pointer flex-1 leading-tight"
                >
                  {comp.name}
                  {comp.category && (
                    <span className="text-xs text-muted-foreground ml-1">({comp.category})</span>
                  )}
                </Label>
              </div>
            ))}
            {filteredComponents.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Keine Komponenten gefunden.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Schließen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
