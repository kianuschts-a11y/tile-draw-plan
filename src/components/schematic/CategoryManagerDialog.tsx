import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pencil, X, Check } from "lucide-react";
import { GroupCategory } from "@/types/schematic";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CategoryManagerDialogProps {
  open: boolean;
  onClose: () => void;
  categories: GroupCategory[];
  onCreateCategory: (name: string, tags: string[]) => Promise<GroupCategory | null>;
  onUpdateCategory: (id: string, name: string, tags: string[]) => Promise<boolean>;
  onDeleteCategory: (id: string) => Promise<boolean>;
}

export function CategoryManagerDialog({
  open,
  onClose,
  categories,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
}: CategoryManagerDialogProps) {
  const [newName, setNewName] = useState("");
  const [newTagInput, setNewTagInput] = useState("");
  const [newTags, setNewTags] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editTagInput, setEditTagInput] = useState("");

  const handleAddTag = (input: string, setTags: React.Dispatch<React.SetStateAction<string[]>>, setInput: React.Dispatch<React.SetStateAction<string>>) => {
    const tag = input.trim();
    if (tag) {
      setTags(prev => prev.includes(tag) ? prev : [...prev, tag]);
      setInput("");
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await onCreateCategory(newName.trim(), newTags);
    setNewName("");
    setNewTags([]);
  };

  const startEdit = (cat: GroupCategory) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditTags([...cat.tags]);
    setEditTagInput("");
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    await onUpdateCategory(editingId, editName.trim(), editTags);
    setEditingId(null);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Kategorien verwalten</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[400px]">
          <div className="space-y-3 pr-2">
            {categories.map(cat => (
              <div key={cat.id} className="border rounded-lg p-3 space-y-2">
                {editingId === cat.id ? (
                  <>
                    <div className="flex gap-2">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="text-sm"
                        autoFocus
                      />
                      <Button size="sm" variant="ghost" className="h-9 w-9 p-0" onClick={saveEdit}>
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-9 w-9 p-0" onClick={() => setEditingId(null)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {editTags.map(tag => (
                        <Badge key={tag} variant="secondary" className="text-xs gap-1">
                          {tag}
                          <X className="w-3 h-3 cursor-pointer" onClick={() => setEditTags(prev => prev.filter(t => t !== tag))} />
                        </Badge>
                      ))}
                    </div>
                    <div className="flex gap-1">
                      <Input
                        value={editTagInput}
                        onChange={(e) => setEditTagInput(e.target.value)}
                        placeholder="Neuer Tag..."
                        className="text-xs h-7"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddTag(editTagInput, setEditTags, setEditTagInput);
                          }
                        }}
                      />
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleAddTag(editTagInput, setEditTags, setEditTagInput)}>
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex items-start justify-between">
                    <div className="space-y-1.5">
                      <p className="text-sm font-medium">{cat.name}</p>
                      {cat.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {cat.tags.map(tag => (
                            <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEdit(cat)}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => onDeleteCategory(cat.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Add new category */}
        <div className="border-t pt-4 space-y-3">
          <Label className="text-sm font-medium">Neue Kategorie</Label>
          <div className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Kategoriename"
              className="text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newName.trim()) handleCreate();
              }}
            />
            <Button size="sm" onClick={handleCreate} disabled={!newName.trim()}>
              <Plus className="w-4 h-4 mr-1" />
              Hinzufügen
            </Button>
          </div>
          {newTags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {newTags.map(tag => (
                <Badge key={tag} variant="secondary" className="text-xs gap-1">
                  {tag}
                  <X className="w-3 h-3 cursor-pointer" onClick={() => setNewTags(prev => prev.filter(t => t !== tag))} />
                </Badge>
              ))}
            </div>
          )}
          <div className="flex gap-1">
            <Input
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              placeholder="Tag hinzufügen..."
              className="text-xs h-7"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddTag(newTagInput, setNewTags, setNewTagInput);
                }
              }}
            />
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleAddTag(newTagInput, setNewTags, setNewTagInput)}>
              <Plus className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
