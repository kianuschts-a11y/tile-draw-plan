import { useState } from "react";
import { Component, Shape } from "@/types/schematic";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Settings2, Pencil } from "lucide-react";
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

interface ComponentLibraryProps {
  components: Component[];
  onCreateNew: () => void;
  onDeleteComponent: (id: string) => void;
  onClearAll: () => void;
  onDragStart: (e: React.DragEvent, component: Component) => void;
  onEditVariations: (component: Component) => void;
  onEditComponent: (component: Component) => void;
  onUpdateComponent: (component: Component) => void;
}

function renderShape(shape: Shape, scaleX: number = 50, scaleY: number = 50) {
  const x = shape.x * scaleX;
  const y = shape.y * scaleY;
  const width = shape.width * scaleX;
  const height = shape.height * scaleY;
  // Skaliere strokeWidth proportional zur Referenzgröße
  const refScale = Math.min(scaleX, scaleY);
  const sw = shape.strokeWidth ? shape.strokeWidth * refScale : 1.5;

  const style = {
    fill: shape.fillColor || 'none',
    stroke: 'hsl(220, 25%, 20%)',
    strokeWidth: Math.max(0.5, sw)  // Mindestens 0.5 für Sichtbarkeit
  };

  switch (shape.type) {
    case 'rectangle':
      return <rect x={x} y={y} width={width} height={height} {...style} />;
    case 'circle':
    case 'ellipse':
      return <ellipse cx={x + width / 2} cy={y + height / 2} rx={width / 2} ry={height / 2} {...style} />;
    case 'line':
      return <line x1={x} y1={y} x2={x + width} y2={y + height} {...style} strokeLinecap="round" />;
    case 'arrow': {
      const x2 = x + width;
      const y2 = y + height;
      const arrowSize = shape.arrowSize ? shape.arrowSize * refScale : Math.max(3, sw * 2);
      const angle = Math.atan2(height, width);
      const arrowAngle = Math.PI / 6;
      const ax1 = x2 - arrowSize * Math.cos(angle - arrowAngle);
      const ay1 = y2 - arrowSize * Math.sin(angle - arrowAngle);
      const ax2 = x2 - arrowSize * Math.cos(angle + arrowAngle);
      const ay2 = y2 - arrowSize * Math.sin(angle + arrowAngle);
      return (
        <g>
          <line x1={x} y1={y} x2={x2} y2={y2} {...style} strokeLinecap="round" />
          <polyline points={`${ax1},${ay1} ${x2},${y2} ${ax2},${ay2}`} fill="none" stroke={style.stroke} strokeWidth={style.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        </g>
      );
    }
    case 'triangle':
      return <polygon points={`${x + width / 2},${y} ${x},${y + height} ${x + width},${y + height}`} {...style} />;
    case 'diamond':
      return <polygon points={`${x + width / 2},${y} ${x + width},${y + height / 2} ${x + width / 2},${y + height} ${x},${y + height / 2}`} {...style} />;
    case 'polyline':
      if (!shape.points || shape.points.length < 2) return null;
      return <polyline points={shape.points.map(p => `${p.x * scaleX},${p.y * scaleY}`).join(' ')} fill="none" stroke={style.stroke} strokeWidth={style.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />;
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
      return <path d={`M ${arcX1} ${arcY1} A ${rx} ${ry} 0 ${largeArc} 1 ${arcX2} ${arcY2}`} fill="none" stroke={style.stroke} strokeWidth={style.strokeWidth} />;
    }
    case 'text':
      const fontSize = shape.fontSize ? shape.fontSize * refScale : 4;
      return <text x={x} y={y + fontSize} fontSize={Math.max(4, fontSize)} fontFamily={shape.fontFamily || 'sans-serif'} fill={style.stroke}>{shape.text}</text>;
    default:
      return null;
  }
}

export function ComponentLibrary({ 
  components, 
  onCreateNew, 
  onDeleteComponent,
  onClearAll,
  onDragStart,
  onEditVariations,
  onEditComponent,
  onUpdateComponent
}: ComponentLibraryProps) {
  const previewSize = 50;
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [componentToDelete, setComponentToDelete] = useState<Component | null>(null);
  const [clearAllConfirmOpen, setClearAllConfirmOpen] = useState(false);

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

  return (
    <div className="toolbar-panel border-l w-64 flex flex-col">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-sm">Komponenten</h2>
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
        </div>
        <p className="text-xs text-muted-foreground">
          Rechtsklick für Varianten
        </p>
      </div>
      
      <ScrollArea className="flex-1 p-3">
        <div className="grid grid-cols-2 gap-2">
          {components.map(component => {
            // Berechne Aspect Ratio basierend auf Komponenten-Dimensionen
            const compWidth = component.width || 1;
            const compHeight = component.height || 1;
            const aspectRatio = compWidth / compHeight;
            
            // Passe Vorschau-Größe an Aspect Ratio an
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
                    className="library-item flex flex-col items-center gap-2 relative group"
                    draggable
                    onDragStart={(e) => onDragStart(e, component)}
                  >
                    <div className="w-[50px] h-[50px] flex items-center justify-center border border-dashed border-muted-foreground/30 rounded bg-white relative">
                      <svg width={previewWidth} height={previewHeight}>
                        {component.shapes.map((shape, idx) => (
                          <g key={idx}>{renderShape(shape, previewWidth, previewHeight)}</g>
                        ))}
                      </svg>
                      {/* Variation indicator */}
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
                    Bild bearbeiten
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => onEditVariations(component)}>
                    <Settings2 className="w-4 h-4 mr-2" />
                    Varianten bearbeiten
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
          })}
        </div>

        {components.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">Keine Komponenten</p>
            <p className="text-xs mt-1">Erstellen Sie eine neue Komponente</p>
          </div>
        )}
      </ScrollArea>

      {/* Delete Confirmation Dialog */}
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
