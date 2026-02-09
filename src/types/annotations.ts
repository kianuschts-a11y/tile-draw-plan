export type LineStyle = 'solid' | 'dashed' | 'dotted' | 'dash-dot';

export interface AnnotationLine {
  id: string;
  fromX: number; // Grid coordinates (float)
  fromY: number;
  toX: number;
  toY: number;
  color: string;
  strokeWidth: number;
  lineStyle: LineStyle;
}

export interface AnnotationText {
  id: string;
  x: number; // Grid coordinates (float)
  y: number;
  text: string;
  fontSize: number;
  color: string;
  fontWeight?: 'normal' | 'bold';
}
