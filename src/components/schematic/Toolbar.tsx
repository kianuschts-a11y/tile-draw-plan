import { useState } from "react";
import { 
  MousePointer2, 
  Trash2,
  RotateCw,
  Link2,
  Unlink2,
  Move,
  FolderPlus,
  Save,
  X,
  Undo2,
  Redo2,
  ArrowRight,
  Tag,
  Minus,
  Type
} from "lucide-react";
import { ToolButton } from "./ToolButton";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { LineStyle } from "@/types/annotations";

export type MainToolType = 'select' | 'pan' | 'connect' | 'disconnect' | 'arrow' | 'annotate-line' | 'annotate-text';

// Predefined colors (shared between connections and annotations)
const TOOL_COLORS = [
  { value: '#000000', label: 'Schwarz' },
  { value: '#ef4444', label: 'Rot' },
  { value: '#3b82f6', label: 'Blau' },
  { value: '#22c55e', label: 'Grün' },
  { value: '#f97316', label: 'Orange' },
  { value: '#a855f7', label: 'Lila' },
  { value: '#eab308', label: 'Gelb' },
  { value: '#06b6d4', label: 'Cyan' },
];

const LINE_STYLES: { value: LineStyle; label: string; dasharray: string }[] = [
  { value: 'solid', label: 'Durchgezogen', dasharray: '' },
  { value: 'dashed', label: 'Gestrichelt', dasharray: '6 3' },
  { value: 'dotted', label: 'Gepunktet', dasharray: '2 3' },
  { value: 'dash-dot', label: 'Strich-Punkt', dasharray: '6 3 2 3' },
];

interface ToolbarProps {
  activeTool: MainToolType;
  onToolChange: (tool: MainToolType) => void;
  onDelete: () => void;
  hasSelection: boolean;
  connectionColor: string;
  onConnectionColorChange: (color: string) => void;
  // Group creation from canvas tiles
  isGroupMode: boolean;
  onToggleGroupMode: () => void;
  selectedTileCount: number;
  onSaveGroup: (name: string) => void;
  onCancelGroupMode: () => void;
  // Undo/Redo
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  // Rotation
  onRotate: () => void;
  canRotate: boolean;
  // Auto-labeling
  onAutoLabel: () => void;
  hasLabelableComponents: boolean;
  // Annotation props
  annotationLineStyle: LineStyle;
  onAnnotationLineStyleChange: (style: LineStyle) => void;
  annotationColor: string;
  onAnnotationColorChange: (color: string) => void;
  annotationFontSize: number;
  onAnnotationFontSizeChange: (size: number) => void;
}

export function Toolbar({
  activeTool,
  onToolChange,
  onDelete,
  hasSelection,
  connectionColor,
  onConnectionColorChange,
  isGroupMode,
  onToggleGroupMode,
  selectedTileCount,
  onSaveGroup,
  onCancelGroupMode,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onRotate,
  canRotate,
  onAutoLabel,
  hasLabelableComponents,
  annotationLineStyle,
  onAnnotationLineStyleChange,
  annotationColor,
  onAnnotationColorChange,
  annotationFontSize,
  onAnnotationFontSizeChange
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
    <div className="toolbar-panel flex flex-col items-center py-2 px-1 border-r gap-0.5 flex-shrink-0">
      {/* Undo/Redo */}
      <ToolButton
        icon={Undo2}
        label="Rückgängig"
        shortcut="Strg+Z"
        onClick={onUndo}
        disabled={!canUndo || isGroupMode}
      />
      <ToolButton
        icon={Redo2}
        label="Wiederholen"
        shortcut="Strg+Y"
        onClick={onRedo}
        disabled={!canRedo || isGroupMode}
      />
      
      <Separator className="my-1 w-8" />
      
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
      {/* Connection Color Picker - directly above Connect */}
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
            {TOOL_COLORS.map((color) => (
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
      <ToolButton
        icon={ArrowRight}
        label="Pfeil hinzufügen/wechseln"
        shortcut="A"
        isActive={activeTool === 'arrow'}
        onClick={() => onToolChange('arrow')}
        disabled={isGroupMode}
      />
      
      <Separator className="my-1 w-8" />
      
      <ToolButton
        icon={RotateCw}
        label="Komponente drehen (90°)"
        shortcut="R"
        onClick={onRotate}
        disabled={!canRotate || isGroupMode}
      />
      
      <ToolButton
        icon={Trash2}
        label="Löschen"
        shortcut="Entf"
        onClick={onDelete}
        disabled={!hasSelection || isGroupMode}
      />
      
      <Separator className="my-1 w-8" />
      
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
      
      {/* Auto-Label Button */}
      <ToolButton
        icon={Tag}
        label="Beschriftungen einfügen"
        onClick={onAutoLabel}
        disabled={!hasLabelableComponents || isGroupMode}
      />
      
      <Separator className="my-1 w-8" />
      
      {/* Annotation Tools */}
      
      {/* Annotation Color Picker */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-accent transition-colors border"
            title="Annotationsfarbe"
          >
            <div 
              className="w-5 h-5 rounded-sm border border-border"
              style={{ backgroundColor: annotationColor }}
            />
          </button>
        </PopoverTrigger>
        <PopoverContent side="right" className="w-auto p-2">
          <div className="grid grid-cols-4 gap-1">
            {TOOL_COLORS.map((color) => (
              <button
                key={color.value}
                className={`w-7 h-7 rounded border-2 transition-all hover:scale-110 ${
                  annotationColor === color.value ? 'border-primary ring-2 ring-primary/30' : 'border-border'
                }`}
                style={{ backgroundColor: color.value }}
                onClick={() => onAnnotationColorChange(color.value)}
                title={color.label}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">Annotationsfarbe</p>
        </PopoverContent>
      </Popover>
      
      {/* Line Style Picker */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-accent transition-colors border"
            title="Linienstil"
          >
            <svg width="20" height="20" viewBox="0 0 20 20">
              <line
                x1="2" y1="10" x2="18" y2="10"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray={LINE_STYLES.find(s => s.value === annotationLineStyle)?.dasharray || ''}
              />
            </svg>
          </button>
        </PopoverTrigger>
        <PopoverContent side="right" className="w-auto p-2">
          <div className="flex flex-col gap-1">
            {LINE_STYLES.map((style) => (
              <button
                key={style.value}
                className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-accent transition-colors ${
                  annotationLineStyle === style.value ? 'bg-accent font-medium' : ''
                }`}
                onClick={() => onAnnotationLineStyleChange(style.value)}
              >
                <svg width="40" height="12" viewBox="0 0 40 12">
                  <line
                    x1="2" y1="6" x2="38" y2="6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeDasharray={style.dasharray}
                  />
                </svg>
                <span>{style.label}</span>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      
      <ToolButton
        icon={Minus}
        label="Markierungslinie"
        shortcut="L"
        isActive={activeTool === 'annotate-line'}
        onClick={() => onToolChange('annotate-line')}
        disabled={isGroupMode}
      />
      
      {/* Font Size Control */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-accent transition-colors border text-[10px] font-bold"
            title={`Schriftgröße: ${annotationFontSize}px`}
          >
            {annotationFontSize}
          </button>
        </PopoverTrigger>
        <PopoverContent side="right" className="w-48 p-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Schriftgröße</span>
              <span className="text-xs font-medium">{annotationFontSize}px</span>
            </div>
            <Slider
              value={[annotationFontSize]}
              onValueChange={(v) => onAnnotationFontSizeChange(v[0])}
              min={8}
              max={48}
              step={1}
            />
          </div>
        </PopoverContent>
      </Popover>
      
      <ToolButton
        icon={Type}
        label="Textfeld"
        shortcut="T"
        isActive={activeTool === 'annotate-text'}
        onClick={() => onToolChange('annotate-text')}
        disabled={isGroupMode}
      />
      
    </div>
  );
}
