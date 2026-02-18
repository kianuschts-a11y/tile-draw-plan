import { useMemo } from "react";
import { Component, TitleBlockData } from "@/types/schematic";
import { isConnectionBlock } from "@/lib/connectionBlocks";
import { PlacedTile } from "./Canvas";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileSpreadsheet } from "lucide-react";
import * as XLSX from 'xlsx';

interface MesskonzeptItem {
  label: string;
  color: string;
  tileId: string;
  componentId: string;
  name: string;
  kategorie: string;
  marke: string;
  modell: string;
  gridX: number;
  gridY: number;
}

interface MesskonzeptProps {
  open: boolean;
  onClose: () => void;
  tiles: PlacedTile[];
  tileLabels: Map<string, { label: string; color: string }>;
  titleBlockData: TitleBlockData;
  components: Component[];
  projectKategorien: Map<string, string>;
  projectMarken: Map<string, string>;
  projectModelle: Map<string, string>;
  excludedCategories?: string[];
}

export function Messkonzept({
  open,
  onClose,
  tiles,
  tileLabels,
  titleBlockData,
  components,
  projectKategorien,
  projectMarken,
  projectModelle,
  excludedCategories = [],
}: MesskonzeptProps) {
  // Build list of all labeled tiles
  const items: MesskonzeptItem[] = useMemo(() => {
    const result: MesskonzeptItem[] = [];

    for (const tile of tiles) {
      if (isConnectionBlock(tile.component)) continue;
      const labelData = tileLabels.get(tile.id);
      if (!labelData) continue;

      const componentDef = components.find(c => c.id === tile.component.id);
      const kategorie = tile.component.category || projectKategorien.get(tile.component.id) || '';
      
      // Apply category filter
      if (excludedCategories.length > 0) {
        const catName = kategorie || '__uncategorized__';
        if (excludedCategories.includes(catName)) continue;
      }
      
      const marke = projectMarken.get(tile.component.id) || '';
      const modell = projectModelle.get(tile.component.id) || '';

      result.push({
        label: labelData.label,
        color: labelData.color,
        tileId: tile.id,
        componentId: tile.component.id,
        name: tile.component.name,
        kategorie,
        marke,
        modell,
        gridX: tile.gridX,
        gridY: tile.gridY,
      });
    }

    // Sort by label (natural sort: 1.1, 1.2, 2.1, ...)
    result.sort((a, b) => {
      const [aPri, aIdx] = a.label.split('.').map(Number);
      const [bPri, bIdx] = b.label.split('.').map(Number);
      if (aPri !== bPri) return aPri - bPri;
      return aIdx - bIdx;
    });

    return result;
  }, [tiles, tileLabels, components, projectKategorien, projectMarken, projectModelle, excludedCategories]);

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const wsData: (string | number)[][] = [];

    wsData.push(['MESSKONZEPT', '', '', '', '']);
    wsData.push(['', '', '', '', '']);

    if (titleBlockData.projekt) {
      wsData.push(['Projekt:', titleBlockData.projekt, '', '', '']);
    }
    if (titleBlockData.zeichnungsNr) {
      wsData.push(['Zeichnungs-Nr.:', titleBlockData.zeichnungsNr, '', '', '']);
    }
    wsData.push(['Erstellt am:', new Date().toLocaleDateString('de-DE'), '', '', '']);
    wsData.push(['', '', '', '', '']);

    // Header
    wsData.push(['Nr.', 'Komponente', 'Kategorie', 'Marke', 'Modell']);

    // Data
    for (const item of items) {
      wsData.push([item.label, item.name, item.kategorie || '', item.marke || '', item.modell || '']);
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [
      { wch: 8 },
      { wch: 25 },
      { wch: 18 },
      { wch: 18 },
      { wch: 22 },
    ];
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];

    XLSX.utils.book_append_sheet(wb, ws, 'Messkonzept');
    const projektName = titleBlockData.projekt || 'Projekt';
    const fileName = `messkonzept-${projektName}-${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between pr-8">
            <span>Messkonzept</span>
            <Button onClick={handleExportExcel} size="sm" className="gap-2">
              <FileSpreadsheet className="w-4 h-4" />
              Als Excel exportieren
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
                <TableHead className="w-16">Nr.</TableHead>
                <TableHead>Komponente</TableHead>
                <TableHead className="w-32">Kategorie</TableHead>
                <TableHead className="w-28">Marke</TableHead>
                <TableHead className="w-32">Modell</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Keine beschrifteten Komponenten vorhanden.
                    <br />
                    <span className="text-xs">Aktiviere die Beschriftung im Komponenten-Editor und generiere Labels über die Toolbar.</span>
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.tileId}>
                    <TableCell className="font-bold" style={{ color: item.color }}>
                      {item.label}
                    </TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell className={item.kategorie ? '' : 'text-muted-foreground'}>
                      {item.kategorie || '–'}
                    </TableCell>
                    <TableCell className={item.marke ? '' : 'text-muted-foreground'}>
                      {item.marke || '–'}
                    </TableCell>
                    <TableCell className={item.modell ? '' : 'text-muted-foreground'}>
                      {item.modell || '–'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-between items-center pt-2 border-t">
          <span className="text-sm text-muted-foreground">
            {items.length} Messpunkt{items.length !== 1 ? 'e' : ''}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
