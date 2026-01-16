import { 
  MousePointer2, 
  Hand, 
  Square, 
  Circle, 
  Minus, 
  Triangle, 
  Diamond,
  Trash2,
  RotateCcw,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import { ToolType } from "@/types/schematic";
import { ToolButton } from "./ToolButton";
import { Separator } from "@/components/ui/separator";

interface ToolbarProps {
  activeTool: ToolType;
  onToolChange: (tool: ToolType) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onDelete: () => void;
  hasSelection: boolean;
}

export function Toolbar({
  activeTool,
  onToolChange,
  onZoomIn,
  onZoomOut,
  onResetView,
  onDelete,
  hasSelection
}: ToolbarProps) {
  return (
    <div className="toolbar-panel flex flex-col items-center py-3 px-1.5 border-r gap-1">
      <ToolButton
        icon={MousePointer2}
        label="Auswählen"
        shortcut="V"
        isActive={activeTool === 'select'}
        onClick={() => onToolChange('select')}
      />
      <ToolButton
        icon={Hand}
        label="Verschieben"
        shortcut="H"
        isActive={activeTool === 'pan'}
        onClick={() => onToolChange('pan')}
      />
      
      <Separator className="my-2 w-8" />
      
      <ToolButton
        icon={Square}
        label="Rechteck"
        shortcut="R"
        isActive={activeTool === 'rectangle'}
        onClick={() => onToolChange('rectangle')}
      />
      <ToolButton
        icon={Circle}
        label="Kreis"
        shortcut="C"
        isActive={activeTool === 'circle'}
        onClick={() => onToolChange('circle')}
      />
      <ToolButton
        icon={Minus}
        label="Linie"
        shortcut="L"
        isActive={activeTool === 'line'}
        onClick={() => onToolChange('line')}
      />
      <ToolButton
        icon={Triangle}
        label="Dreieck"
        shortcut="T"
        isActive={activeTool === 'triangle'}
        onClick={() => onToolChange('triangle')}
      />
      <ToolButton
        icon={Diamond}
        label="Raute"
        shortcut="D"
        isActive={activeTool === 'diamond'}
        onClick={() => onToolChange('diamond')}
      />
      
      <Separator className="my-2 w-8" />
      
      <ToolButton
        icon={ZoomIn}
        label="Vergrößern"
        shortcut="+"
        onClick={onZoomIn}
      />
      <ToolButton
        icon={ZoomOut}
        label="Verkleinern"
        shortcut="-"
        onClick={onZoomOut}
      />
      <ToolButton
        icon={RotateCcw}
        label="Ansicht zurücksetzen"
        shortcut="0"
        onClick={onResetView}
      />
      
      <div className="flex-1" />
      
      {hasSelection && (
        <ToolButton
          icon={Trash2}
          label="Löschen"
          shortcut="Del"
          onClick={onDelete}
        />
      )}
    </div>
  );
}
