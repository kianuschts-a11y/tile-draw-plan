import { Component, Shape } from "@/types/schematic";

/**
 * Vordefinierte Verbindungsblöcke (Connection Blocks)
 * 
 * Diese speziellen 1x1 Komponenten können auf leere Zellen gezogen werden,
 * um Lücken zwischen Komponenten zu überbrücken.
 * 
 * Typen:
 * - Horizontal: Linie von links nach rechts
 * - Vertikal: Linie von oben nach unten
 * - Ecke oben-links: L-förmig von rechts nach unten
 * - Ecke oben-rechts: L-förmig von links nach unten
 * - Ecke unten-links: L-förmig von rechts nach oben
 * - Ecke unten-rechts: L-förmig von links nach oben
 */

// Muss mit connectionUtils.ts und Canvas.tsx übereinstimmen
// Canvas nutzt: tileSize * 0.04 für Verbindungslinien
// Für Komponenten: strokeWidth * refScale, wobei refScale = tileSize
// Also brauchen wir 0.04 hier damit 0.04 * tileSize = tileSize * 0.04
const STROKE_WIDTH = 0.04;

// Horizontale Linie (von links nach rechts durch die Mitte)
const horizontalLineShape: Shape = {
  id: 'conn-h-line',
  type: 'line',
  x: 0,
  y: 0.5,
  width: 1,
  height: 0,
  strokeWidth: STROKE_WIDTH
};

// Vertikale Linie (von oben nach unten durch die Mitte)
const verticalLineShape: Shape = {
  id: 'conn-v-line',
  type: 'line',
  x: 0.5,
  y: 0,
  width: 0,
  height: 1,
  strokeWidth: STROKE_WIDTH
};

// Ecke oben-links (von rechts kommend, nach unten gehend)
// Linie von rechts zur Mitte, dann von Mitte nach unten
const cornerTopLeftShapes: Shape[] = [
  {
    id: 'conn-tl-h',
    type: 'line',
    x: 0.5,
    y: 0.5,
    width: 0.5,
    height: 0,
    strokeWidth: STROKE_WIDTH
  },
  {
    id: 'conn-tl-v',
    type: 'line',
    x: 0.5,
    y: 0.5,
    width: 0,
    height: 0.5,
    strokeWidth: STROKE_WIDTH
  }
];

// Ecke oben-rechts (von links kommend, nach unten gehend)
// Linie von links zur Mitte, dann von Mitte nach unten
const cornerTopRightShapes: Shape[] = [
  {
    id: 'conn-tr-h',
    type: 'line',
    x: 0,
    y: 0.5,
    width: 0.5,
    height: 0,
    strokeWidth: STROKE_WIDTH
  },
  {
    id: 'conn-tr-v',
    type: 'line',
    x: 0.5,
    y: 0.5,
    width: 0,
    height: 0.5,
    strokeWidth: STROKE_WIDTH
  }
];

// Ecke unten-links (von rechts kommend, nach oben gehend)
// Linie von rechts zur Mitte, dann von Mitte nach oben
const cornerBottomLeftShapes: Shape[] = [
  {
    id: 'conn-bl-h',
    type: 'line',
    x: 0.5,
    y: 0.5,
    width: 0.5,
    height: 0,
    strokeWidth: STROKE_WIDTH
  },
  {
    id: 'conn-bl-v',
    type: 'line',
    x: 0.5,
    y: 0,
    width: 0,
    height: 0.5,
    strokeWidth: STROKE_WIDTH
  }
];

// Ecke unten-rechts (von links kommend, nach oben gehend)
// Linie von links zur Mitte, dann von Mitte nach oben
const cornerBottomRightShapes: Shape[] = [
  {
    id: 'conn-br-h',
    type: 'line',
    x: 0,
    y: 0.5,
    width: 0.5,
    height: 0,
    strokeWidth: STROKE_WIDTH
  },
  {
    id: 'conn-br-v',
    type: 'line',
    x: 0.5,
    y: 0,
    width: 0,
    height: 0.5,
    strokeWidth: STROKE_WIDTH
  }
];

// T-Stück (drei Richtungen)
const tPieceTopShapes: Shape[] = [
  {
    id: 'conn-t-top-h',
    type: 'line',
    x: 0,
    y: 0.5,
    width: 1,
    height: 0,
    strokeWidth: STROKE_WIDTH
  },
  {
    id: 'conn-t-top-v',
    type: 'line',
    x: 0.5,
    y: 0.5,
    width: 0,
    height: 0.5,
    strokeWidth: STROKE_WIDTH
  }
];

const tPieceBottomShapes: Shape[] = [
  {
    id: 'conn-t-bottom-h',
    type: 'line',
    x: 0,
    y: 0.5,
    width: 1,
    height: 0,
    strokeWidth: STROKE_WIDTH
  },
  {
    id: 'conn-t-bottom-v',
    type: 'line',
    x: 0.5,
    y: 0,
    width: 0,
    height: 0.5,
    strokeWidth: STROKE_WIDTH
  }
];

const tPieceLeftShapes: Shape[] = [
  {
    id: 'conn-t-left-v',
    type: 'line',
    x: 0.5,
    y: 0,
    width: 0,
    height: 1,
    strokeWidth: STROKE_WIDTH
  },
  {
    id: 'conn-t-left-h',
    type: 'line',
    x: 0.5,
    y: 0.5,
    width: 0.5,
    height: 0,
    strokeWidth: STROKE_WIDTH
  }
];

const tPieceRightShapes: Shape[] = [
  {
    id: 'conn-t-right-v',
    type: 'line',
    x: 0.5,
    y: 0,
    width: 0,
    height: 1,
    strokeWidth: STROKE_WIDTH
  },
  {
    id: 'conn-t-right-h',
    type: 'line',
    x: 0,
    y: 0.5,
    width: 0.5,
    height: 0,
    strokeWidth: STROKE_WIDTH
  }
];

// Kreuzung (alle vier Richtungen)
const crossShapes: Shape[] = [
  {
    id: 'conn-cross-h',
    type: 'line',
    x: 0,
    y: 0.5,
    width: 1,
    height: 0,
    strokeWidth: STROKE_WIDTH
  },
  {
    id: 'conn-cross-v',
    type: 'line',
    x: 0.5,
    y: 0,
    width: 0,
    height: 1,
    strokeWidth: STROKE_WIDTH
  }
];

export const CONNECTION_BLOCKS: Component[] = [
  {
    id: 'connection-horizontal',
    name: '─ Horizontal',
    shapes: [horizontalLineShape],
    width: 1,
    height: 1,
    tileSize: '1x1'
  },
  {
    id: 'connection-vertical',
    name: '│ Vertikal',
    shapes: [verticalLineShape],
    width: 1,
    height: 1,
    tileSize: '1x1'
  },
  {
    id: 'connection-corner-tl',
    name: '┐ Ecke O-L',
    shapes: cornerTopLeftShapes,
    width: 1,
    height: 1,
    tileSize: '1x1'
  },
  {
    id: 'connection-corner-tr',
    name: '┌ Ecke O-R',
    shapes: cornerTopRightShapes,
    width: 1,
    height: 1,
    tileSize: '1x1'
  },
  {
    id: 'connection-corner-bl',
    name: '┘ Ecke U-L',
    shapes: cornerBottomLeftShapes,
    width: 1,
    height: 1,
    tileSize: '1x1'
  },
  {
    id: 'connection-corner-br',
    name: '└ Ecke U-R',
    shapes: cornerBottomRightShapes,
    width: 1,
    height: 1,
    tileSize: '1x1'
  },
  {
    id: 'connection-t-top',
    name: '┬ T-Stück Oben',
    shapes: tPieceTopShapes,
    width: 1,
    height: 1,
    tileSize: '1x1'
  },
  {
    id: 'connection-t-bottom',
    name: '┴ T-Stück Unten',
    shapes: tPieceBottomShapes,
    width: 1,
    height: 1,
    tileSize: '1x1'
  },
  {
    id: 'connection-t-left',
    name: '├ T-Stück Links',
    shapes: tPieceLeftShapes,
    width: 1,
    height: 1,
    tileSize: '1x1'
  },
  {
    id: 'connection-t-right',
    name: '┤ T-Stück Rechts',
    shapes: tPieceRightShapes,
    width: 1,
    height: 1,
    tileSize: '1x1'
  },
  {
    id: 'connection-cross',
    name: '┼ Kreuzung',
    shapes: crossShapes,
    width: 1,
    height: 1,
    tileSize: '1x1'
  }
];

/**
 * Prüft ob eine Komponente ein Verbindungsblock ist
 */
export function isConnectionBlock(component: Component): boolean {
  return component.id.startsWith('connection-');
}

/**
 * Gibt alle Verbindungsblock-IDs zurück
 */
export function getConnectionBlockIds(): string[] {
  return CONNECTION_BLOCKS.map(block => block.id);
}
