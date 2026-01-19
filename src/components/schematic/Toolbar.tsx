import { useState } from "react";
import { 
  MousePointer2, 
  Trash2,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Link2,
  Unlink2,
  Move,
  FolderPlus,
  Save,
  X,
  Download
} from "lucide-react";
import { ToolButton } from "./ToolButton";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type MainToolType = 'select' | 'pan' | 'connect' | 'disconnect';

// Predefined connection colors
const CONNECTION_COLORS = [
  { value: '#000000', label: 'Schwarz' },
  { value: '#ef4444', label: 'Rot' },
  { value: '#3b82f6', label: 'Blau' },
  { value: '#22c55e', label: 'Grün' },
  { value: '#f97316', label: 'Orange' },
  { value: '#a855f7', label: 'Lila' },
  { value: '#eab308', label: 'Gelb' },
  { value: '#06b6d4', label: 'Cyan' },
];

interface ToolbarProps {
  activeTool: MainToolType;
  onToolChange: (tool: MainToolType) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onDelete: () => void;
  onExport: () => void;
  hasSelection: boolean;
  connectionColor: string;
  onConnectionColorChange: (color: string) => void;
  // Group creation from canvas tiles
  isGroupMode: boolean;
  onToggleGroupMode: () => void;
  selectedTileCount: number;
  onSaveGroup: (name: string) => void;
  onCancelGroupMode: () => void;
}

export function Toolbar({
  activeTool,
  onToolChange,
  onZoomIn,
  onZoomOut,
  onResetView,
  onDelete,
  onExport,
  hasSelection,
  connectionColor,
  onConnectionColorChange,
  isGroupMode,
  onToggleGroupMode,
  selectedTileCount,
  onSaveGroup,
  onCancelGroupMode
}: ToolbarProps) {
  const [groupName, setGroupName] = useState("");

  const handleSaveGroup = () => {
    if (groupName.trim() && selectedTileCount >= 2) {
      onSaveGroup(groupName.trim());
      setGroupName("");
    }
  };

  const handleCancelGroupMode = () => {
    setGroupName("");
    onCancelGroupMode();
  };

  return (
    <div className="toolbar-panel flex flex-col items-center py-3 px-1.5 border-r gap-1">
      <ToolButton
        icon={MousePointer2}
        label="Auswählen"
        shortcut="V"
        isActive={activeTool === 'select' && !isGroupMode}
        onClick={() => onToolChange('select')}
        disabled={isGroupMode}
      />
      <ToolButton
        icon={Move}
        label="Bewegen"
        shortcut="H"
        isActive={activeTool === 'pan'}
        onClick={() => onToolChange('pan')}
        disabled={isGroupMode}
      />
      <ToolButton
        icon={Link2}
        label="Verbinden"
        shortcut="C"
        isActive={activeTool === 'connect'}
        onClick={() => onToolChange('connect')}
        disabled={isGroupMode}
      />
      <ToolButton
        icon={Unlink2}
        label="Verbindung lösen"
        shortcut="X"
        isActive={activeTool === 'disconnect'}
        onClick={() => onToolChange('disconnect')}
        disabled={isGroupMode}
      />
      
      <Separator className="my-2 w-8" />
      
      {/* Create Group Button with expanded UI when active */}
      <div className="relative">
        <ToolButton
          icon={FolderPlus}
          label={`Gruppe erstellen (${selectedTileCount} Tiles)`}
          shortcut="G"
          isActive={isGroupMode}
          onClick={onToggleGroupMode}
        />
        
        {/* Expanded group creation panel */}
        {isGroupMode && (
          <div className="absolute left-full ml-2 top-0 bg-background border rounded-lg shadow-lg p-2 min-w-[220px] z-50">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-medium text-sm">Gruppe erstellen</span>
              <span className="text-sm font-medium text-primary ml-auto">
                {selectedTileCount}
              </span>
              <button 
                onClick={handleCancelGroupMode}
                className="p-1 hover:bg-muted rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex gap-2">
              <Input
                placeholder="Gruppenname"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="flex-1 h-8 text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveGroup();
                  }
                }}
              />
              <Button 
                size="sm" 
                className="h-8 gap-1"
                onClick={handleSaveGroup}
                disabled={!groupName.trim() || selectedTileCount < 2}
              >
                <Save className="w-3 h-3" />
              </Button>
            </div>
          </div>
        )}
      </div>
      
      <Separator className="my-2 w-8" />
      
      {/* Connection Color Picker */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-accent transition-colors border"
            title="Verbindungsfarbe"
          >
            <div 
              className="w-5 h-5 rounded border border-border"
              style={{ backgroundColor: connectionColor }}
            />
          </button>
        </PopoverTrigger>
        <PopoverContent side="right" className="w-auto p-2">
          <div className="grid grid-cols-4 gap-1">
            {CONNECTION_COLORS.map((color) => (
              <button
                key={color.value}
                className={`w-7 h-7 rounded border-2 transition-all hover:scale-110 ${
                  connectionColor === color.value ? 'border-primary ring-2 ring-primary/30' : 'border-border'
                }`}
                style={{ backgroundColor: color.value }}
                onClick={() => onConnectionColorChange(color.value)}
                title={color.label}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">Verbindungsfarbe</p>
        </PopoverContent>
      </Popover>
      
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
      
      <Separator className="my-2 w-8" />
      
      <ToolButton
        icon={Download}
        label="Zeichnung exportieren"
        shortcut="E"
        onClick={onExport}
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
