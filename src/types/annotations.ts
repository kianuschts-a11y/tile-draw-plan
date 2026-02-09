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
  gridX: number; // Grid cell position
  gridY: number;
  text: string;
  fontSize: number;
  color: string;
  fontWeight?: 'normal' | 'bold';
}
