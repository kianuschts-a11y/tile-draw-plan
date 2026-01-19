import { Component, TitleBlockData, PAPER_SIZES, PaperFormat, Orientation, MM_TO_PX } from "@/types/schematic";
import { PlacedTile } from "./Canvas";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download } from "lucide-react";

interface BillOfMaterialsItem {
  position: number;
  componentId: string;
  name: string;
  description: string;
  quantity: number;
  instanceIndex?: number; // For individual items with descriptions
}

interface BillOfMaterialsProps {
  open: boolean;
  onClose: () => void;
  tiles: PlacedTile[];
  titleBlockData: TitleBlockData;
  paperFormat: PaperFormat;
  orientation: Orientation;
  projectDescriptions: Map<string, string[]>;
}

export function BillOfMaterials({ 
  open, 
  onClose, 
  tiles, 
  titleBlockData,
  paperFormat,
  orientation,
  projectDescriptions
}: BillOfMaterialsProps) {
  
  // Calculate BOM from placed tiles with descriptions
  const bomItems: BillOfMaterialsItem[] = (() => {
    const componentCounts = new Map<string, { component: Component; count: number }>();
    
    for (const tile of tiles) {
      const existing = componentCounts.get(tile.component.id);
      if (existing) {
        existing.count++;
      } else {
        componentCounts.set(tile.component.id, { component: tile.component, count: 1 });
      }
    }
    
    const items: BillOfMaterialsItem[] = [];
    let position = 1;
    
    // Sort by name first
    const sortedEntries = Array.from(componentCounts.entries())
      .sort(([, a], [, b]) => a.component.name.localeCompare(b.component.name));
    
    for (const [id, { component, count }] of sortedEntries) {
      const descriptions = projectDescriptions.get(id) || [];
      const hasDescriptions = descriptions.some(d => d && d.trim() !== '');
      
      if (hasDescriptions) {
        // Create individual items for each instance with description
        for (let i = 0; i < count; i++) {
          items.push({
            position: position++,
            componentId: id,
            name: component.name,
            description: descriptions[i] || '',
            quantity: 1,
            instanceIndex: i
          });
        }
      } else {
        // Single grouped item without descriptions
        items.push({
          position: position++,
          componentId: id,
          name: component.name,
          description: '',
          quantity: count
        });
      }
    }
    
    return items;
  })();

  const handleExport = () => {
    // Calculate paper dimensions
    const paperSize = PAPER_SIZES[paperFormat];
    const paperWidthMM = orientation === 'landscape' ? paperSize.height : paperSize.width;
    const paperHeightMM = orientation === 'landscape' ? paperSize.width : paperSize.height;
    const paperWidthPx = paperWidthMM * MM_TO_PX;
    const paperHeightPx = paperHeightMM * MM_TO_PX;

    // Create SVG for BOM export
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", String(paperWidthPx));
    svg.setAttribute("height", String(paperHeightPx));
    svg.setAttribute("viewBox", `0 0 ${paperWidthPx} ${paperHeightPx}`);

    // White background
    const bg = document.createElementNS(svgNS, "rect");
    bg.setAttribute("width", "100%");
    bg.setAttribute("height", "100%");
    bg.setAttribute("fill", "white");
    svg.appendChild(bg);

    // Styling
    const margin = 40;
    const headerHeight = 80;
    const rowHeight = 30;
    const fontSize = 14;
    const headerFontSize = 18;
    const titleFontSize = 24;

    // Column widths (as percentages of available width)
    const availableWidth = paperWidthPx - margin * 2;
    const columns = [
      { header: "Pos.", width: availableWidth * 0.08 },
      { header: "Benennung", width: availableWidth * 0.35 },
      { header: "Beschreibung", width: availableWidth * 0.42 },
      { header: "Menge", width: availableWidth * 0.15 }
    ];

    // Title
    const title = document.createElementNS(svgNS, "text");
    title.setAttribute("x", String(margin));
    title.setAttribute("y", String(margin + 30));
    title.setAttribute("font-family", "Arial, sans-serif");
    title.setAttribute("font-size", String(titleFontSize));
    title.setAttribute("font-weight", "bold");
    title.setAttribute("fill", "black");
    title.textContent = "Stückliste";
    svg.appendChild(title);

    // Project info from title block
    if (titleBlockData.projekt) {
      const projectLabel = document.createElementNS(svgNS, "text");
      projectLabel.setAttribute("x", String(margin));
      projectLabel.setAttribute("y", String(margin + 55));
      projectLabel.setAttribute("font-family", "Arial, sans-serif");
      projectLabel.setAttribute("font-size", String(fontSize));
      projectLabel.setAttribute("fill", "black");
      projectLabel.textContent = `Projekt: ${titleBlockData.projekt}`;
      svg.appendChild(projectLabel);
    }

    if (titleBlockData.zeichnungsNr) {
      const drawingLabel = document.createElementNS(svgNS, "text");
      drawingLabel.setAttribute("x", String(margin + 250));
      drawingLabel.setAttribute("y", String(margin + 55));
      drawingLabel.setAttribute("font-family", "Arial, sans-serif");
      drawingLabel.setAttribute("font-size", String(fontSize));
      drawingLabel.setAttribute("fill", "black");
      drawingLabel.textContent = `Zeichnungs-Nr.: ${titleBlockData.zeichnungsNr}`;
      svg.appendChild(drawingLabel);
    }

    // Table header background
    const tableStartY = margin + headerHeight;
    const headerBg = document.createElementNS(svgNS, "rect");
    headerBg.setAttribute("x", String(margin));
    headerBg.setAttribute("y", String(tableStartY));
    headerBg.setAttribute("width", String(availableWidth));
    headerBg.setAttribute("height", String(rowHeight));
    headerBg.setAttribute("fill", "#f0f0f0");
    headerBg.setAttribute("stroke", "black");
    headerBg.setAttribute("stroke-width", "1");
    svg.appendChild(headerBg);

    // Table header cells
    let xPos = margin;
    for (const col of columns) {
      // Header text
      const headerText = document.createElementNS(svgNS, "text");
      headerText.setAttribute("x", String(xPos + 5));
      headerText.setAttribute("y", String(tableStartY + 20));
      headerText.setAttribute("font-family", "Arial, sans-serif");
      headerText.setAttribute("font-size", String(headerFontSize));
      headerText.setAttribute("font-weight", "bold");
      headerText.setAttribute("fill", "black");
      headerText.textContent = col.header;
      svg.appendChild(headerText);

      // Vertical line (except last column)
      if (col !== columns[columns.length - 1]) {
        const vLine = document.createElementNS(svgNS, "line");
        vLine.setAttribute("x1", String(xPos + col.width));
        vLine.setAttribute("y1", String(tableStartY));
        vLine.setAttribute("x2", String(xPos + col.width));
        vLine.setAttribute("y2", String(tableStartY + rowHeight + bomItems.length * rowHeight));
        vLine.setAttribute("stroke", "black");
        vLine.setAttribute("stroke-width", "1");
        svg.appendChild(vLine);
      }

      xPos += col.width;
    }

    // Table rows
    for (let i = 0; i < bomItems.length; i++) {
      const item = bomItems[i];
      const rowY = tableStartY + rowHeight + i * rowHeight;

      // Row background (alternating)
      const rowBg = document.createElementNS(svgNS, "rect");
      rowBg.setAttribute("x", String(margin));
      rowBg.setAttribute("y", String(rowY));
      rowBg.setAttribute("width", String(availableWidth));
      rowBg.setAttribute("height", String(rowHeight));
      rowBg.setAttribute("fill", i % 2 === 0 ? "white" : "#fafafa");
      rowBg.setAttribute("stroke", "black");
      rowBg.setAttribute("stroke-width", "1");
      svg.appendChild(rowBg);

      // Row data
      xPos = margin;
      const values = [
        String(item.position),
        item.name,
        item.description,
        String(item.quantity)
      ];

      for (let j = 0; j < columns.length; j++) {
        const cellText = document.createElementNS(svgNS, "text");
        cellText.setAttribute("x", String(xPos + 5));
        cellText.setAttribute("y", String(rowY + 20));
        cellText.setAttribute("font-family", "Arial, sans-serif");
        cellText.setAttribute("font-size", String(fontSize));
        cellText.setAttribute("fill", "black");
        cellText.textContent = values[j];
        svg.appendChild(cellText);
        xPos += columns[j].width;
      }
    }

    // Bottom border
    const bottomY = tableStartY + rowHeight + bomItems.length * rowHeight;
    const bottomLine = document.createElementNS(svgNS, "line");
    bottomLine.setAttribute("x1", String(margin));
    bottomLine.setAttribute("y1", String(bottomY));
    bottomLine.setAttribute("x2", String(margin + availableWidth));
    bottomLine.setAttribute("y2", String(bottomY));
    bottomLine.setAttribute("stroke", "black");
    bottomLine.setAttribute("stroke-width", "1");
    svg.appendChild(bottomLine);

    // Date at bottom
    const dateText = document.createElementNS(svgNS, "text");
    dateText.setAttribute("x", String(margin));
    dateText.setAttribute("y", String(bottomY + 30));
    dateText.setAttribute("font-family", "Arial, sans-serif");
    dateText.setAttribute("font-size", String(fontSize - 2));
    dateText.setAttribute("fill", "#666");
    dateText.textContent = `Erstellt am: ${new Date().toLocaleDateString('de-DE')}`;
    svg.appendChild(dateText);

    // Total count
    const totalCount = bomItems.reduce((sum, item) => sum + item.quantity, 0);
    const totalText = document.createElementNS(svgNS, "text");
    totalText.setAttribute("x", String(margin + availableWidth - 150));
    totalText.setAttribute("y", String(bottomY + 30));
    totalText.setAttribute("font-family", "Arial, sans-serif");
    totalText.setAttribute("font-size", String(fontSize));
    totalText.setAttribute("font-weight", "bold");
    totalText.setAttribute("fill", "black");
    totalText.textContent = `Gesamt: ${totalCount} Teile`;
    svg.appendChild(totalText);

    // Export as PNG
    const canvas = document.createElement('canvas');
    const scale = 2;
    canvas.width = paperWidthPx * scale;
    canvas.height = paperHeightPx * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);

      const link = document.createElement('a');
      const projektName = titleBlockData.projekt || 'Projekt';
      link.download = `stueckliste-${projektName}-${paperFormat}-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.onerror = (err) => {
      console.error('BOM export failed:', err);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const totalQuantity = bomItems.reduce((sum, item) => sum + item.quantity, 0);
  const uniquePositions = new Set(bomItems.map(item => item.componentId)).size;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between pr-8">
            <span>Stückliste</span>
            <Button onClick={handleExport} size="sm" className="gap-2">
              <Download className="w-4 h-4" />
              Exportieren
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        {titleBlockData.projekt && (
          <div className="text-sm text-muted-foreground mb-2">
            Projekt: <span className="font-medium text-foreground">{titleBlockData.projekt}</span>
            {titleBlockData.zeichnungsNr && (
              <span className="ml-4">Zeichnungs-Nr.: <span className="font-medium text-foreground">{titleBlockData.zeichnungsNr}</span></span>
            )}
          </div>
        )}

        <div className="flex-1 overflow-auto border rounded-md">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-16">Pos.</TableHead>
                <TableHead>Benennung</TableHead>
                <TableHead>Beschreibung</TableHead>
                <TableHead className="w-20 text-right">Menge</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bomItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Keine Komponenten platziert
                  </TableCell>
                </TableRow>
              ) : (
                bomItems.map((item, index) => (
                  <TableRow key={`${item.componentId}-${item.instanceIndex ?? index}`}>
                    <TableCell className="font-medium">{item.position}</TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell className={item.description ? '' : 'text-muted-foreground'}>
                      {item.description || '–'}
                    </TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-between items-center pt-2 border-t">
          <span className="text-sm text-muted-foreground">
            {bomItems.length} Position{bomItems.length !== 1 ? 'en' : ''} ({uniquePositions} Komponenten-Typ{uniquePositions !== 1 ? 'en' : ''})
          </span>
          <span className="font-medium">
            Gesamt: {totalQuantity} Teil{totalQuantity !== 1 ? 'e' : ''}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
