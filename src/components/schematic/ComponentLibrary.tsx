import { useState, useMemo } from "react";
import { Component, Shape, ComponentGroup } from "@/types/schematic";
import { PlacedTile } from "./Canvas";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Pencil, Upload, Folder, Info } from "lucide-react";
import { CONNECTION_BLOCKS } from "@/lib/connectionBlocks";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
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
import { GroupInfoDialog } from "./GroupInfoDialog";

type LibraryTab = 'components' | 'connections' | 'groups';

interface ComponentLibraryProps {
  components: Component[];
  groups: ComponentGroup[];
  onCreateNew: () => void;
  onDeleteComponent: (id: string) => void;
  onClearAll: () => void;
  onDragStart: (e: React.DragEvent, component: Component) => void;
  onEditComponent: (component: Component) => void;
  onUpdateComponent: (component: Component) => void;
  onImportFromLocalStorage?: () => void;
  hasLocalStorageComponents?: boolean;
  onDeleteGroup: (id: string) => void;
  onEditGroup: (group: ComponentGroup) => void;
  onRenameGroup: (id: string, newName: string) => Promise<boolean>;
  activeTab: LibraryTab;
  onTabChange: (tab: LibraryTab) => void;
  projectQuantities?: Map<string, number>;
  projectOriginalQuantities?: Map<string, number>;
  placedTiles?: PlacedTile[];
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

// Connections tab component
interface ConnectionsTabProps {
  onDragStart: (e: React.DragEvent, component: Component) => void;
}

function ConnectionsTab({ onDragStart }: ConnectionsTabProps) {
  const renderConnectionBlockItem = (block: Component) => {
    return (
      <div
        key={block.id}
        className="library-item flex flex-col items-center gap-1 relative group cursor-grab active:cursor-grabbing p-2 rounded-lg hover:bg-muted/50 transition-colors"
        draggable
        onDragStart={(e) => onDragStart(e, block)}
      >
        <div className="w-[50px] h-[50px] flex items-center justify-center border border-dashed border-muted-foreground/30 rounded bg-white">
          <svg width={40} height={40}>
            {block.shapes.map((shape, idx) => (
              <g key={idx}>{renderShape(shape, 40, 40)}</g>
            ))}
          </svg>
        </div>
        <span className="text-[10px] text-muted-foreground text-center truncate w-full">
          {block.name}
        </span>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      {CONNECTION_BLOCKS.map(block => renderConnectionBlockItem(block))}
    </div>
  );
}

export function ComponentLibrary({ 
  components, 
  groups,
  onCreateNew, 
  onDeleteComponent,
  onClearAll,
  onDragStart,
  onEditComponent,
  onUpdateComponent,
  onImportFromLocalStorage,
  hasLocalStorageComponents,
  onDeleteGroup,
  onEditGroup,
  onRenameGroup,
  activeTab,
  onTabChange,
  projectQuantities,
  projectOriginalQuantities,
  placedTiles
}: ComponentLibraryProps) {
  const previewSize = 50;
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [componentToDelete, setComponentToDelete] = useState<Component | null>(null);
  const [clearAllConfirmOpen, setClearAllConfirmOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<ComponentGroup | null>(null);
  const [deleteGroupConfirmOpen, setDeleteGroupConfirmOpen] = useState(false);
  const [infoGroup, setInfoGroup] = useState<ComponentGroup | null>(null);
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);
  const [renameGroup, setRenameGroup] = useState<ComponentGroup | null>(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");

  // Calculate how many of each component are already placed on canvas
  const placedComponentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    if (placedTiles) {
      for (const tile of placedTiles) {
        const id = tile.component.id;
        counts.set(id, (counts.get(id) || 0) + 1);
      }
    }
    return counts;
  }, [placedTiles]);

  // Calculate remaining quantities based on original quantities - placed count
  // This shows how many more components need to be placed to meet the original requirement
  const remainingQuantities = useMemo(() => {
    const remaining = new Map<string, number>();
    // Use originalQuantities if available, otherwise fall back to projectQuantities
    const targetQuantities = projectOriginalQuantities?.size 
      ? projectOriginalQuantities 
      : projectQuantities;
    
    if (targetQuantities) {
      for (const [id, needed] of targetQuantities.entries()) {
        const placed = placedComponentCounts.get(id) || 0;
        const diff = needed - placed;
        if (diff > 0) {
          remaining.set(id, diff);
        }
      }
    }
    return remaining;
  }, [projectQuantities, projectOriginalQuantities, placedComponentCounts]);

  // Sort components: those with remaining quantities first
  const sortedComponents = useMemo(() => {
    return [...components].sort((a, b) => {
      const aRemaining = remainingQuantities.get(a.id) || 0;
      const bRemaining = remainingQuantities.get(b.id) || 0;
      
      // Components with remaining quantities come first
      if (aRemaining > 0 && bRemaining === 0) return -1;
      if (aRemaining === 0 && bRemaining > 0) return 1;
      
      // Among those with remaining, sort by remaining count (descending)
      if (aRemaining > 0 && bRemaining > 0) {
        return bRemaining - aRemaining;
      }
      
      // Keep original order for others
      return 0;
    });
  }, [components, remainingQuantities]);

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

  const handleRenameGroupClick = (group: ComponentGroup) => {
    setRenameGroup(group);
    setNewGroupName(group.name);
    setRenameDialogOpen(true);
  };

  const confirmRenameGroup = async () => {
    if (renameGroup && newGroupName.trim()) {
      await onRenameGroup(renameGroup.id, newGroupName.trim());
    }
    setRenameDialogOpen(false);
    setRenameGroup(null);
    setNewGroupName("");
  };

  const renderComponentItem = (component: Component) => {
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

    // Get remaining count for this component
    const remainingCount = remainingQuantities.get(component.id) || 0;
    const hasRemaining = remainingCount > 0;
    // Use original quantities for the total display - this shows the ORIGINAL requirement
    const projectTotal = projectOriginalQuantities?.get(component.id) 
      || projectQuantities?.get(component.id) 
      || 0;
    const placedCount = placedComponentCounts.get(component.id) || 0;
    
    return (
      <ContextMenu key={component.id}>
        <ContextMenuTrigger>
          <div
            className={`library-item flex flex-col items-center gap-2 relative group cursor-pointer p-1 rounded-lg transition-all ${
              hasRemaining 
                ? 'ring-2 ring-blue-500 bg-blue-50' 
                : ''
            }`}
            draggable
            onDragStart={(e) => onDragStart(e, component)}
          >
            <div className={`w-[50px] h-[50px] flex items-center justify-center border border-dashed rounded bg-white relative ${
              hasRemaining ? 'border-blue-500' : 'border-muted-foreground/30'
            }`}>
              <svg width={previewWidth} height={previewHeight}>
                {component.shapes.map((shape, idx) => (
                  <g key={idx}>{renderShape(shape, previewWidth, previewHeight)}</g>
                ))}
              </svg>
              {/* Badge showing remaining count */}
              {hasRemaining && (
                <div className="absolute -top-2 -left-2 min-w-5 h-5 px-1 bg-blue-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center">
                  {remainingCount}
                </div>
              )}
            </div>
            <span className="text-xs text-muted-foreground text-center truncate w-full">
              {component.name}
            </span>
            {/* Show placed/total if project has quantities for this component */}
            {projectTotal > 0 && (
              <span className={`text-[10px] ${hasRemaining ? 'text-blue-600 font-medium' : 'text-green-600'}`}>
                {placedCount}/{projectTotal}
              </span>
            )}
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
    const hasLayout = group.layoutData && group.layoutData.tiles.length > 0;
    
    // Render a mini preview of the group layout with actual component shapes
    const renderGroupPreview = () => {
      if (!hasLayout || !group.layoutData) {
        return (
          <div className="w-[80px] h-[80px] flex items-center justify-center">
            <Folder className="w-8 h-8 text-muted-foreground" />
          </div>
        );
      }
      
      // Calculate bounds of the layout based on component sizes
      const tiles = group.layoutData.tiles;
      let totalWidth = 0;
      let totalHeight = 0;
      
      tiles.forEach(tile => {
        // Check both custom components and connection blocks
        const comp = components.find(c => c.id === tile.componentId) 
          || CONNECTION_BLOCKS.find(c => c.id === tile.componentId);
        if (comp) {
          const tileRight = tile.relativeX + (comp.width || 1);
          const tileBottom = tile.relativeY + (comp.height || 1);
          totalWidth = Math.max(totalWidth, tileRight);
          totalHeight = Math.max(totalHeight, tileBottom);
        }
      });
      
      // Calculate scale to fit in preview area (max 100x100)
      const maxPreviewSize = 100;
      const padding = 4;
      const availableSize = maxPreviewSize - padding * 2;
      const scale = Math.min(availableSize / totalWidth, availableSize / totalHeight, 30);
      
      const svgWidth = totalWidth * scale + padding * 2;
      const svgHeight = totalHeight * scale + padding * 2;
      
      return (
        <svg width={svgWidth} height={svgHeight}>
          {tiles.map((tile, idx) => {
            // Check both custom components and connection blocks
            const comp = components.find(c => c.id === tile.componentId)
              || CONNECTION_BLOCKS.find(c => c.id === tile.componentId);
            if (!comp) return null;
            
            const tileX = padding + tile.relativeX * scale;
            const tileY = padding + tile.relativeY * scale;
            const tileW = (comp.width || 1) * scale;
            const tileH = (comp.height || 1) * scale;
            
            // Calculate scale factors for shapes within this tile
            const shapeScaleX = tileW;
            const shapeScaleY = tileH;
            
            return (
              <g key={idx} transform={`translate(${tileX}, ${tileY})`}>
                {/* Tile background */}
                <rect
                  x={0}
                  y={0}
                  width={tileW}
                  height={tileH}
                  fill="white"
                  stroke="hsl(var(--border))"
                  strokeWidth={0.5}
                  strokeDasharray="2,1"
                />
                {/* Render component shapes */}
                {comp.shapes.map((shape, shapeIdx) => (
                  <g key={shapeIdx}>{renderShape(shape, shapeScaleX, shapeScaleY)}</g>
                ))}
              </g>
            );
          })}
        </svg>
      );
    };
    
    return (
      <ContextMenu key={group.id}>
        <ContextMenuTrigger>
          <div
            className="library-item flex flex-col items-center gap-2 relative group cursor-grab active:cursor-grabbing p-1"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('application/json', JSON.stringify({ 
                isGroup: true, 
                groupId: group.id,
                layoutData: group.layoutData
              }));
              e.dataTransfer.effectAllowed = 'copy';
            }}
          >
            <div className="min-w-[80px] min-h-[80px] flex items-center justify-center border border-dashed border-primary/50 rounded bg-white relative p-1">
              {renderGroupPreview()}
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground rounded-full text-[10px] flex items-center justify-center font-medium">
                {group.layoutData?.tiles.length || group.componentIds.length}
              </div>
            </div>
            <span className="text-xs text-muted-foreground text-center truncate w-full max-w-[100px]">
              {group.name}
            </span>
            <button
              className="absolute top-0 right-0 w-5 h-5 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
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
          <ContextMenuItem onClick={() => { setInfoGroup(group); setInfoDialogOpen(true); }}>
            <Info className="w-4 h-4 mr-2" />
            Informationen
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => handleRenameGroupClick(group)}>
            <Pencil className="w-4 h-4 mr-2" />
            Umbenennen
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
        <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as LibraryTab)}>
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="components" className="text-xs px-1">Komp.</TabsTrigger>
            <TabsTrigger value="connections" className="text-xs px-1">Verb.</TabsTrigger>
            <TabsTrigger value="groups" className="text-xs px-1">Gruppen</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="p-3 border-b">
        <div className="flex items-center justify-between">
          {activeTab === 'components' && (
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
            </>
          )}
          {activeTab === 'connections' && (
            <p className="text-xs text-muted-foreground">
              {CONNECTION_BLOCKS.length} Verbindungsblöcke
            </p>
          )}
          {activeTab === 'groups' && (
            <p className="text-xs text-muted-foreground">
              {groups.length} Gruppe{groups.length !== 1 ? 'n' : ''}
            </p>
          )}
        </div>
      </div>
      
      <ScrollArea className="flex-1 p-3">
        {activeTab === 'components' && (
          <div className="grid grid-cols-2 gap-2">
            {sortedComponents.map(component => renderComponentItem(component))}
          </div>
        )}
        
        {activeTab === 'connections' && (
          <ConnectionsTab onDragStart={onDragStart} />
        )}
        
        {activeTab === 'groups' && (
          <div className="flex flex-col gap-3">
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

      {/* Group Info Dialog */}
      <GroupInfoDialog
        group={infoGroup}
        components={components}
        open={infoDialogOpen}
        onOpenChange={setInfoDialogOpen}
      />

      {/* Rename Group Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Gruppe umbenennen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="group-name">Name</Label>
              <Input
                id="group-name"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Gruppenname eingeben"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    confirmRenameGroup();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={confirmRenameGroup} disabled={!newGroupName.trim()}>
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
