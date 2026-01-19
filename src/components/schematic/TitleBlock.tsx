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
  
  // Use uniform scale based on width for proper proportions
  const scale = scaleX;
  
  // Scaled helper functions
  const sx = (x: number) => x * scaleX;
  const sy = (y: number) => y * scaleY;
  
  const fontSize = Math.max(8, 18 * scale);
  const fontSizeLarge = Math.max(10, 20 * scale);
  const fontSizeZone = Math.max(12, 30 * scale);
  const fontSizeNumber = Math.max(10, 21 * scale);

  return (
    <g className="title-block">
      {/* Outer frame (30,30 to 2870,1930) */}
      <polyline
        points={`${sx(60)} ${sy(60)}, ${sx(OUTER_MARGIN)} ${sy(OUTER_MARGIN)}`}
        fill="none"
        stroke="black"
        strokeWidth={3 * scale}
      />
      <polyline
        points={`${sx(OUTER_MARGIN)} ${sy(OUTER_MARGIN)}, ${sx(2870)} ${sy(OUTER_MARGIN)}`}
        fill="none"
        stroke="black"
        strokeWidth={3 * scale}
      />
      <polyline
        points={`${sx(OUTER_MARGIN)} ${sy(OUTER_MARGIN)}, ${sx(OUTER_MARGIN)} ${sy(FRAME_BOTTOM)}`}
        fill="none"
        stroke="black"
        strokeWidth={3 * scale}
      />
      <polyline
        points={`${sx(2870)} ${sy(OUTER_MARGIN)}, ${sx(2870)} ${sy(FRAME_BOTTOM)}`}
        fill="none"
        stroke="black"
        strokeWidth={3 * scale}
      />
      <polyline
        points={`${sx(2870)} ${sy(FRAME_BOTTOM)}, ${sx(OUTER_MARGIN)} ${sy(FRAME_BOTTOM)}`}
        fill="none"
        stroke="black"
        strokeWidth={3 * scale}
      />
      
      {/* Inner frame (60,60 to 2870,1930) */}
      <polyline
        points={`${sx(INNER_MARGIN)} ${sy(INNER_MARGIN)}, ${sx(2870)} ${sy(INNER_MARGIN)}`}
        fill="none"
        stroke="black"
        strokeWidth={3 * scale}
      />
      <polyline
        points={`${sx(INNER_MARGIN)} ${sy(INNER_MARGIN)}, ${sx(INNER_MARGIN)} ${sy(FRAME_BOTTOM)}`}
        fill="none"
        stroke="black"
        strokeWidth={3 * scale}
      />
      
      {/* Top tick marks (column dividers) */}
      <polyline points={`${sx(500)} ${sy(30)}, ${sx(500)} ${sy(60)}`} fill="none" stroke="black" strokeWidth={3 * scale} />
      <polyline points={`${sx(980)} ${sy(30)}, ${sx(980)} ${sy(60)}`} fill="none" stroke="black" strokeWidth={3 * scale} />
      <polyline points={`${sx(1450)} ${sy(30)}, ${sx(1450)} ${sy(60)}`} fill="none" stroke="black" strokeWidth={3 * scale} />
      <polyline points={`${sx(1930)} ${sy(30)}, ${sx(1930)} ${sy(60)}`} fill="none" stroke="black" strokeWidth={3 * scale} />
      <polyline points={`${sx(2400)} ${sy(30)}, ${sx(2400)} ${sy(60)}`} fill="none" stroke="black" strokeWidth={3 * scale} />
      
      {/* Left tick marks (row dividers) */}
      <polyline points={`${sx(30)} ${sy(500)}, ${sx(60)} ${sy(500)}`} fill="none" stroke="black" strokeWidth={2 * scale} />
      <polyline points={`${sx(30)} ${sy(980)}, ${sx(60)} ${sy(980)}`} fill="none" stroke="black" strokeWidth={3 * scale} />
      <polyline points={`${sx(30)} ${sy(1450)}, ${sx(60)} ${sy(1450)}`} fill="none" stroke="black" strokeWidth={3 * scale} />
      
      {/* Column numbers (1-6) - exact positions from SVG */}
      <text x={sx(236.72)} y={sy(54)} fontFamily="Arial" fontSize={fontSizeNumber} fill="black">1</text>
      <text x={sx(729.55)} y={sy(54)} fontFamily="Arial" fontSize={fontSizeNumber} fill="black">2</text>
      <text x={sx(1209.85)} y={sy(54)} fontFamily="Arial" fontSize={fontSizeNumber} fill="black">3</text>
      <text x={sx(1683.03)} y={sy(54)} fontFamily="Arial" fontSize={fontSizeNumber} fill="black">4</text>
      <text x={sx(2156.18)} y={sy(54)} fontFamily="Arial" fontSize={fontSizeNumber} fill="black">5</text>
      <text x={sx(2633.35)} y={sy(54)} fontFamily="Arial" fontSize={fontSizeNumber} fill="black">6</text>
      
      {/* Row labels (A-D) - exact positions from SVG, between inner frame and zones */}
      <text x={sx(40)} y={sy(274)} fontFamily="Arial" fontSize={fontSizeZone * 0.65} fill="black">A</text>
      <text x={sx(40)} y={sy(774)} fontFamily="Arial" fontSize={fontSizeZone * 0.65} fill="black">B</text>
      <text x={sx(40)} y={sy(1214)} fontFamily="Arial" fontSize={fontSizeZone * 0.65} fill="black">C</text>
      <text x={sx(40)} y={sy(1674)} fontFamily="Arial" fontSize={fontSizeZone * 0.65} fill="black">D</text>
      
      {/* Title block horizontal line at y=1810 */}
      <polyline points={`${sx(60)} ${sy(1810)}, ${sx(2870)} ${sy(1810)}`} fill="none" stroke="black" strokeWidth={2 * scale} />
      
      {/* Title block vertical dividers */}
      <polyline points={`${sx(500)} ${sy(1810)}, ${sx(500)} ${sy(1930)}`} fill="none" stroke="black" strokeWidth={2 * scale} />
      <polyline points={`${sx(940)} ${sy(1810)}, ${sx(940)} ${sy(1930)}`} fill="none" stroke="black" strokeWidth={2 * scale} />
      <polyline points={`${sx(1370)} ${sy(1810)}, ${sx(1370)} ${sy(1930)}`} fill="none" stroke="black" strokeWidth={2 * scale} />
      <polyline points={`${sx(1510)} ${sy(1850)}, ${sx(1510)} ${sy(1930)}`} fill="none" stroke="black" strokeWidth={2 * scale} />
      <polyline points={`${sx(1680)} ${sy(1810)}, ${sx(1680)} ${sy(1930)}`} fill="none" stroke="black" strokeWidth={2 * scale} />
      <polyline points={`${sx(1760)} ${sy(1810)}, ${sx(1760)} ${sy(1930)}`} fill="none" stroke="black" strokeWidth={2 * scale} />
      <polyline points={`${sx(1900)} ${sy(1810)}, ${sx(1900)} ${sy(1930)}`} fill="none" stroke="black" strokeWidth={2 * scale} />
      <polyline points={`${sx(2070)} ${sy(1810)}, ${sx(2070)} ${sy(1930)}`} fill="none" stroke="black" strokeWidth={2 * scale} />
      <polyline points={`${sx(2680)} ${sy(1810)}, ${sx(2680)} ${sy(1930)}`} fill="none" stroke="black" strokeWidth={2 * scale} />
      
      {/* Title block horizontal dividers */}
      <polyline points={`${sx(60)} ${sy(1870)}, ${sx(500)} ${sy(1870)}`} fill="none" stroke="black" strokeWidth={2 * scale} />
      <polyline points={`${sx(1370)} ${sy(1850)}, ${sx(2070)} ${sy(1850)}`} fill="none" stroke="black" strokeWidth={2 * scale} />
      <polyline points={`${sx(1370)} ${sy(1890)}, ${sx(2070)} ${sy(1890)}`} fill="none" stroke="black" strokeWidth={2 * scale} />
      <polyline points={`${sx(2070)} ${sy(1850)}, ${sx(2870)} ${sy(1850)}`} fill="none" stroke="black" strokeWidth={2 * scale} />
      <polyline points={`${sx(2070)} ${sy(1890)}, ${sx(2870)} ${sy(1890)}`} fill="none" stroke="black" strokeWidth={2 * scale} />
      
      {/* Labels - exact positions from SVG */}
      <text x={sx(1431.85)} y={sy(1840)} fontFamily="Arial" fontSize={fontSize} fill="black">Änderungen</text>
      <text x={sx(1736.16)} y={sy(1880)} fontFamily="Arial" fontSize={fontSize} fill="black">gez.:</text>
      <text x={sx(1727.38)} y={sy(1920)} fontFamily="Arial" fontSize={fontSize} fill="black">gepr.:</text>
      <text x={sx(1823.81)} y={sy(1840)} fontFamily="Arial" fontSize={fontSize} fill="black">Datum</text>
      <text x={sx(2022.76)} y={sy(1840)} fontFamily="Arial" fontSize={fontSize} fill="black">Name</text>
      <text x={sx(2098.25)} y={sy(1843)} fontFamily="Arial" fontSize={fontSizeLarge} fill="black">Projekt:</text>
      <text x={sx(2059.54)} y={sy(1913)} fontFamily="Arial" fontSize={fontSizeLarge} fill="black">Zeichnungs-Nr.:</text>
      <text x={sx(2684.18)} y={sy(1913.37)} fontFamily="Arial" fontSize={fontSizeLarge} fill="black">Blattzahl:</text>
      <text x={sx(2708.88)} y={sy(1873.37)} fontFamily="Arial" fontSize={fontSizeLarge} fill="black">Blatt-Nr.:</text>
      
      {/* Editable field values */}
      <text x={sx(2200)} y={sy(1865)} fontSize={fontSizeLarge * 1.1} fontWeight="bold" fill="black">{data.projekt}</text>
      <text x={sx(2200)} y={sy(1935)} fontSize={fontSizeLarge * 1.1} fontWeight="bold" fill="black">{data.zeichnungsNr}</text>
      <text x={sx(2800)} y={sy(1895)} fontSize={fontSizeLarge * 1.1} fontWeight="bold" fill="black">{data.blattNr}</text>
      <text x={sx(2800)} y={sy(1935)} fontSize={fontSizeLarge * 1.1} fontWeight="bold" fill="black">{data.blattzahl}</text>
      <text x={sx(1770)} y={sy(1905)} fontSize={fontSize} fill="black">{data.gezeichnet.datum}</text>
      <text x={sx(1910)} y={sy(1905)} fontSize={fontSize} fill="black">{data.gezeichnet.name}</text>
      <text x={sx(1770)} y={sy(1945)} fontSize={fontSize} fill="black">{data.geprueft.datum}</text>
      <text x={sx(1910)} y={sy(1945)} fontSize={fontSize} fill="black">{data.geprueft.name}</text>
      <text x={sx(70)} y={sy(1855)} fontSize={fontSize} fill="black">{data.aenderungen}</text>
    </g>
  );
}
