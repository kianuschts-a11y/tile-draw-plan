import { CanvasState } from "@/types/schematic";

interface StatusBarProps {
  canvasState: CanvasState;
  shapeCount: number;
  selectedShape: string | null;
}

export function StatusBar({ canvasState, shapeCount, selectedShape }: StatusBarProps) {
  return (
    <div className="toolbar-panel h-8 border-t flex items-center px-4 gap-6 text-xs text-muted-foreground font-mono">
      <div className="flex items-center gap-2">
        <span className="text-foreground/70">Zoom:</span>
        <span>{Math.round(canvasState.zoom * 100)}%</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-foreground/70">Raster:</span>
        <span>{canvasState.gridSize}px</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-foreground/70">Objekte:</span>
        <span>{shapeCount}</span>
      </div>
      {selectedShape && (
        <div className="flex items-center gap-2">
          <span className="text-foreground/70">Ausgewählt:</span>
          <span className="text-primary">1</span>
        </div>
      )}
      <div className="flex-1" />
      <div className="text-muted-foreground/70">
        Anlagen-Schema Editor
      </div>
    </div>
  );
}
