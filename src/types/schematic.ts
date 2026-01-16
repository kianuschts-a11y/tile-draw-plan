export type ShapeType = 'rectangle' | 'circle' | 'line' | 'triangle' | 'diamond' | 'ellipse';

export type ToolType = 'select' | 'pan' | ShapeType;

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
}
