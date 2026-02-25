import { useState } from 'react';
import type { BillItem } from '@/types';
import type { ParsedSheetData, ParsedLogRow } from '@/types/construction-log';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Check, X, Link, ChevronDown, ChevronRight } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface LogSheetPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parsedData: ParsedSheetData;
  billItems: BillItem[];
  onConfirm: (confirmedRows: { sheetName: string; row: ParsedLogRow }[]) => void;
}

export default function LogSheetPreview({
  open,
  onOpenChange,
  parsedData,
  billItems,
  onConfirm,
}: LogSheetPreviewProps) {
  // Local state for editing rows
  const [sheets, setSheets] = useState(() =>
    parsedData.sheets.map((s) => ({
      sheetName: s.sheetName,
      expanded: true,
      rows: s.rows.map((r) => ({ ...r })),
    }))
  );

  const updateRow = (sheetIdx: number, rowIdx: number, updates: Partial<ParsedLogRow>) => {
    setSheets((prev) =>
      prev.map((s, si) =>
        si === sheetIdx
          ? {
              ...s,
              rows: s.rows.map((r, ri) =>
                ri === rowIdx ? { ...r, ...updates } : r
              ),
            }
          : s
      )
    );
  };

  const toggleSheet = (sheetIdx: number) => {
    setSheets((prev) =>
      prev.map((s, si) =>
        si === sheetIdx ? { ...s, expanded: !s.expanded } : s
      )
    );
  };

  const handleConfirmAll = () => {
    const confirmed: { sheetName: string; row: ParsedLogRow }[] = [];
    for (const sheet of sheets) {
      for (const row of sheet.rows) {
        if (row.userAction !== 'skip') {
          confirmed.push({ sheetName: sheet.sheetName, row });
        }
      }
    }
    onConfirm(confirmed);
  };

  const totalRows = sheets.reduce((sum, s) => sum + s.rows.length, 0);
  const confirmedRows = sheets.reduce(
    (sum, s) => sum + s.rows.filter((r) => r.userAction !== 'skip').length,
    0
  );
  const skippedRows = totalRows - confirmedRows;

  const getConfidenceBadge = (row: ParsedLogRow) => {
    if (row.userAction === 'skip') {
      return <Badge variant="secondary">Preskočeno</Badge>;
    }
    if (row.matchedBillItemId) {
      const item = billItems.find((b) => b.id === row.matchedBillItemId);
      if (row.matchConfidence === 'high') {
        return (
          <Badge variant="success" className="bg-green-600">
            Poz. {item?.ordinal}
          </Badge>
        );
      }
      if (row.matchConfidence === 'medium') {
        return (
          <Badge variant="warning" className="bg-orange-500">
            Moguće: Poz. {item?.ordinal}
          </Badge>
        );
      }
    }
    return <Badge variant="destructive">Nije pronađeno</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Korak 3: Provjerite pročitane podatke</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Sistem je pročitao <strong>{totalRows} pozicija</strong> iz {sheets.length} {sheets.length === 1 ? 'sheet-a' : 'sheet-ova'}.
            Provjerite da li su podaci ispravni i da li su pozicije pravilno povezane sa predmjerom.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Za svaku poziciju možete: potvrditi automatski match, ručno povezati sa predmjerom, ili preskočiti.
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {sheets.map((sheet, sheetIdx) => (
            <div key={sheetIdx} className="border rounded-lg">
              <button
                onClick={() => toggleSheet(sheetIdx)}
                className="w-full flex items-center gap-2 p-3 text-left font-medium hover:bg-muted/50"
              >
                {sheet.expanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <span>{sheet.sheetName}</span>
                <Badge variant="outline" className="ml-auto">
                  {sheet.rows.length} pozicija
                </Badge>
              </button>

              {sheet.expanded && (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24">Pozicija</TableHead>
                        <TableHead>Opis</TableHead>
                        <TableHead className="w-16">Jed.</TableHead>
                        <TableHead className="w-24 text-right">Cijena</TableHead>
                        <TableHead className="w-24 text-right">Količina</TableHead>
                        <TableHead className="w-40">Match</TableHead>
                        <TableHead className="w-44">Akcija</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sheet.rows.map((row, rowIdx) => (
                        <TableRow
                          key={rowIdx}
                          className={
                            row.userAction === 'skip' ? 'opacity-40' : ''
                          }
                        >
                          <TableCell className="font-mono text-sm">
                            {row.detectedPosition}
                          </TableCell>
                          <TableCell className="max-w-xs truncate text-sm">
                            {row.description}
                          </TableCell>
                          <TableCell className="text-sm">{row.unit}</TableCell>
                          <TableCell className="text-right text-sm">
                            {formatCurrency(row.unitPrice)}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {row.quantity}
                          </TableCell>
                          <TableCell>{getConfidenceBadge(row)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {row.userAction !== 'skip' ? (
                                <>
                                  <Button
                                    size="sm"
                                    variant={row.userAction === 'confirm' && row.matchedBillItemId ? 'default' : 'outline'}
                                    className="h-7 px-2"
                                    onClick={() =>
                                      updateRow(sheetIdx, rowIdx, { userAction: 'confirm' })
                                    }
                                    title="Potvrdi"
                                  >
                                    <Check className="h-3 w-3" />
                                  </Button>
                                  <Select
                                    className="h-7 text-xs w-24"
                                    value={row.matchedBillItemId || ''}
                                    onChange={(e) => {
                                      const billItemId = e.target.value || null;
                                      updateRow(sheetIdx, rowIdx, {
                                        matchedBillItemId: billItemId,
                                        matchConfidence: billItemId ? 'high' : 'none',
                                        userAction: billItemId ? 'link' : 'pending',
                                      });
                                    }}
                                  >
                                    <option value="">Poveži...</option>
                                    {billItems.map((item) => (
                                      <option key={item.id} value={item.id}>
                                        {item.ordinal}. {item.description.slice(0, 30)}
                                      </option>
                                    ))}
                                  </Select>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2"
                                    onClick={() =>
                                      updateRow(sheetIdx, rowIdx, { userAction: 'skip' })
                                    }
                                    title="Preskoči"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2"
                                  onClick={() =>
                                    updateRow(sheetIdx, rowIdx, { userAction: 'pending' })
                                  }
                                >
                                  Vrati
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          ))}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="text-sm text-muted-foreground">
            {confirmedRows} {confirmedRows === 1 ? 'pozicija' : 'pozicija'} za čuvanje
            {skippedRows > 0 && `, ${skippedRows} preskočeno`}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Otkaži
            </Button>
            <Button onClick={handleConfirmAll} disabled={confirmedRows === 0}>
              Sačuvaj i validiraj ({confirmedRows})
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
