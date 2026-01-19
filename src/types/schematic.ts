export type ShapeType = 'rectangle' | 'circle' | 'line' | 'arrow' | 'triangle' | 'diamond' | 'ellipse' | 'polyline' | 'arc' | 'text' | 'polygon';

export type ToolType = 'select' | 'pan' | ShapeType;

export type PaperFormat = 'A5' | 'A4' | 'A3' | 'A2' | 'A1' | 'Letter' | 'Legal';

export type Orientation = 'portrait' | 'landscape';

// Title block (Zeichenkopf) data
export interface TitleBlockData {
  enabled: boolean;
  projekt: string;
  zeichnungsNr: string;
  blattNr: string;
  blattzahl: string;
  aenderungen: string;
  gezeichnet: { name: string; datum: string };
  geprueft: { name: string; datum: string };
}

// Tile size configurations
export type TileSize = '1x1' | '2x2' | '3x2' | '5x1'; // 2x2 = 2 high, 2 wide; 3x2 = 3 high, 2 wide; 5x1 = 5 wide, 1 high

export interface TileSizeConfig {
  cols: number;
  rows: number;
  label: string;
  connectionsPerSide: number; // Number of connection points per side
}

export const TILE_SIZES: Record<TileSize, TileSizeConfig> = {
  '1x1': { cols: 1, rows: 1, label: '1×1 Kachel', connectionsPerSide: 1 },
  '2x2': { cols: 2, rows: 2, label: '2×2 Kachel (2 Anschlüsse pro Seite)', connectionsPerSide: 2 },
  '3x2': { cols: 2, rows: 3, label: '3×2 Kachel (3 hoch, 2 breit)', connectionsPerSide: 2 },
  '5x1': { cols: 5, rows: 1, label: '5×1 Kachel (5 breit, 1 hoch)', connectionsPerSide: 5 }
};

// Connection directions for component variations
export type ConnectionDirection = 'left' | 'right' | 'top' | 'bottom' | 'horizontal' | 'vertical' | 'corner-tl' | 'corner-tr' | 'corner-bl' | 'corner-br';

export interface PaperSize {
  width: number;
  height: number;
  label: string;
}

export const PAPER_SIZES: Record<PaperFormat, PaperSize> = {
  'A5': { width: 148, height: 210, label: 'A5 (148 × 210 mm)' },
  'A4': { width: 210, height: 297, label: 'A4 (210 × 297 mm)' },
  'A3': { width: 297, height: 420, label: 'A3 (297 × 420 mm)' },
  'A2': { width: 420, height: 594, label: 'A2 (420 × 594 mm)' },
  'A1': { width: 594, height: 841, label: 'A1 (594 × 841 mm)' },
  'Letter': { width: 216, height: 279, label: 'Letter (216 × 279 mm)' },
  'Legal': { width: 216, height: 356, label: 'Legal (216 × 356 mm)' },
};

export const MM_TO_PX = 96 / 25.4;

export interface Point {
  x: number;
  y: number;
}

export interface Shape {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  stroke?: string;
  fill?: string;
  fillColor?: string; // Fill color for shapes
  strokeWidth?: number;
  // For polyline
  points?: Point[];
  // For arc
  startAngle?: number;
  endAngle?: number;
  // For text
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  // For arrows
  arrowSize?: number;
  // For curved lines (quadratic bezier)
  curveOffset?: Point; // Control point offset from line midpoint
}

// Dynamic connection between two cells
export interface CellConnection {
  id: string;
  // Source tile and cell position within the tile
  fromTileId: string;
  fromCellX: number; // Cell X relative to tile (0 to width-1)
  fromCellY: number; // Cell Y relative to tile (0 to height-1)
  fromSide: 'left' | 'right' | 'top' | 'bottom';
  // Target tile and cell position within the tile
  toTileId: string;
  toCellX: number;
  toCellY: number;
  toSide: 'left' | 'right' | 'top' | 'bottom';
  // Connection line color (default: black)
  color?: string;
}

// Legacy - keeping for compatibility but will be phased out
export interface ComponentVariation {
  id: string;
  name: string;
  connectionType: ConnectionDirection;
  shapes: Shape[]; // Additional shapes (usually a line) for this variation
}

export interface Component {
  id: string;
  name: string;
  shapes: Shape[];
  width: number;  // Grid cells wide
  height: number; // Grid cells tall
  tileSize?: TileSize; // '1x1' or '3x2'
  thumbnail?: string;
  variations?: ComponentVariation[]; // Legacy - kept for compatibility
  activeVariationId?: string; // Legacy
}

// Tile layout data for groups - stores relative positions
export interface GroupTileData {
  componentId: string;
  relativeX: number; // Grid position relative to first tile (0-based)
  relativeY: number;
}

// Connection data for groups - references tiles by index
export interface GroupConnectionData {
  fromTileIndex: number;
  fromCellX: number;
  fromCellY: number;
  fromSide: 'left' | 'right' | 'top' | 'bottom';
  toTileIndex: number;
  toCellX: number;
  toCellY: number;
  toSide: 'left' | 'right' | 'top' | 'bottom';
  color?: string;
}

// Layout data stored in groups
export interface GroupLayoutData {
  tiles: GroupTileData[];
  connections: GroupConnectionData[];
}

// Component Group - groups multiple components together with layout
export interface ComponentGroup {
  id: string;
  name: string;
  componentIds: string[]; // IDs of components in this group
  layoutData?: GroupLayoutData; // Positions and connections for template placement
}

// Component quantity in a project
export interface ComponentQuantity {
  componentId: string;
  quantity: number;
}

// Project - a list of components with quantities
export interface Project {
  id: string;
  name: string;
  componentQuantities: ComponentQuantity[];
  createdAt?: string;
  updatedAt?: string;
}

// Group match result for project comparison
export interface GroupMatch {
  group: ComponentGroup;
  matchPercentage: number; // 0-100
  matchingComponents: string[]; // Component IDs that match
  missingComponents: string[]; // Component IDs in project but not in group
  extraComponents: string[]; // Component IDs in group but not in project
}

// Saved plan - a finished drawing saved as template
export interface SavedPlan {
  id: string;
  name: string;
  componentQuantities: ComponentQuantity[];
  drawingData: {
    tiles: PlacedComponent[];
    connections: CellConnection[];
  };
  matchedGroupId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PlacedComponent {
  id: string;
  componentId: string;
  x: number;
  y: number;
  rotation?: number;
  scale?: number;
}

export interface CanvasState {
  zoom: number;
  panX: number;
  panY: number;
  gridSize: number;
  paperFormat: PaperFormat;
  orientation: Orientation;
}
