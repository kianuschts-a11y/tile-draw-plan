import { TitleBlockData } from "@/types/schematic";

interface TitleBlockProps {
  data: TitleBlockData;
  paperWidth: number;
  paperHeight: number;
  tileSize: number;
  onDataChange: (data: TitleBlockData) => void;
}

// The SVG is designed for A4 landscape (2970 x 2100 units = 297mm x 210mm)
// Original drawing area ends at y=1930, frame at y=30
const ORIGINAL_WIDTH = 2970;
const ORIGINAL_HEIGHT = 2100;

// Frame bounds from original SVG
const OUTER_MARGIN = 30;
const INNER_MARGIN = 60;
const FRAME_BOTTOM = 1930; // y position where main frame ends

export function TitleBlock({ data, paperWidth, paperHeight, tileSize, onDataChange }: TitleBlockProps) {
  // Calculate scale to fit current paper
  const scaleX = paperWidth / ORIGINAL_WIDTH;
  const scaleY = paperHeight / ORIGINAL_HEIGHT;
  
  // Scaled helper functions
  const sx = (x: number) => x * scaleX;
  const sy = (y: number) => y * scaleY;
  
  const fontSize = Math.max(8, 18 * Math.min(scaleX, scaleY));
  const fontSizeLarge = Math.max(10, 20 * Math.min(scaleX, scaleY));
  const fontSizeZone = Math.max(12, 30 * Math.min(scaleX, scaleY));
  const fontSizeNumber = Math.max(10, 21 * Math.min(scaleX, scaleY));
  const strokeWidth = (w: number) => Math.max(0.5, w * Math.min(scaleX, scaleY));

  return (
    <g className="title-block">
      {/* === OUTER FRAME === */}
      {/* Diagonal corner line */}
      <polyline
        points={`${sx(60)} ${sy(60)}, ${sx(30)} ${sy(30)}`}
        fill="none"
        stroke="black"
        strokeWidth={strokeWidth(3)}
      />
      {/* Top outer line */}
      <polyline
        points={`${sx(30)} ${sy(30)}, ${sx(2870)} ${sy(30)}`}
        fill="none"
        stroke="black"
        strokeWidth={strokeWidth(3)}
      />
      {/* Left outer line */}
      <polyline
        points={`${sx(30)} ${sy(30)}, ${sx(30)} ${sy(1930)}`}
        fill="none"
        stroke="black"
        strokeWidth={strokeWidth(3)}
      />
      {/* Right outer line */}
      <polyline
        points={`${sx(2870)} ${sy(30)}, ${sx(2870)} ${sy(1930)}`}
        fill="none"
        stroke="black"
        strokeWidth={strokeWidth(3)}
      />
      {/* Bottom outer line */}
      <polyline
        points={`${sx(2870)} ${sy(1930)}, ${sx(30)} ${sy(1930)}`}
        fill="none"
        stroke="black"
        strokeWidth={strokeWidth(3)}
      />
      
      {/* === INNER FRAME === */}
      {/* Top inner line */}
      <polyline
        points={`${sx(60)} ${sy(60)}, ${sx(2870)} ${sy(60)}`}
        fill="none"
        stroke="black"
        strokeWidth={strokeWidth(3)}
      />
      {/* Left inner line */}
      <polyline
        points={`${sx(60)} ${sy(60)}, ${sx(60)} ${sy(1930)}`}
        fill="none"
        stroke="black"
        strokeWidth={strokeWidth(3)}
      />
      
      {/* === TOP TICK MARKS (column dividers) === */}
      <polyline points={`${sx(500)} ${sy(30)}, ${sx(500)} ${sy(60)}`} fill="none" stroke="black" strokeWidth={strokeWidth(3)} />
      <polyline points={`${sx(980)} ${sy(30)}, ${sx(980)} ${sy(60)}`} fill="none" stroke="black" strokeWidth={strokeWidth(3)} />
      <polyline points={`${sx(1450)} ${sy(30)}, ${sx(1450)} ${sy(60)}`} fill="none" stroke="black" strokeWidth={strokeWidth(3)} />
      <polyline points={`${sx(1930)} ${sy(30)}, ${sx(1930)} ${sy(60)}`} fill="none" stroke="black" strokeWidth={strokeWidth(3)} />
      <polyline points={`${sx(2400)} ${sy(30)}, ${sx(2400)} ${sy(60)}`} fill="none" stroke="black" strokeWidth={strokeWidth(3)} />
      
      {/* === LEFT TICK MARKS (row dividers) === */}
      <polyline points={`${sx(30)} ${sy(500)}, ${sx(60)} ${sy(500)}`} fill="none" stroke="black" strokeWidth={strokeWidth(2)} />
      <polyline points={`${sx(30)} ${sy(980)}, ${sx(60)} ${sy(980)}`} fill="none" stroke="black" strokeWidth={strokeWidth(3)} />
      <polyline points={`${sx(30)} ${sy(1450)}, ${sx(60)} ${sy(1450)}`} fill="none" stroke="black" strokeWidth={strokeWidth(3)} />
      
      {/* === COLUMN NUMBERS (1-6) - centered in zones === */}
      <text x={sx(236.72)} y={sy(54)} fontFamily="Arial" fontSize={fontSizeNumber} fill="black">1</text>
      <text x={sx(729.55)} y={sy(54)} fontFamily="Arial" fontSize={fontSizeNumber} fill="black">2</text>
      <text x={sx(1209.85)} y={sy(54)} fontFamily="Arial" fontSize={fontSizeNumber} fill="black">3</text>
      <text x={sx(1683.03)} y={sy(54)} fontFamily="Arial" fontSize={fontSizeNumber} fill="black">4</text>
      <text x={sx(2156.18)} y={sy(54)} fontFamily="Arial" fontSize={fontSizeNumber} fill="black">5</text>
      <text x={sx(2633.35)} y={sy(54)} fontFamily="Arial" fontSize={fontSizeNumber} fill="black">6</text>
      
      {/* === ROW LABELS (A-D) - exact positions from SVG === */}
      <text x={sx(40)} y={sy(274)} fontFamily="Arial" fontSize={fontSizeZone * 0.65} fill="black">A</text>
      <text x={sx(40)} y={sy(774)} fontFamily="Arial" fontSize={fontSizeZone * 0.65} fill="black">B</text>
      <text x={sx(40)} y={sy(1214)} fontFamily="Arial" fontSize={fontSizeZone * 0.65} fill="black">C</text>
      <text x={sx(40)} y={sy(1674)} fontFamily="Arial" fontSize={fontSizeZone * 0.65} fill="black">D</text>
      
      {/* === TITLE BLOCK HORIZONTAL LINES === */}
      {/* Main title block top line at y=1810 (full width from 60 to 2870) */}
      <polyline points={`${sx(60)} ${sy(1810)}, ${sx(2870)} ${sy(1810)}`} fill="none" stroke="black" strokeWidth={strokeWidth(2)} />
      
      {/* Line at y=1850 from 1370 to 2070 */}
      <polyline points={`${sx(1370)} ${sy(1850)}, ${sx(2070)} ${sy(1850)}`} fill="none" stroke="black" strokeWidth={strokeWidth(2)} />
      
      {/* Line at y=1850 from 2680 to 2870 */}
      <polyline points={`${sx(2680)} ${sy(1850)}, ${sx(2870)} ${sy(1850)}`} fill="none" stroke="black" strokeWidth={strokeWidth(2)} />
      
      {/* Line at y=1870 from 60 to 500 */}
      <polyline points={`${sx(60)} ${sy(1870)}, ${sx(500)} ${sy(1870)}`} fill="none" stroke="black" strokeWidth={strokeWidth(2)} />
      
      {/* Line at y=1890 from 1370 to 2070 */}
      <polyline points={`${sx(1370)} ${sy(1890)}, ${sx(2070)} ${sy(1890)}`} fill="none" stroke="black" strokeWidth={strokeWidth(2)} />
      
      {/* Line at y=1890 from 2070 to 2870 */}
      <polyline points={`${sx(2070)} ${sy(1890)}, ${sx(2870)} ${sy(1890)}`} fill="none" stroke="black" strokeWidth={strokeWidth(2)} />
      
      {/* === TITLE BLOCK VERTICAL LINES === */}
      {/* x=500 from 1810 to 1930 */}
      <polyline points={`${sx(500)} ${sy(1810)}, ${sx(500)} ${sy(1930)}`} fill="none" stroke="black" strokeWidth={strokeWidth(2)} />
      
      {/* x=940 from 1810 to 1930 */}
      <polyline points={`${sx(940)} ${sy(1810)}, ${sx(940)} ${sy(1930)}`} fill="none" stroke="black" strokeWidth={strokeWidth(2)} />
      
      {/* x=1370 from 1810 to 1930 */}
      <polyline points={`${sx(1370)} ${sy(1810)}, ${sx(1370)} ${sy(1930)}`} fill="none" stroke="black" strokeWidth={strokeWidth(2)} />
      
      {/* x=1510 from 1850 to 1930 (starts at 1850, not 1810!) */}
      <polyline points={`${sx(1510)} ${sy(1850)}, ${sx(1510)} ${sy(1930)}`} fill="none" stroke="black" strokeWidth={strokeWidth(2)} />
      
      {/* x=1680 from 1810 to 1930 */}
      <polyline points={`${sx(1680)} ${sy(1810)}, ${sx(1680)} ${sy(1930)}`} fill="none" stroke="black" strokeWidth={strokeWidth(2)} />
      
      {/* x=1760 from 1810 to 1930 */}
      <polyline points={`${sx(1760)} ${sy(1810)}, ${sx(1760)} ${sy(1930)}`} fill="none" stroke="black" strokeWidth={strokeWidth(2)} />
      
      {/* x=1900 from 1810 to 1930 */}
      <polyline points={`${sx(1900)} ${sy(1810)}, ${sx(1900)} ${sy(1930)}`} fill="none" stroke="black" strokeWidth={strokeWidth(2)} />
      
      {/* x=2070 from 1810 to 1930 */}
      <polyline points={`${sx(2070)} ${sy(1810)}, ${sx(2070)} ${sy(1930)}`} fill="none" stroke="black" strokeWidth={strokeWidth(2)} />
      
      {/* x=2680 from 1810 to 1930 */}
      <polyline points={`${sx(2680)} ${sy(1810)}, ${sx(2680)} ${sy(1930)}`} fill="none" stroke="black" strokeWidth={strokeWidth(2)} />
      
      {/* === TITLE BLOCK LABELS - exact positions from SVG === */}
      <text x={sx(1431.85)} y={sy(1840)} fontFamily="Arial" fontSize={fontSize} fill="black">Änderungen</text>
      <text x={sx(1736.16)} y={sy(1880)} fontFamily="Arial" fontSize={fontSize} fill="black">gez.:</text>
      <text x={sx(1727.38)} y={sy(1920)} fontFamily="Arial" fontSize={fontSize} fill="black">gepr.:</text>
      <text x={sx(1823.81)} y={sy(1840)} fontFamily="Arial" fontSize={fontSize} fill="black">Datum</text>
      <text x={sx(2022.76)} y={sy(1840)} fontFamily="Arial" fontSize={fontSize} fill="black">Name</text>
      <text x={sx(2098.25)} y={sy(1843)} fontFamily="Arial" fontSize={fontSizeLarge} fill="black">Projekt:</text>
      <text x={sx(2059.54)} y={sy(1913)} fontFamily="Arial" fontSize={fontSizeLarge} fill="black">Zeichnungs-Nr.:</text>
      <text x={sx(2684.18)} y={sy(1913.37)} fontFamily="Arial" fontSize={fontSizeLarge} fill="black">Blattzahl:</text>
      <text x={sx(2708.88)} y={sy(1873.37)} fontFamily="Arial" fontSize={fontSizeLarge} fill="black">Blatt-Nr.:</text>
      
      {/* === EDITABLE FIELD VALUES === */}
      {/* Projekt value */}
      <text x={sx(2200)} y={sy(1865)} fontSize={fontSizeLarge * 1.1} fontWeight="bold" fill="rgb(128,0,0)">{data.projekt}</text>
      
      {/* Zeichnungs-Nr. value */}
      <text x={sx(2200)} y={sy(1935)} fontSize={fontSizeLarge * 1.1} fontWeight="bold" fill="rgb(128,0,0)">{data.zeichnungsNr}</text>
      
      {/* Blatt-Nr. value */}
      <text x={sx(2820)} y={sy(1895)} fontSize={fontSizeLarge * 1.1} fontWeight="bold" fill="rgb(128,0,0)">{data.blattNr}</text>
      
      {/* Blattzahl value */}
      <text x={sx(2820)} y={sy(1935)} fontSize={fontSizeLarge * 1.1} fontWeight="bold" fill="rgb(128,0,0)">{data.blattzahl}</text>
      
      {/* gez. Datum */}
      <text x={sx(1770)} y={sy(1905)} fontSize={fontSize} fill="rgb(0,128,0)">{data.gezeichnet.datum}</text>
      
      {/* gez. Name */}
      <text x={sx(1910)} y={sy(1905)} fontSize={fontSize} fill="rgb(0,128,0)">{data.gezeichnet.name}</text>
      
      {/* gepr. Datum */}
      <text x={sx(1770)} y={sy(1945)} fontSize={fontSize} fill="rgb(0,128,0)">{data.geprueft.datum}</text>
      
      {/* gepr. Name */}
      <text x={sx(1910)} y={sy(1945)} fontSize={fontSize} fill="rgb(0,128,0)">{data.geprueft.name}</text>
      
      {/* Änderungen value */}
      <text x={sx(70)} y={sy(1855)} fontSize={fontSize} fill="black">{data.aenderungen}</text>
    </g>
  );
}
