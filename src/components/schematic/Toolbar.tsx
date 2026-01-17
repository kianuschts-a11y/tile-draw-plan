import { 
  MousePointer2, 
  Trash2,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Link2,
  Unlink2,
  Move
} from "lucide-react";
import { ToolButton } from "./ToolButton";
import { Separator } from "@/components/ui/separator";

export type MainToolType = 'select' | 'pan' | 'connect' | 'disconnect';

interface ToolbarProps {
  activeTool: MainToolType;
  onToolChange: (tool: MainToolType) => void;
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
        icon={Move}
        label="Bewegen"
        shortcut="H"
        isActive={activeTool === 'pan'}
        onClick={() => onToolChange('pan')}
      />
      <ToolButton
        icon={Link2}
        label="Verbinden"
        shortcut="C"
        isActive={activeTool === 'connect'}
        onClick={() => onToolChange('connect')}
      />
      <ToolButton
        icon={Unlink2}
        label="Verbindung lösen"
        shortcut="X"
        isActive={activeTool === 'disconnect'}
        onClick={() => onToolChange('disconnect')}
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
