import { useState } from "react";
import { Component, Shape } from "@/types/schematic";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Settings2 } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

interface ComponentLibraryProps {
  components: Component[];
  onCreateNew: () => void;
  onDeleteComponent: (id: string) => void;
  onDragStart: (e: React.DragEvent, component: Component) => void;
  onEditVariations: (component: Component) => void;
  onUpdateComponent: (component: Component) => void;
}

function renderShape(shape: Shape, scale: number = 50) {
  const x = shape.x * scale;
  const y = shape.y * scale;
  const width = shape.width * scale;
  const height = shape.height * scale;

  const style = {
    fill: 'none',
    stroke: 'hsl(220, 25%, 20%)',
    strokeWidth: 1.5
  };

  switch (shape.type) {
    case 'rectangle':
      return <rect x={x} y={y} width={width} height={height} {...style} />;
    case 'circle':
    case 'ellipse':
      return <ellipse cx={x + width / 2} cy={y + height / 2} rx={width / 2} ry={height / 2} {...style} />;
    case 'line':
      return <line x1={x} y1={y} x2={x + width} y2={y + height} {...style} />;
    case 'triangle':
      return <polygon points={`${x + width / 2},${y} ${x},${y + height} ${x + width},${y + height}`} {...style} />;
    case 'diamond':
      return <polygon points={`${x + width / 2},${y} ${x + width},${y + height / 2} ${x + width / 2},${y + height} ${x},${y + height / 2}`} {...style} />;
    default:
      return null;
  }
}

export function ComponentLibrary({ 
  components, 
  onCreateNew, 
  onDeleteComponent,
  onDragStart,
  onEditVariations,
  onUpdateComponent
}: ComponentLibraryProps) {
  const previewSize = 50;

  return (
    <div className="toolbar-panel border-l w-64 flex flex-col">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-sm">Komponenten</h2>
          <Button size="sm" variant="outline" className="h-7 gap-1" onClick={onCreateNew}>
            <Plus className="w-3 h-3" />
            Neu
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Rechtsklick für Varianten
        </p>
      </div>
      
      <ScrollArea className="flex-1 p-3">
        <div className="grid grid-cols-2 gap-2">
          {components.map(component => (
            <ContextMenu key={component.id}>
              <ContextMenuTrigger>
                <div
                  className="library-item flex flex-col items-center gap-2 relative group"
                  draggable
                  onDragStart={(e) => onDragStart(e, component)}
                >
                  <div className="w-[50px] h-[50px] flex items-center justify-center border border-dashed border-muted-foreground/30 rounded bg-white relative">
                    <svg width={previewSize} height={previewSize}>
                      {component.shapes.map((shape, idx) => (
                        <g key={idx}>{renderShape(shape, previewSize)}</g>
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
                        onDeleteComponent(component.id);
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem onClick={() => onEditVariations(component)}>
                  <Settings2 className="w-4 h-4 mr-2" />
                  Varianten bearbeiten
                </ContextMenuItem>
                {!component.id.startsWith('default-') && (
                  <ContextMenuItem 
                    onClick={() => onDeleteComponent(component.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Löschen
                  </ContextMenuItem>
                )}
              </ContextMenuContent>
            </ContextMenu>
          ))}
        </div>

        {components.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">Keine Komponenten</p>
            <p className="text-xs mt-1">Erstellen Sie eine neue Komponente</p>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
