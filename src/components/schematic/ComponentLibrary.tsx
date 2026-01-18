import { useState } from "react";
import { Component, Shape, ComponentGroup } from "@/types/schematic";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Pencil, Upload, FolderPlus, Folder } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface ComponentLibraryProps {
  components: Component[];
  groups: ComponentGroup[];
  selectedComponentIds: Set<string>;
  onCreateNew: () => void;
  onDeleteComponent: (id: string) => void;
  onClearAll: () => void;
  onDragStart: (e: React.DragEvent, component: Component) => void;
  onEditComponent: (component: Component) => void;
  onUpdateComponent: (component: Component) => void;
  onImportFromLocalStorage?: () => void;
  hasLocalStorageComponents?: boolean;
  onCreateGroup: (name: string, componentIds: string[]) => void;
  onDeleteGroup: (id: string) => void;
  onEditGroup: (group: ComponentGroup) => void;
  onComponentSelect: (id: string, multiSelect: boolean) => void;
  activeTab: 'components' | 'groups';
  onTabChange: (tab: 'components' | 'groups') => void;
}

function renderShape(shape: Shape, scaleX: number = 50, scaleY: number = 50) {
  const x = shape.x * scaleX;
  const y = shape.y * scaleY;
  const width = shape.width * scaleX;
  const height = shape.height * scaleY;
  const refScale = Math.min(scaleX, scaleY);
  const sw = shape.strokeWidth ? shape.strokeWidth * refScale : 1.5;

  const style = {
    fill: shape.fillColor || shape.fill || 'none',
    stroke: 'hsl(220, 25%, 20%)',
    strokeWidth: Math.max(0.5, sw)
  };

  const rotation = shape.rotation || 0;
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const rotationTransform = rotation !== 0 ? `rotate(${rotation}, ${centerX}, ${centerY})` : undefined;

  let element: React.ReactNode = null;

  switch (shape.type) {
    case 'rectangle':
      element = <rect x={x} y={y} width={width} height={height} {...style} />;
      break;
    case 'circle':
    case 'ellipse':
      element = <ellipse cx={x + width / 2} cy={y + height / 2} rx={width / 2} ry={height / 2} {...style} />;
      break;
    case 'line': {
      if (shape.curveOffset && (shape.curveOffset.x !== 0 || shape.curveOffset.y !== 0)) {
        const lx1 = x;
        const ly1 = y;
        const lx2 = x + width;
        const ly2 = y + height;
        const midX = (lx1 + lx2) / 2;
        const midY = (ly1 + ly2) / 2;
        const cx = midX + shape.curveOffset.x * scaleX;
        const cy = midY + shape.curveOffset.y * scaleY;
        element = <path d={`M ${lx1} ${ly1} Q ${cx} ${cy} ${lx2} ${ly2}`} fill="none" stroke={style.stroke} strokeWidth={style.strokeWidth} strokeLinecap="round" />;
      } else {
        element = <line x1={x} y1={y} x2={x + width} y2={y + height} {...style} strokeLinecap="round" />;
      }
      break;
    }
    case 'arrow': {
      const ax1 = x;
      const ay1 = y;
      const ax2 = x + width;
      const ay2 = y + height;
      const arrowSize = shape.arrowSize ? shape.arrowSize * refScale : Math.max(3, sw * 2);
      
      let endAngle: number;
      if (shape.curveOffset && (shape.curveOffset.x !== 0 || shape.curveOffset.y !== 0)) {
        const midX = (ax1 + ax2) / 2;
        const midY = (ay1 + ay2) / 2;
        const cx = midX + shape.curveOffset.x * scaleX;
        const cy = midY + shape.curveOffset.y * scaleY;
        endAngle = Math.atan2(ay2 - cy, ax2 - cx);
      } else {
        endAngle = Math.atan2(height, width);
      }
      
      const arrowAngle = Math.PI / 6;
      const ahx1 = ax2 - arrowSize * Math.cos(endAngle - arrowAngle);
      const ahy1 = ay2 - arrowSize * Math.sin(endAngle - arrowAngle);
      const ahx2 = ax2 - arrowSize * Math.cos(endAngle + arrowAngle);
      const ahy2 = ay2 - arrowSize * Math.sin(endAngle + arrowAngle);
      
      if (shape.curveOffset && (shape.curveOffset.x !== 0 || shape.curveOffset.y !== 0)) {
        const midX = (ax1 + ax2) / 2;
        const midY = (ay1 + ay2) / 2;
        const cx = midX + shape.curveOffset.x * scaleX;
        const cy = midY + shape.curveOffset.y * scaleY;
        element = (
          <>
            <path d={`M ${ax1} ${ay1} Q ${cx} ${cy} ${ax2} ${ay2}`} fill="none" stroke={style.stroke} strokeWidth={style.strokeWidth} strokeLinecap="round" />
            <polyline points={`${ahx1},${ahy1} ${ax2},${ay2} ${ahx2},${ahy2}`} fill="none" stroke={style.stroke} strokeWidth={style.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
          </>
        );
      } else {
        element = (
          <>
            <line x1={ax1} y1={ay1} x2={ax2} y2={ay2} {...style} strokeLinecap="round" />
            <polyline points={`${ahx1},${ahy1} ${ax2},${ay2} ${ahx2},${ahy2}`} fill="none" stroke={style.stroke} strokeWidth={style.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
          </>
        );
      }
      break;
    }
    case 'triangle':
      element = <polygon points={`${x + width / 2},${y} ${x},${y + height} ${x + width},${y + height}`} {...style} />;
      break;
    case 'diamond':
      element = <polygon points={`${x + width / 2},${y} ${x + width},${y + height / 2} ${x + width / 2},${y + height} ${x},${y + height / 2}`} {...style} />;
      break;
    case 'polyline':
      if (!shape.points || shape.points.length < 2) return null;
      element = <polyline points={shape.points.map(p => `${p.x * scaleX},${p.y * scaleY}`).join(' ')} fill="none" stroke={style.stroke} strokeWidth={style.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />;
      break;
    case 'arc': {
      const rx = width / 2;
      const ry = height / 2;
      const cx = x + rx;
      const cy = y + ry;
      const startRad = ((shape.startAngle || 0) * Math.PI) / 180;
      const endRad = ((shape.endAngle || 180) * Math.PI) / 180;
      const arcX1 = cx + rx * Math.cos(startRad);
      const arcY1 = cy + ry * Math.sin(startRad);
      const arcX2 = cx + rx * Math.cos(endRad);
      const arcY2 = cy + ry * Math.sin(endRad);
      const largeArc = (shape.endAngle || 180) - (shape.startAngle || 0) > 180 ? 1 : 0;
      element = <path d={`M ${arcX1} ${arcY1} A ${rx} ${ry} 0 ${largeArc} 1 ${arcX2} ${arcY2}`} fill="none" stroke={style.stroke} strokeWidth={style.strokeWidth} />;
      break;
    }
    case 'text': {
      const fontSize = shape.fontSize ? shape.fontSize * refScale : 4;
      element = <text x={x} y={y + fontSize} fontSize={Math.max(4, fontSize)} fontFamily={shape.fontFamily || 'sans-serif'} fill={style.stroke}>{shape.text}</text>;
      break;
    }
    case 'polygon':
      if (!shape.points || shape.points.length < 3) return null;
      element = <polygon points={shape.points.map(p => `${p.x * scaleX},${p.y * scaleY}`).join(' ')} {...style} />;
      break;
    default:
      return null;
  }

  if (rotationTransform) {
    return <g transform={rotationTransform}>{element}</g>;
  }
  return element;
}

export function ComponentLibrary({ 
  components, 
  groups,
  selectedComponentIds,
  onCreateNew, 
  onDeleteComponent,
  onClearAll,
  onDragStart,
  onEditComponent,
  onUpdateComponent,
  onImportFromLocalStorage,
  hasLocalStorageComponents,
  onCreateGroup,
  onDeleteGroup,
  onEditGroup,
  onComponentSelect,
  activeTab,
  onTabChange
}: ComponentLibraryProps) {
  const previewSize = 50;
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [componentToDelete, setComponentToDelete] = useState<Component | null>(null);
  const [clearAllConfirmOpen, setClearAllConfirmOpen] = useState(false);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [groupToDelete, setGroupToDelete] = useState<ComponentGroup | null>(null);
  const [deleteGroupConfirmOpen, setDeleteGroupConfirmOpen] = useState(false);

  const handleDeleteClick = (component: Component) => {
    setComponentToDelete(component);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (componentToDelete) {
      onDeleteComponent(componentToDelete.id);
    }
    setDeleteConfirmOpen(false);
    setComponentToDelete(null);
  };

  const confirmClearAll = () => {
    onClearAll();
    setClearAllConfirmOpen(false);
  };

  const handleCreateGroup = () => {
    if (newGroupName.trim() && selectedComponentIds.size > 0) {
      onCreateGroup(newGroupName.trim(), Array.from(selectedComponentIds));
      setNewGroupName("");
      setGroupDialogOpen(false);
    }
  };

  const handleDeleteGroupClick = (group: ComponentGroup) => {
    setGroupToDelete(group);
    setDeleteGroupConfirmOpen(true);
  };

  const confirmDeleteGroup = () => {
    if (groupToDelete) {
      onDeleteGroup(groupToDelete.id);
    }
    setDeleteGroupConfirmOpen(false);
    setGroupToDelete(null);
  };

  const renderComponentItem = (component: Component, isSelected: boolean) => {
    const compWidth = component.width || 1;
    const compHeight = component.height || 1;
    const aspectRatio = compWidth / compHeight;
    
    let previewWidth = previewSize;
    let previewHeight = previewSize;
    if (aspectRatio > 1) {
      previewHeight = previewSize / aspectRatio;
    } else if (aspectRatio < 1) {
      previewWidth = previewSize * aspectRatio;
    }
    
    return (
      <ContextMenu key={component.id}>
        <ContextMenuTrigger>
          <div
            className={`library-item flex flex-col items-center gap-2 relative group cursor-pointer ${
              isSelected ? 'ring-2 ring-primary rounded-lg' : ''
            }`}
            draggable
            onDragStart={(e) => onDragStart(e, component)}
            onClick={(e) => onComponentSelect(component.id, e.shiftKey || e.ctrlKey)}
          >
            <div className={`w-[50px] h-[50px] flex items-center justify-center border border-dashed rounded bg-white relative ${
              isSelected ? 'border-primary' : 'border-muted-foreground/30'
            }`}>
              <svg width={previewWidth} height={previewHeight}>
                {component.shapes.map((shape, idx) => (
                  <g key={idx}>{renderShape(shape, previewWidth, previewHeight)}</g>
                ))}
              </svg>
              {component.variations && component.variations.length > 0 && (
                <div className="absolute -top-1 -left-1 w-4 h-4 bg-primary text-primary-foreground rounded-full text-[10px] flex items-center justify-center font-medium">
                  {component.variations.length}
                </div>
              )}
            </div>
            <span className="text-xs text-muted-foreground text-center truncate w-full">
              {component.name}
            </span>
            {!component.id.startsWith('default-') && (
              <button
                className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteClick(component);
                }}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => onEditComponent(component)}>
            <Pencil className="w-4 h-4 mr-2" />
            Bearbeiten
          </ContextMenuItem>
          <ContextMenuItem 
            onClick={() => handleDeleteClick(component)}
            className="text-destructive"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Löschen
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  const renderGroupItem = (group: ComponentGroup) => {
    const groupComponents = components.filter(c => group.componentIds.includes(c.id));
    
    return (
      <ContextMenu key={group.id}>
        <ContextMenuTrigger>
          <div
            className="library-item flex flex-col items-center gap-2 relative group cursor-pointer"
            draggable
            onDragStart={(e) => {
              // Drag all components in the group
              e.dataTransfer.setData('application/json', JSON.stringify({ 
                isGroup: true, 
                groupId: group.id,
                components: groupComponents 
              }));
              e.dataTransfer.effectAllowed = 'copy';
            }}
          >
            <div className="w-[50px] h-[50px] flex items-center justify-center border border-dashed border-muted-foreground/30 rounded bg-muted/50 relative">
              <Folder className="w-6 h-6 text-muted-foreground" />
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground rounded-full text-[10px] flex items-center justify-center font-medium">
                {group.componentIds.length}
              </div>
            </div>
            <span className="text-xs text-muted-foreground text-center truncate w-full">
              {group.name}
            </span>
            <button
              className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteGroupClick(group);
              }}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => onEditGroup(group)}>
            <Pencil className="w-4 h-4 mr-2" />
            Bearbeiten
          </ContextMenuItem>
          <ContextMenuItem 
            onClick={() => handleDeleteGroupClick(group)}
            className="text-destructive"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Löschen
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  return (
    <div className="toolbar-panel border-l w-64 flex flex-col">
      <div className="p-3 border-b">
        <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as 'components' | 'groups')}>
          <TabsList className="w-full">
            <TabsTrigger value="components" className="flex-1 text-xs">Komponenten</TabsTrigger>
            <TabsTrigger value="groups" className="flex-1 text-xs">Gruppen</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="p-3 border-b">
        <div className="flex items-center justify-between">
          {activeTab === 'components' ? (
            <>
              <div className="flex gap-1">
                {components.length > 0 && (
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => setClearAllConfirmOpen(true)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
                <Button size="sm" variant="outline" className="h-7 gap-1" onClick={onCreateNew}>
                  <Plus className="w-3 h-3" />
                  Neu
                </Button>
              </div>
              {selectedComponentIds.size > 1 && (
                <Button size="sm" variant="secondary" className="h-7 gap-1" onClick={() => setGroupDialogOpen(true)}>
                  <FolderPlus className="w-3 h-3" />
                  Gruppieren
                </Button>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              {groups.length} Gruppe{groups.length !== 1 ? 'n' : ''}
            </p>
          )}
        </div>
        {activeTab === 'components' && selectedComponentIds.size > 0 && (
          <p className="text-xs text-muted-foreground mt-2">
            {selectedComponentIds.size} ausgewählt (Shift+Klick für Mehrfachauswahl)
          </p>
        )}
      </div>
      
      <ScrollArea className="flex-1 p-3">
        {activeTab === 'components' ? (
          <div className="grid grid-cols-2 gap-2">
            {components.map(component => renderComponentItem(component, selectedComponentIds.has(component.id)))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {groups.map(group => renderGroupItem(group))}
          </div>
        )}

        {activeTab === 'components' && components.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">Keine Komponenten</p>
            <p className="text-xs mt-1">Erstellen Sie eine neue Komponente</p>
            {hasLocalStorageComponents && onImportFromLocalStorage && (
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-4 gap-2"
                onClick={onImportFromLocalStorage}
              >
                <Upload className="w-4 h-4" />
                Lokale Komponenten importieren
              </Button>
            )}
          </div>
        )}

        {activeTab === 'groups' && groups.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">Keine Gruppen</p>
            <p className="text-xs mt-1">Wählen Sie Komponenten aus und klicken Sie auf "Gruppieren"</p>
          </div>
        )}
      </ScrollArea>

      {/* Create Group Dialog */}
      <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neue Gruppe erstellen</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Gruppenname"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()}
            />
            <p className="text-sm text-muted-foreground mt-2">
              {selectedComponentIds.size} Komponenten werden gruppiert
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleCreateGroup} disabled={!newGroupName.trim()}>
              Erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Component Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Komponente löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie die Komponente "{componentToDelete?.name}" wirklich löschen? 
              Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Group Confirmation Dialog */}
      <AlertDialog open={deleteGroupConfirmOpen} onOpenChange={setDeleteGroupConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gruppe löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie die Gruppe "{groupToDelete?.name}" wirklich löschen? 
              Die Komponenten bleiben erhalten.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteGroup} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear All Confirmation Dialog */}
      <AlertDialog open={clearAllConfirmOpen} onOpenChange={setClearAllConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alle Komponenten löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie wirklich alle {components.length} Komponenten löschen? 
              Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={confirmClearAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Alle löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
