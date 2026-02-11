import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Settings2, X } from "lucide-react";
import { GroupCategory } from "@/types/schematic";

interface GroupCategoryDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (name: string, category?: string, tags?: string[]) => void;
  categories: GroupCategory[];
  onManageCategories: () => void;
  initialName?: string;
}

export function GroupCategoryDialog({
  open,
  onClose,
  onConfirm,
  categories,
  onManageCategories,
  initialName,
}: GroupCategoryDialogProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const groupName = initialName || "";

  const selectedCategoryObj = categories.find(c => c.name === selectedCategory);
  const availableTags = selectedCategoryObj?.tags || [];

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleConfirm = () => {
    if (!groupName.trim()) return;
    onConfirm(
      groupName.trim(),
      selectedCategory || undefined,
      selectedTags.length > 0 ? selectedTags : undefined
    );
    resetAndClose();
  };

  const resetAndClose = () => {
    setSelectedCategory("");
    setSelectedTags([]);
    onClose();
  };

  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value === "__none__" ? "" : value);
    setSelectedTags([]);
  };

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gruppe erstellen: {groupName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Kategorie (optional)</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={onManageCategories}
              >
                <Settings2 className="w-3 h-3" />
                Verwalten
              </Button>
            </div>
            <Select value={selectedCategory || "__none__"} onValueChange={handleCategoryChange}>
              <SelectTrigger>
                <SelectValue placeholder="Keine Kategorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Keine Kategorie</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {availableTags.length > 0 && (
            <div className="space-y-2">
              <Label>Tags (optional)</Label>
              <div className="flex flex-wrap gap-1.5">
                {availableTags.map(tag => (
                  <Badge
                    key={tag}
                    variant={selectedTags.includes(tag) ? "default" : "outline"}
                    className="cursor-pointer text-xs"
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                    {selectedTags.includes(tag) && <X className="w-3 h-3 ml-1" />}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={resetAndClose}>Abbrechen</Button>
          <Button onClick={handleConfirm} disabled={!groupName.trim()}>
            Gruppe erstellen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
