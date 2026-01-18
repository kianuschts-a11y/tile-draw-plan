import { ComponentGroup, Component } from "@/types/schematic";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface GroupInfoDialogProps {
  group: ComponentGroup | null;
  components: Component[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GroupInfoDialog({ group, components, open, onOpenChange }: GroupInfoDialogProps) {
  if (!group) return null;

  // Count how many times each component appears in the group
  const componentCounts = new Map<string, number>();
  
  if (group.layoutData?.tiles) {
    for (const tile of group.layoutData.tiles) {
      const count = componentCounts.get(tile.componentId) || 0;
      componentCounts.set(tile.componentId, count + 1);
    }
  } else {
    // Fallback to componentIds if no layoutData
    for (const id of group.componentIds) {
      const count = componentCounts.get(id) || 0;
      componentCounts.set(id, count + 1);
    }
  }

  const componentList = Array.from(componentCounts.entries()).map(([id, count]) => {
    const component = components.find(c => c.id === id);
    return {
      id,
      name: component?.name || 'Unbekannt',
      count
    };
  });

  const totalTiles = group.layoutData?.tiles.length || group.componentIds.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Gruppeninformationen
            <Badge variant="secondary">{group.name}</Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="text-sm text-muted-foreground">
            Diese Gruppe enthält {totalTiles} Kachel{totalTiles !== 1 ? 'n' : ''}:
          </div>
          <ScrollArea className="max-h-[300px]">
            <div className="space-y-2">
              {componentList.map(({ id, name, count }) => (
                <div 
                  key={id} 
                  className="flex items-center justify-between p-2 rounded-lg border bg-muted/30"
                >
                  <span className="text-sm font-medium">{name}</span>
                  <Badge variant="outline">{count}×</Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
          {group.layoutData?.connections && group.layoutData.connections.length > 0 && (
            <div className="text-xs text-muted-foreground">
              {group.layoutData.connections.length} Verbindung{group.layoutData.connections.length !== 1 ? 'en' : ''} gespeichert
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
