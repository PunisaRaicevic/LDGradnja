import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useFinanceStore } from '@/store/useFinanceStore';
import { useProjectStore } from '@/store/useProjectStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Plus, FileDown, Trash2, Eye, ClipboardList } from 'lucide-react';
import { formatCurrency, formatDate, getToday } from '@/lib/utils';
import { generateSituationPDF } from '@/lib/pdf';
import type { SituationItem } from '@/types';

export default function InterimSituations() {
  const { projectId } = useParams();
  const { situations, loadSituations, addSituation, deleteSituation, billItems, loadBillItems } = useFinanceStore();
  const { projects } = useProjectStore();
  const project = projects.find((p) => p.id === projectId);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewSituationId, setViewSituationId] = useState<string | null>(null);
  const [periodFrom, setPeriodFrom] = useState(getToday());
  const [periodTo, setPeriodTo] = useState(getToday());
  const [itemInputs, setItemInputs] = useState<Record<string, { percent: number; quantity: number }>>({});

  useEffect(() => {
    if (projectId) {
      loadSituations(projectId);
      loadBillItems(projectId);
    }
  }, [projectId, loadSituations, loadBillItems]);

  const openCreate = () => {
    const inputs: Record<string, { percent: number; quantity: number }> = {};
    billItems.forEach((item) => {
      inputs[item.id] = { percent: 0, quantity: 0 };
    });
    setItemInputs(inputs);
    setCreateOpen(true);
  };

  const handlePercentChange = (billItemId: string, percent: number) => {
    const billItem = billItems.find((b) => b.id === billItemId);
    if (!billItem) return;
    const quantity = (percent / 100) * billItem.quantity;
    setItemInputs((prev) => ({ ...prev, [billItemId]: { percent, quantity } }));
  };

  const handleCreate = async () => {
    if (!projectId) return;
    const items: Omit<SituationItem, 'id' | 'situationId'>[] = billItems
      .filter((b) => itemInputs[b.id]?.percent > 0)
      .map((b) => {
        const input = itemInputs[b.id];
        const previousSituations = situations;
        const prevCumPercent = previousSituations.reduce((sum, s) => {
          const prevItem = s.items.find((i) => i.billItemId === b.id);
          return sum + (prevItem?.percentComplete || 0);
        }, 0);
        const prevCumQty = previousSituations.reduce((sum, s) => {
          const prevItem = s.items.find((i) => i.billItemId === b.id);
          return sum + (prevItem?.quantityDone || 0);
        }, 0);
        const prevCumValue = previousSituations.reduce((sum, s) => {
          const prevItem = s.items.find((i) => i.billItemId === b.id);
          return sum + (prevItem?.value || 0);
        }, 0);

        const value = (input.percent / 100) * b.totalPrice;
        return {
          billItemId: b.id,
          percentComplete: input.percent,
          quantityDone: input.quantity,
          value,
          cumulativePercent: prevCumPercent + input.percent,
          cumulativeQuantity: prevCumQty + input.quantity,
          cumulativeValue: prevCumValue + value,
        };
      });

    await addSituation(projectId, { periodFrom, periodTo, items });
    setCreateOpen(false);
  };

  const handleExportPDF = (situationId: string) => {
    const situation = situations.find((s) => s.id === situationId);
    if (!situation || !project) return;
    const doc = generateSituationPDF(situation, billItems, project.name);
    doc.save(`situacija-${situation.number}.pdf`);
  };

  const viewSituation = situations.find((s) => s.id === viewSituationId);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Privremene situacije</h1>
        <Button onClick={openCreate} disabled={billItems.length === 0}>
          <Plus className="h-4 w-4 mr-2" />
          Nova situacija
        </Button>
      </div>

      {billItems.length === 0 && (
        <Card className="mb-4">
          <CardContent className="py-4">
            <p className="text-sm text-warning">Prvo dodajte stavke u predmjer radova.</p>
          </CardContent>
        </Card>
      )}

      {situations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardList className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Nema kreiranih situacija</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {situations.map((situation) => (
            <Card key={situation.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Situacija br. {situation.number}</CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setViewSituationId(situation.id)}>
                      <Eye className="h-4 w-4 mr-1" /> Pregled
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleExportPDF(situation.id)}>
                      <FileDown className="h-4 w-4 mr-1" /> PDF
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteSituation(situation.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Datum:</span>
                    <p className="font-medium">{formatDate(situation.date)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Period:</span>
                    <p className="font-medium">{formatDate(situation.periodFrom)} - {formatDate(situation.periodTo)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Vrijednost:</span>
                    <p className="font-medium">{formatCurrency(situation.totalValue)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Kumulativ:</span>
                    <p className="font-medium">{formatCurrency(situation.cumulativeValue)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Situation Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent onClose={() => setCreateOpen(false)} className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Nova privremena situacija #{situations.length + 1}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Period od</Label>
                <Input type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} />
              </div>
              <div>
                <Label>Period do</Label>
                <Input type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} />
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>R.br</TableHead>
                    <TableHead>Opis</TableHead>
                    <TableHead>Jed.</TableHead>
                    <TableHead className="text-right">Ukup. kol.</TableHead>
                    <TableHead className="w-24 text-right">% izvrseno</TableHead>
                    <TableHead className="text-right">Kolicina</TableHead>
                    <TableHead className="text-right">Vrijednost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {billItems.map((item) => {
                    const input = itemInputs[item.id] || { percent: 0, quantity: 0 };
                    const value = (input.percent / 100) * item.totalPrice;
                    return (
                      <TableRow key={item.id}>
                        <TableCell>{item.ordinal}</TableCell>
                        <TableCell className="max-w-48 truncate">{item.description}</TableCell>
                        <TableCell>{item.unit}</TableCell>
                        <TableCell className="text-right">{item.quantity.toFixed(2)}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={input.percent}
                            onChange={(e) => handlePercentChange(item.id, parseFloat(e.target.value) || 0)}
                            className="w-20 text-right"
                          />
                        </TableCell>
                        <TableCell className="text-right">{input.quantity.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(value)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Otkazi</Button>
            <Button onClick={handleCreate}>Kreiraj situaciju</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Situation Dialog */}
      <Dialog open={!!viewSituationId} onOpenChange={() => setViewSituationId(null)}>
        <DialogContent onClose={() => setViewSituationId(null)} className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Situacija br. {viewSituation?.number}</DialogTitle>
          </DialogHeader>
          {viewSituation && (
            <div className="max-h-[60vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>R.br</TableHead>
                    <TableHead>Opis</TableHead>
                    <TableHead className="text-right">%</TableHead>
                    <TableHead className="text-right">Kolicina</TableHead>
                    <TableHead className="text-right">Vrijednost</TableHead>
                    <TableHead className="text-right">Kum. %</TableHead>
                    <TableHead className="text-right">Kum. vrij.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {viewSituation.items.map((item) => {
                    const billItem = billItems.find((b) => b.id === item.billItemId);
                    return (
                      <TableRow key={item.id}>
                        <TableCell>{billItem?.ordinal}</TableCell>
                        <TableCell>{billItem?.description}</TableCell>
                        <TableCell className="text-right">{item.percentComplete.toFixed(1)}%</TableCell>
                        <TableCell className="text-right">{item.quantityDone.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.value)}</TableCell>
                        <TableCell className="text-right">{item.cumulativePercent.toFixed(1)}%</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.cumulativeValue)}</TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="font-bold bg-muted/50">
                    <TableCell colSpan={4} className="text-right">UKUPNO:</TableCell>
                    <TableCell className="text-right">{formatCurrency(viewSituation.totalValue)}</TableCell>
                    <TableCell />
                    <TableCell className="text-right">{formatCurrency(viewSituation.cumulativeValue)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
