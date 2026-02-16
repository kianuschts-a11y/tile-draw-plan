export type LineStyle = 'solid' | 'dashed' | 'dotted' | 'dash-dot';

export interface AnnotationLine {
  id: string;
  // Grid-cell based path (like connection lines)
  path: { gridX: number; gridY: number }[];
  color: string;
  strokeWidth: number;
  lineStyle: LineStyle;
}

export interface AnnotationText {
  id: string;
  x: number; // Pixel position (canvas coordinates)
  y: number;
  text: string;
  fontSize: number;
  color: string;
  fontWeight?: 'normal' | 'bold';
}
