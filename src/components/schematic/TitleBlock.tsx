import { TitleBlockData } from "@/types/schematic";

interface TitleBlockProps {
  data: TitleBlockData;
  paperWidth: number;
  paperHeight: number;
  tileSize: number;
  onDataChange: (data: TitleBlockData) => void;
}

// The SVG is designed for A4 landscape (2970 x 2100 units = 297mm x 210mm)
// We need to scale it to fit the current paper size
const ORIGINAL_WIDTH = 2970;
const ORIGINAL_HEIGHT = 2100;

// Title block area in original SVG coordinates (bottom section)
const TITLE_BLOCK_Y = 1810;
const TITLE_BLOCK_HEIGHT = ORIGINAL_HEIGHT - TITLE_BLOCK_Y; // ~290 units

export function TitleBlock({ data, paperWidth, paperHeight, tileSize, onDataChange }: TitleBlockProps) {
  // Calculate scale to fit current paper
  const scale = paperWidth / ORIGINAL_WIDTH;
  
  // Title block dimensions scaled
  const blockHeight = TITLE_BLOCK_HEIGHT * scale;
  const blockY = paperHeight - blockHeight;
  
  // Field positions (in original coordinates, will be scaled)
  const fields = {
    projekt: { x: 2200, y: 1843, width: 470 },
    zeichnungsNr: { x: 2200, y: 1913, width: 470 },
    blattNr: { x: 2800, y: 1873, width: 60 },
    blattzahl: { x: 2800, y: 1913, width: 60 },
    aenderungen: { x: 100, y: 1850, width: 800 },
    gezName: { x: 1900, y: 1880, width: 160 },
    gezDatum: { x: 1760, y: 1880, width: 130 },
    geprName: { x: 1900, y: 1920, width: 160 },
    geprDatum: { x: 1760, y: 1920, width: 130 },
  };

  const scaledX = (x: number) => x * scale;
  const scaledY = (y: number) => (y - TITLE_BLOCK_Y) * scale + blockY;
  const scaledWidth = (w: number) => w * scale;
  const fontSize = Math.max(8, 14 * scale);

  return (
    <g className="title-block">
      {/* Main border frame */}
      <rect
        x={30 * scale}
        y={30 * scale}
        width={paperWidth - 60 * scale}
        height={paperHeight - 60 * scale}
        fill="none"
        stroke="black"
        strokeWidth={3 * scale}
      />
      
      {/* Inner frame */}
      <rect
        x={60 * scale}
        y={60 * scale}
        width={paperWidth - 120 * scale}
        height={paperHeight - 120 * scale}
        fill="none"
        stroke="black"
        strokeWidth={3 * scale}
      />
      
      {/* Title block separator line */}
      <line
        x1={60 * scale}
        y1={blockY}
        x2={paperWidth - 60 * scale}
        y2={blockY}
        stroke="black"
        strokeWidth={2 * scale}
      />
      
      {/* Vertical dividers in title block */}
      <line x1={scaledX(500)} y1={blockY} x2={scaledX(500)} y2={paperHeight - 60 * scale} stroke="black" strokeWidth={2 * scale} />
      <line x1={scaledX(940)} y1={blockY} x2={scaledX(940)} y2={paperHeight - 60 * scale} stroke="black" strokeWidth={2 * scale} />
      <line x1={scaledX(1370)} y1={blockY} x2={scaledX(1370)} y2={paperHeight - 60 * scale} stroke="black" strokeWidth={2 * scale} />
      <line x1={scaledX(1680)} y1={blockY} x2={scaledX(1680)} y2={paperHeight - 60 * scale} stroke="black" strokeWidth={2 * scale} />
      <line x1={scaledX(1760)} y1={blockY} x2={scaledX(1760)} y2={paperHeight - 60 * scale} stroke="black" strokeWidth={2 * scale} />
      <line x1={scaledX(1900)} y1={blockY} x2={scaledX(1900)} y2={paperHeight - 60 * scale} stroke="black" strokeWidth={2 * scale} />
      <line x1={scaledX(2070)} y1={blockY} x2={scaledX(2070)} y2={paperHeight - 60 * scale} stroke="black" strokeWidth={2 * scale} />
      <line x1={scaledX(2680)} y1={blockY} x2={scaledX(2680)} y2={paperHeight - 60 * scale} stroke="black" strokeWidth={2 * scale} />
      
      {/* Horizontal dividers */}
      <line x1={scaledX(1370)} y1={scaledY(1850)} x2={scaledX(2070)} y2={scaledY(1850)} stroke="black" strokeWidth={2 * scale} />
      <line x1={scaledX(1370)} y1={scaledY(1890)} x2={scaledX(2070)} y2={scaledY(1890)} stroke="black" strokeWidth={2 * scale} />
      <line x1={scaledX(2070)} y1={scaledY(1850)} x2={paperWidth - 60 * scale} y2={scaledY(1850)} stroke="black" strokeWidth={2 * scale} />
      <line x1={scaledX(2070)} y1={scaledY(1890)} x2={paperWidth - 60 * scale} y2={scaledY(1890)} stroke="black" strokeWidth={2 * scale} />
      <line x1={scaledX(2680)} y1={scaledY(1850)} x2={paperWidth - 60 * scale} y2={scaledY(1850)} stroke="black" strokeWidth={2 * scale} />
      <line x1={60 * scale} y1={scaledY(1870)} x2={scaledX(500)} y2={scaledY(1870)} stroke="black" strokeWidth={2 * scale} />
      <line x1={scaledX(1510)} y1={scaledY(1850)} x2={scaledX(1510)} y2={paperHeight - 60 * scale} stroke="black" strokeWidth={2 * scale} />
      
      {/* Labels */}
      <text x={scaledX(1440)} y={scaledY(1840)} fontSize={fontSize} fill="black">Änderungen</text>
      <text x={scaledX(1740)} y={scaledY(1880)} fontSize={fontSize} fill="black">gez.:</text>
      <text x={scaledX(1730)} y={scaledY(1920)} fontSize={fontSize} fill="black">gepr.:</text>
      <text x={scaledX(1830)} y={scaledY(1840)} fontSize={fontSize} fill="black">Datum</text>
      <text x={scaledX(2020)} y={scaledY(1840)} fontSize={fontSize} fill="black">Name</text>
      <text x={scaledX(2100)} y={scaledY(1843)} fontSize={fontSize * 1.1} fill="black">Projekt:</text>
      <text x={scaledX(2060)} y={scaledY(1913)} fontSize={fontSize * 1.1} fill="black">Zeichnungs-Nr.:</text>
      <text x={scaledX(2690)} y={scaledY(1913)} fontSize={fontSize * 1.1} fill="black">Blattzahl:</text>
      <text x={scaledX(2710)} y={scaledY(1873)} fontSize={fontSize * 1.1} fill="black">Blatt-Nr.:</text>
      
      {/* Zone labels (A, B, C, D) */}
      <text x={57 * scale} y={paperHeight * 0.18} fontSize={fontSize * 1.8} fill="black">A</text>
      <text x={57 * scale} y={paperHeight * 0.42} fontSize={fontSize * 1.8} fill="black">B</text>
      <text x={57 * scale} y={paperHeight * 0.66} fontSize={fontSize * 1.8} fill="black">C</text>
      <text x={57 * scale} y={paperHeight * 0.86} fontSize={fontSize * 1.8} fill="black">D</text>
      
      {/* Column labels (1-6) at top */}
      <text x={paperWidth * 0.08} y={52 * scale} fontSize={fontSize * 1.3} fill="black">1</text>
      <text x={paperWidth * 0.24} y={52 * scale} fontSize={fontSize * 1.3} fill="black">2</text>
      <text x={paperWidth * 0.40} y={52 * scale} fontSize={fontSize * 1.3} fill="black">3</text>
      <text x={paperWidth * 0.56} y={52 * scale} fontSize={fontSize * 1.3} fill="black">4</text>
      <text x={paperWidth * 0.72} y={52 * scale} fontSize={fontSize * 1.3} fill="black">5</text>
      <text x={paperWidth * 0.88} y={52 * scale} fontSize={fontSize * 1.3} fill="black">6</text>
      
      {/* Tick marks at top and left edges */}
      {[500, 980, 1450, 1930, 2400].map(x => (
        <line key={`tick-top-${x}`} x1={scaledX(x)} y1={30 * scale} x2={scaledX(x)} y2={60 * scale} stroke="black" strokeWidth={3 * scale} />
      ))}
      {[500, 980, 1450].map(y => (
        <line key={`tick-left-${y}`} x1={30 * scale} y1={(y / ORIGINAL_HEIGHT) * paperHeight} x2={60 * scale} y2={(y / ORIGINAL_HEIGHT) * paperHeight} stroke="black" strokeWidth={3 * scale} />
      ))}
      
      {/* Editable field values */}
      <text x={scaledX(2200)} y={scaledY(1865)} fontSize={fontSize * 1.2} fontWeight="bold" fill="black">{data.projekt}</text>
      <text x={scaledX(2200)} y={scaledY(1935)} fontSize={fontSize * 1.2} fontWeight="bold" fill="black">{data.zeichnungsNr}</text>
      <text x={scaledX(2820)} y={scaledY(1895)} fontSize={fontSize * 1.2} fontWeight="bold" fill="black">{data.blattNr}</text>
      <text x={scaledX(2820)} y={scaledY(1935)} fontSize={fontSize * 1.2} fontWeight="bold" fill="black">{data.blattzahl}</text>
      <text x={scaledX(1785)} y={scaledY(1900)} fontSize={fontSize} fill="black">{data.gezeichnet.datum}</text>
      <text x={scaledX(1930)} y={scaledY(1900)} fontSize={fontSize} fill="black">{data.gezeichnet.name}</text>
      <text x={scaledX(1785)} y={scaledY(1940)} fontSize={fontSize} fill="black">{data.geprueft.datum}</text>
      <text x={scaledX(1930)} y={scaledY(1940)} fontSize={fontSize} fill="black">{data.geprueft.name}</text>
      <text x={scaledX(100)} y={scaledY(1890)} fontSize={fontSize} fill="black">{data.aenderungen}</text>
    </g>
  );
}
