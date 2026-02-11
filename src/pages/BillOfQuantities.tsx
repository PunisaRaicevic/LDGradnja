import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useFinanceStore } from '@/store/useFinanceStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import {
  Plus, Trash2, Upload, Download, FileSpreadsheet, Pencil,
  Bot, CheckCircle, XCircle, AlertTriangle, FileText, Loader2,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { analyzeExcelFile, convertAnalysisToBillItems, exportToExcel } from '@/lib/excel';
import type { ExcelAnalysis } from '@/lib/excel';
import { UNITS } from '@/types';
import type { BillItem } from '@/types';
import PredmjerValidator from '@/components/shared/PredmjerValidator';

const emptyItem = {
  ordinal: 0,
  description: '',
  unit: 'm',
  quantity: 0,
  unitPrice: 0,
};

const rowTypeIcons: Record<string, React.ReactNode> = {
  data: <CheckCircle className="h-4 w-4 text-green-600" />,
  header: <FileText className="h-4 w-4 text-blue-500" />,
  title: <FileText className="h-4 w-4 text-blue-500" />,
  section: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  footer: <XCircle className="h-4 w-4 text-red-400" />,
  empty: <XCircle className="h-4 w-4 text-gray-300" />,
};

const rowTypeLabels: Record<string, string> = {
  data: 'Stavka',
  header: 'Zaglavlje',
  title: 'Naslov',
  section: 'Sekcija',
  footer: 'Footer',
  empty: 'Prazan',
};

const rowTypeBadgeVariant: Record<string, 'success' | 'default' | 'warning' | 'destructive' | 'secondary'> = {
  data: 'success',
  header: 'default',
  title: 'default',
  section: 'warning',
  footer: 'destructive',
  empty: 'secondary',
};

export default function BillOfQuantities() {
  const { projectId } = useParams();
  const { billItems, loadBillItems, addBillItem, updateBillItem, deleteBillItem, setBillItems, clearBillItems } = useFinanceStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyItem);

  // Analysis state
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<ExcelAnalysis | null>(null);
  const [showSkipped, setShowSkipped] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    if (projectId) loadBillItems(projectId);
  }, [projectId, loadBillItems]);

  const totalSum = billItems.reduce((sum, item) => sum + item.totalPrice, 0);

  const openNew = () => {
    setEditingId(null);
    setForm({ ...emptyItem, ordinal: billItems.length + 1 });
    setDialogOpen(true);
  };

  const openEdit = (item: BillItem) => {
    setEditingId(item.id);
    setForm({
      ordinal: item.ordinal,
      description: item.description,
      unit: item.unit,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!projectId || !form.description) return;
    const totalPrice = form.quantity * form.unitPrice;
    if (editingId) {
      await updateBillItem(editingId, { ...form, totalPrice });
    } else {
      await addBillItem({ ...form, projectId, totalPrice });
    }
    setDialogOpen(false);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setAnalyzing(true);
    setAnalysisOpen(true);
    setShowSkipped(false);

    try {
      const result = await analyzeExcelFile(file);
      setAnalysis(result);
    } catch {
      alert('Greška pri čitanju fajla.');
      setAnalysisOpen(false);
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleRowInclusion = (rowIndex: number) => {
    if (!analysis) return;
    const updated = { ...analysis };
    updated.rows = updated.rows.map((r) =>
      r.rowIndex === rowIndex ? { ...r, included: !r.included } : r
    );
    updated.dataRows = updated.rows.filter((r) => r.included).length;
    setAnalysis(updated);
  };

  const handleConfirmImport = async () => {
    if (!analysis || !projectId) return;
    const items = convertAnalysisToBillItems(analysis, projectId);
    if (items.length === 0) {
      alert('Nema stavki za import.');
      return;
    }
    await setBillItems(items);
    setAnalysisOpen(false);
    setAnalysis(null);
  };

  const handleExport = () => {
    const data = billItems.map((item) => ({
      'R.br': item.ordinal,
      'Opis': item.description,
      'Jed.': item.unit,
      'Količina': item.quantity,
      'Jed. cijena': item.unitPrice,
      'Ukupno': item.totalPrice,
    }));
    exportToExcel(data, 'predmjer-radova');
  };

  // Analysis stats
  const includedRows = analysis?.rows.filter((r) => r.included) || [];
  const skippedRows = analysis?.rows.filter((r) => !r.included && r.type !== 'empty') || [];
  const includedTotal = includedRows.reduce((sum, r) => sum + (r.parsed?.totalPrice || 0), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Predmjer radova</h1>
        <div className="flex gap-2">
          <input id="excel-import" type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileSelect} />
          <Button variant="outline" onClick={() => document.getElementById('excel-import')?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            Import Excel
          </Button>
          <Button variant="outline" onClick={handleExport} disabled={billItems.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <PredmjerValidator
            items={billItems}
            onApplyFixes={async (fixes) => {
              for (const fix of fixes) {
                await updateBillItem(fix.id, fix.data);
              }
            }}
          />
          {billItems.length > 0 && (
            <Button variant="destructive" onClick={() => setDeleteConfirmOpen(true)}>
              <Trash2 className="h-4 w-4 mr-2" />
              Obriši predmjer
            </Button>
          )}
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" />
            Nova stavka
          </Button>
        </div>
      </div>

      {billItems.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Nema stavki u predmjeru</p>
            <p className="text-sm text-muted-foreground mt-1">Dodajte stavke ručno ili importujte iz Excel fajla</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">R.br</TableHead>
                <TableHead>Opis rada</TableHead>
                <TableHead className="w-20">Jed.</TableHead>
                <TableHead className="w-24 text-right">Količina</TableHead>
                <TableHead className="w-32 text-right">Jed. cijena</TableHead>
                <TableHead className="w-32 text-right">Ukupno</TableHead>
                <TableHead className="w-24 text-right">Akcije</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {billItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.ordinal}</TableCell>
                  <TableCell>{item.description}</TableCell>
                  <TableCell>{item.unit}</TableCell>
                  <TableCell className="text-right">{item.quantity.toFixed(2)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(item.totalPrice)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteBillItem(item.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 font-bold">
                <TableCell colSpan={5} className="text-right">UKUPNO:</TableCell>
                <TableCell className="text-right">{formatCurrency(totalSum)}</TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Add/Edit Item Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent onClose={() => setDialogOpen(false)}>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Uredi stavku' : 'Nova stavka'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label>R.br</Label>
                <Input type="number" value={form.ordinal} onChange={(e) => setForm({ ...form, ordinal: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="col-span-3">
                <Label>Opis rada *</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Jedinica mjere</Label>
                <Select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </Select>
              </div>
              <div>
                <Label>Količina</Label>
                <Input type="number" step="0.01" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Jedinična cijena</Label>
                <Input type="number" step="0.01" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="text-right text-lg font-semibold">
              Ukupno: {formatCurrency(form.quantity * form.unitPrice)}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Otkaži</Button>
            <Button onClick={handleSave}>{editingId ? 'Sačuvaj' : 'Dodaj'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Analysis Preview Dialog */}
      <Dialog open={analysisOpen} onOpenChange={(open) => { if (!open) { setAnalysisOpen(false); setAnalysis(null); } }}>
        <DialogContent
          onClose={() => { setAnalysisOpen(false); setAnalysis(null); }}
          className="max-w-5xl max-h-[90vh] flex flex-col"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              Analiza predmjera
            </DialogTitle>
          </DialogHeader>

          {analyzing ? (
            <div className="py-16 text-center">
              <Loader2 className="h-10 w-10 mx-auto mb-4 text-primary animate-spin" />
              <p className="text-lg font-medium">Analiziram Excel fajl...</p>
              <p className="text-sm text-muted-foreground mt-1">
                Detektujem naslove, sekcije, footer i stavke predmjera
              </p>
            </div>
          ) : analysis ? (
            <>
              {/* Summary */}
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <Bot className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Rezultat analize: {analysis.fileName}</p>
                    <p className="text-sm text-muted-foreground mt-1">{analysis.summary}</p>
                  </div>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="border rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-600">{includedRows.length}</p>
                  <p className="text-xs text-muted-foreground">Stavki za import</p>
                </div>
                <div className="border rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-amber-500">{skippedRows.length}</p>
                  <p className="text-xs text-muted-foreground">Preskočenih redova</p>
                </div>
                <div className="border rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold">{analysis.totalRows}</p>
                  <p className="text-xs text-muted-foreground">Ukupno redova</p>
                </div>
                <div className="border rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-primary">{formatCurrency(includedTotal)}</p>
                  <p className="text-xs text-muted-foreground">Ukupna vrijednost</p>
                </div>
              </div>

              {/* Toggle skipped rows view */}
              <div className="flex items-center gap-2 mb-2">
                <Button
                  variant={showSkipped ? 'outline' : 'default'}
                  size="sm"
                  onClick={() => setShowSkipped(false)}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Stavke za import ({includedRows.length})
                </Button>
                <Button
                  variant={showSkipped ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setShowSkipped(true)}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Preskočeni redovi ({skippedRows.length})
                </Button>
              </div>

              {/* Rows Table */}
              <div className="overflow-y-auto max-h-[40vh] border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead className="w-20">Tip</TableHead>
                      <TableHead className="w-12">Red</TableHead>
                      {!showSkipped ? (
                        <>
                          <TableHead className="w-12">R.br</TableHead>
                          <TableHead>Opis</TableHead>
                          <TableHead className="w-16">Jed.</TableHead>
                          <TableHead className="w-20 text-right">Kol.</TableHead>
                          <TableHead className="w-24 text-right">Cijena</TableHead>
                          <TableHead className="w-24 text-right">Ukupno</TableHead>
                          <TableHead className="w-20">Akcija</TableHead>
                        </>
                      ) : (
                        <>
                          <TableHead>Razlog preskakanja</TableHead>
                          <TableHead>Sadržaj reda</TableHead>
                          <TableHead className="w-20">Akcija</TableHead>
                        </>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(showSkipped ? skippedRows : includedRows).map((row) => (
                      <TableRow
                        key={row.rowIndex}
                        className={row.included ? 'bg-green-50/50' : ''}
                      >
                        <TableCell>{rowTypeIcons[row.type]}</TableCell>
                        <TableCell>
                          <Badge variant={rowTypeBadgeVariant[row.type]} className="text-xs">
                            {rowTypeLabels[row.type]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">{row.rowIndex + 1}</TableCell>
                        {!showSkipped && row.parsed ? (
                          <>
                            <TableCell>{row.parsed.ordinal}</TableCell>
                            <TableCell className="max-w-64 truncate text-sm">{row.parsed.description}</TableCell>
                            <TableCell>{row.parsed.unit}</TableCell>
                            <TableCell className="text-right">{row.parsed.quantity.toFixed(2)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(row.parsed.unitPrice)}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(row.parsed.totalPrice)}</TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs text-red-500"
                                onClick={() => toggleRowInclusion(row.rowIndex)}
                              >
                                Isključi
                              </Button>
                            </TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell className="text-sm text-muted-foreground">{row.reason}</TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-64 truncate">
                              {row.rawCells.filter(Boolean).join(' | ')}
                            </TableCell>
                            <TableCell>
                              {row.type !== 'empty' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs text-green-600"
                                  onClick={() => toggleRowInclusion(row.rowIndex)}
                                >
                                  Uključi
                                </Button>
                              )}
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : null}

          {analysis && !analyzing && (
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => { setAnalysisOpen(false); setAnalysis(null); }}>
                Otkaži
              </Button>
              <Button onClick={handleConfirmImport} disabled={includedRows.length === 0}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Importuj {includedRows.length} stavki
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent onClose={() => setDeleteConfirmOpen(false)} className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Obriši predmjer?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Da li ste sigurni da želite obrisati <strong>sve stavke ({billItems.length})</strong> iz predmjera radova?
            Ova akcija je nepovratna.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>Otkaži</Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (projectId) {
                  await clearBillItems(projectId);
                  setDeleteConfirmOpen(false);
                }
              }}
            >
              Da, obriši sve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
