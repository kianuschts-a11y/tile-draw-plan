export type ShapeType = 'rectangle' | 'circle' | 'line' | 'triangle' | 'diamond' | 'ellipse' | 'polyline' | 'arc' | 'text';

export type ToolType = 'select' | 'pan' | ShapeType;

export type PaperFormat = 'A5' | 'A4' | 'A3' | 'A2' | 'A1' | 'Letter' | 'Legal';

export type Orientation = 'portrait' | 'landscape';

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
  strokeWidth?: number;
  // For polyline
  points?: Point[];
  // For arc
  startAngle?: number;
  endAngle?: number;
  // For text
  text?: string;
  fontSize?: number;
}

export interface Component {
  id: string;
  name: string;
  shapes: Shape[];
  width: number;
  height: number;
  thumbnail?: string;
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
