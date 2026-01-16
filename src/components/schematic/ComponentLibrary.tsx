import { Component, Shape } from "@/types/schematic";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { ShapeRenderer } from "./ShapeRenderer";

interface ComponentLibraryProps {
  components: Component[];
  onCreateNew: () => void;
  onDeleteComponent: (id: string) => void;
  onDragStart: (e: React.DragEvent, component: Component) => void;
}

export function ComponentLibrary({ 
  components, 
  onCreateNew, 
  onDeleteComponent,
  onDragStart 
}: ComponentLibraryProps) {
  const renderComponentPreview = (component: Component) => {
    const scale = Math.min(40 / component.width, 40 / component.height, 1);
    const offsetX = (40 - component.width * scale) / 2;
    const offsetY = (40 - component.height * scale) / 2;

    return (
      <svg width="40" height="40" className="component-tile">
        <g transform={`translate(${offsetX}, ${offsetY}) scale(${scale})`}>
          {component.shapes.map((shape, idx) => (
            <ShapeRenderer key={idx} shape={shape} />
          ))}
        </g>
      </svg>
    );
  };

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
          Ziehen Sie Komponenten auf das Blatt
        </p>
      </div>
      
      <ScrollArea className="flex-1 p-3">
        <div className="grid grid-cols-2 gap-2">
          {components.map(component => (
            <div
              key={component.id}
              className="library-item flex flex-col items-center gap-2 relative group"
              draggable
              onDragStart={(e) => onDragStart(e, component)}
            >
              {renderComponentPreview(component)}
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
