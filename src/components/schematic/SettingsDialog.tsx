import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Pencil, X, Check } from "lucide-react";
import { GroupCategory } from "@/types/schematic";
import { Checkbox } from "@/components/ui/checkbox";

// Settings stored in localStorage
export interface AppSettings {
  groupInfo: {
    showComponents: boolean;
    showMeasurementInstruments: boolean;
    showConnectionLines: boolean;
    showConnectionComponents: boolean;
  };
  bomCategoryFilter: string[]; // category names to EXCLUDE from BOM
  messkonzeptCategoryFilter: string[]; // category names to EXCLUDE from Messkonzept
}

const SETTINGS_STORAGE_KEY = 'schematic-editor-settings';

export const DEFAULT_SETTINGS: AppSettings = {
  groupInfo: {
    showComponents: true,
    showMeasurementInstruments: true,
    showConnectionLines: false,
    showConnectionComponents: false,
  },
  bomCategoryFilter: [],
  messkonzeptCategoryFilter: [],
};

export function loadSettings(): AppSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_SETTINGS, ...parsed, groupInfo: { ...DEFAULT_SETTINGS.groupInfo, ...parsed?.groupInfo } };
    }
  } catch { /* fall through */ }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  categories: GroupCategory[];
  onCreateCategory: (name: string, tags: string[]) => Promise<GroupCategory | null>;
  onUpdateCategory: (id: string, name: string, tags: string[]) => Promise<boolean>;
  onDeleteCategory: (id: string) => Promise<boolean>;
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
}

export function SettingsDialog({
  open,
  onClose,
  categories,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
  settings,
  onSettingsChange,
}: SettingsDialogProps) {
  // Category manager state
  const [newName, setNewName] = useState("");
  const [newTagInput, setNewTagInput] = useState("");
  const [newTags, setNewTags] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editTagInput, setEditTagInput] = useState("");

  const updateGroupInfo = (key: keyof AppSettings['groupInfo'], value: boolean) => {
    const updated = { ...settings, groupInfo: { ...settings.groupInfo, [key]: value } };
    onSettingsChange(updated);
    saveSettings(updated);
  };

  const toggleBomExclude = (categoryName: string) => {
    const excluded = settings.bomCategoryFilter.includes(categoryName)
      ? settings.bomCategoryFilter.filter(c => c !== categoryName)
      : [...settings.bomCategoryFilter, categoryName];
    const updated = { ...settings, bomCategoryFilter: excluded };
    onSettingsChange(updated);
    saveSettings(updated);
  };

  const toggleMesskonzeptExclude = (categoryName: string) => {
    const excluded = settings.messkonzeptCategoryFilter.includes(categoryName)
      ? settings.messkonzeptCategoryFilter.filter(c => c !== categoryName)
      : [...settings.messkonzeptCategoryFilter, categoryName];
    const updated = { ...settings, messkonzeptCategoryFilter: excluded };
    onSettingsChange(updated);
    saveSettings(updated);
  };

  // Category CRUD
  const handleAddTag = (input: string, setTagsFn: React.Dispatch<React.SetStateAction<string[]>>, setInputFn: React.Dispatch<React.SetStateAction<string>>) => {
    const tag = input.trim();
    if (tag) {
      setTagsFn(prev => prev.includes(tag) ? prev : [...prev, tag]);
      setInputFn("");
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
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Einstellungen</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="groupInfo" className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="groupInfo">Gruppen-/Projektinfo</TabsTrigger>
            <TabsTrigger value="categories">Kategorien</TabsTrigger>
            <TabsTrigger value="filters">Listen-Filter</TabsTrigger>
          </TabsList>

          {/* Tab: Gruppeninfo */}
          <TabsContent value="groupInfo" className="flex-1 overflow-auto space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Welche Elemente sollen in den Gruppen- und Projektinformationen angezeigt werden?
            </p>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="show-components">Komponenten</Label>
                <Switch
                  id="show-components"
                  checked={settings.groupInfo.showComponents}
                  onCheckedChange={(v) => updateGroupInfo('showComponents', v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="show-measurement">Messinstrumente</Label>
                <Switch
                  id="show-measurement"
                  checked={settings.groupInfo.showMeasurementInstruments}
                  onCheckedChange={(v) => updateGroupInfo('showMeasurementInstruments', v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="show-conn-lines">Verbindungslinien</Label>
                <Switch
                  id="show-conn-lines"
                  checked={settings.groupInfo.showConnectionLines}
                  onCheckedChange={(v) => updateGroupInfo('showConnectionLines', v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="show-conn-comps">Verbindungskomponenten</Label>
                <Switch
                  id="show-conn-comps"
                  checked={settings.groupInfo.showConnectionComponents}
                  onCheckedChange={(v) => updateGroupInfo('showConnectionComponents', v)}
                />
              </div>
            </div>
          </TabsContent>

          {/* Tab: Kategorien verwalten */}
          <TabsContent value="categories" className="flex-1 flex flex-col min-h-0 py-2">
            <ScrollArea className="flex-1 max-h-[300px]">
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
                {categories.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Keine Kategorien vorhanden</p>
                )}
              </div>
            </ScrollArea>

            {/* Add new category */}
            <div className="border-t pt-4 space-y-3 mt-2">
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
          </TabsContent>

          {/* Tab: Listen-Filter (BOM & Messkonzept) */}
          <TabsContent value="filters" className="flex-1 overflow-auto space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Wähle aus, welche Kategorien in der Stückliste und im Messkonzept angezeigt werden sollen.
            </p>

            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Keine Kategorien vorhanden. Erstelle zuerst Kategorien im Tab "Kategorien".</p>
            ) : (
              <div className="space-y-4">
                {/* BOM Filter */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Stückliste (BOM)</Label>
                  <div className="space-y-2 pl-1">
                    {categories.map(cat => (
                      <div key={cat.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`bom-${cat.id}`}
                          checked={!settings.bomCategoryFilter.includes(cat.name)}
                          onCheckedChange={() => toggleBomExclude(cat.name)}
                        />
                        <Label htmlFor={`bom-${cat.id}`} className="text-sm cursor-pointer">
                          {cat.name}
                        </Label>
                      </div>
                    ))}
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="bom-uncategorized"
                        checked={!settings.bomCategoryFilter.includes('__uncategorized__')}
                        onCheckedChange={() => toggleBomExclude('__uncategorized__')}
                      />
                      <Label htmlFor="bom-uncategorized" className="text-sm cursor-pointer text-muted-foreground">
                        Ohne Kategorie
                      </Label>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Messkonzept Filter */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Messkonzept</Label>
                  <div className="space-y-2 pl-1">
                    {categories.map(cat => (
                      <div key={cat.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`mk-${cat.id}`}
                          checked={!settings.messkonzeptCategoryFilter.includes(cat.name)}
                          onCheckedChange={() => toggleMesskonzeptExclude(cat.name)}
                        />
                        <Label htmlFor={`mk-${cat.id}`} className="text-sm cursor-pointer">
                          {cat.name}
                        </Label>
                      </div>
                    ))}
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="mk-uncategorized"
                        checked={!settings.messkonzeptCategoryFilter.includes('__uncategorized__')}
                        onCheckedChange={() => toggleMesskonzeptExclude('__uncategorized__')}
                      />
                      <Label htmlFor="mk-uncategorized" className="text-sm cursor-pointer text-muted-foreground">
                        Ohne Kategorie
                      </Label>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
