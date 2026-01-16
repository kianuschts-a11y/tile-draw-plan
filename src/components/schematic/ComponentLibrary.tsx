import { Component } from "@/types/schematic";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Square, Circle, Triangle, Diamond, Minus, Box, Zap, Settings } from "lucide-react";

interface ComponentLibraryProps {
  onDragStart: (component: Component) => void;
}

const defaultComponents: Component[] = [
  {
    id: 'basic-rect',
    name: 'Rechteck',
    width: 60,
    height: 40,
    shapes: [{ id: '1', type: 'rectangle', x: 0, y: 0, width: 60, height: 40 }]
  },
  {
    id: 'basic-circle',
    name: 'Kreis',
    width: 40,
    height: 40,
    shapes: [{ id: '1', type: 'circle', x: 0, y: 0, width: 40, height: 40 }]
  },
  {
    id: 'basic-triangle',
    name: 'Dreieck',
    width: 40,
    height: 40,
    shapes: [{ id: '1', type: 'triangle', x: 0, y: 0, width: 40, height: 40 }]
  },
  {
    id: 'basic-diamond',
    name: 'Raute',
    width: 40,
    height: 40,
    shapes: [{ id: '1', type: 'diamond', x: 0, y: 0, width: 40, height: 40 }]
  },
  {
    id: 'valve',
    name: 'Ventil',
    width: 40,
    height: 40,
    shapes: [
      { id: '1', type: 'triangle', x: 0, y: 0, width: 20, height: 40 },
      { id: '2', type: 'triangle', x: 20, y: 0, width: 20, height: 40 }
    ]
  },
  {
    id: 'pump',
    name: 'Pumpe',
    width: 60,
    height: 60,
    shapes: [
      { id: '1', type: 'circle', x: 10, y: 10, width: 40, height: 40 },
      { id: '2', type: 'triangle', x: 25, y: 0, width: 10, height: 15 }
    ]
  },
  {
    id: 'tank',
    name: 'Tank',
    width: 60,
    height: 80,
    shapes: [
      { id: '1', type: 'rectangle', x: 0, y: 10, width: 60, height: 60 },
      { id: '2', type: 'ellipse', x: 0, y: 0, width: 60, height: 20 },
      { id: '3', type: 'ellipse', x: 0, y: 60, width: 60, height: 20 }
    ]
  },
  {
    id: 'motor',
    name: 'Motor',
    width: 60,
    height: 40,
    shapes: [
      { id: '1', type: 'circle', x: 10, y: 0, width: 40, height: 40 },
      { id: '2', type: 'rectangle', x: 0, y: 15, width: 15, height: 10 },
      { id: '3', type: 'rectangle', x: 45, y: 15, width: 15, height: 10 }
    ]
  }
];

const iconMap: Record<string, React.ReactNode> = {
  'basic-rect': <Square className="w-6 h-6" />,
  'basic-circle': <Circle className="w-6 h-6" />,
  'basic-triangle': <Triangle className="w-6 h-6" />,
  'basic-diamond': <Diamond className="w-6 h-6" />,
  'valve': <Box className="w-6 h-6" />,
  'pump': <Settings className="w-6 h-6" />,
  'tank': <Box className="w-6 h-6" />,
  'motor': <Zap className="w-6 h-6" />
};

export function ComponentLibrary({ onDragStart }: ComponentLibraryProps) {
  return (
    <div className="toolbar-panel border-l w-64 flex flex-col">
      <div className="p-4 border-b">
        <h2 className="font-semibold text-sm">Komponenten-Bibliothek</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Ziehen Sie Komponenten auf die Zeichenfläche
        </p>
      </div>
      
      <ScrollArea className="flex-1 p-3">
        <div className="space-y-3">
          <div>
            <h3 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
              Grundformen
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {defaultComponents.slice(0, 4).map(component => (
                <div
                  key={component.id}
                  className="library-item flex flex-col items-center gap-2"
                  draggable
                  onDragStart={() => onDragStart(component)}
                >
                  {iconMap[component.id]}
                  <span className="text-xs text-muted-foreground">{component.name}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div>
            <h3 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
              Anlagen-Symbole
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {defaultComponents.slice(4).map(component => (
                <div
                  key={component.id}
                  className="library-item flex flex-col items-center gap-2"
                  draggable
                  onDragStart={() => onDragStart(component)}
                >
                  <svg width="40" height="40" viewBox="0 0 60 60" className="component-tile">
                    {component.shapes.map((shape, idx) => {
                      switch (shape.type) {
                        case 'rectangle':
                          return <rect key={idx} x={shape.x} y={shape.y} width={shape.width} height={shape.height} />;
                        case 'circle':
                        case 'ellipse':
                          return <ellipse key={idx} cx={shape.x + shape.width/2} cy={shape.y + shape.height/2} rx={shape.width/2} ry={shape.height/2} />;
                        case 'triangle':
                          return <polygon key={idx} points={`${shape.x + shape.width/2},${shape.y} ${shape.x},${shape.y + shape.height} ${shape.x + shape.width},${shape.y + shape.height}`} />;
                        default:
                          return null;
                      }
                    })}
                  </svg>
                  <span className="text-xs text-muted-foreground">{component.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
