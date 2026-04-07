import { useState, useMemo } from "react";
import { Component } from "@/types/schematic";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  const [localExcluded, setLocalExcluded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  // Sync on open
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setLocalExcluded(new Set(excludedComponentIds));
      setSearch("");
    }
    onOpenChange(isOpen);
  };

  const filteredComponents = useMemo(() => {
    const term = search.toLowerCase().trim();
    const sorted = [...components].sort((a, b) => a.name.localeCompare(b.name));
    if (!term) return sorted;
    return sorted.filter(c => c.name.toLowerCase().includes(term));
  }, [components, search]);

  const toggleComponent = (id: string) => {
    setLocalExcluded(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setLocalExcluded(new Set());
  };

  const deselectAll = () => {
    setLocalExcluded(new Set(components.map(c => c.id)));
  };

  const handleApply = () => {
    onExcludedComponentIdsChange(localExcluded);
    onOpenChange(false);
  };

  const includedCount = components.length - localExcluded.size;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
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

        <ScrollArea className="flex-1 min-h-0 max-h-[40vh] border rounded-md p-2">
          <div className="space-y-1">
            {filteredComponents.map(comp => (
              <div key={comp.id} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-accent/50">
                <Checkbox
                  id={`filter-${comp.id}`}
                  checked={!localExcluded.has(comp.id)}
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
        </ScrollArea>

        <DialogFooter>
          <Button onClick={handleApply}>Übernehmen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
