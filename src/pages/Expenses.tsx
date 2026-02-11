import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useExpenseStore } from '@/store/useExpenseStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import {
  Plus, Search, Trash2, Receipt, Eye, Bot, Loader2,
  CheckCircle, Camera, Settings, Sparkles, AlertCircle,
} from 'lucide-react';
import { formatCurrency, formatDate, getToday } from '@/lib/utils';
import { extractExpenseFromImage } from '@/lib/ai-extract';
import type { ExtractedExpense } from '@/lib/ai-extract';
import { EXPENSE_CATEGORIES } from '@/types';
import type { Expense, ExpenseCategory } from '@/types';

const emptyForm = {
  date: getToday(),
  supplier: '',
  description: '',
  quantity: 1,
  price: 0,
  totalAmount: 0,
  category: 'materijal' as ExpenseCategory,
};

export default function Expenses() {
  const { projectId } = useParams();
  const { expenses, loadExpenses, addExpense, deleteExpense } = useExpenseStore();
  const { openaiApiKey, setOpenaiApiKey, loadSettings } = useSettingsStore();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [receiptFile, setReceiptFile] = useState<File | undefined>();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // AI states
  const [aiScanOpen, setAiScanOpen] = useState(false);
  const [aiScanning, setAiScanning] = useState(false);
  const [aiResult, setAiResult] = useState<ExtractedExpense | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [aiPreviewUrl, setAiPreviewUrl] = useState<string | null>(null);

  // Settings
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');

  useEffect(() => {
    if (projectId) loadExpenses(projectId);
    loadSettings();
  }, [projectId, loadExpenses, loadSettings]);

  const filtered = expenses.filter((e) => {
    const matchSearch =
      e.supplier.toLowerCase().includes(search.toLowerCase()) ||
      e.description.toLowerCase().includes(search.toLowerCase());
    const matchCategory = !categoryFilter || e.category === categoryFilter;
    return matchSearch && matchCategory;
  });

  const totalExpenses = filtered.reduce((sum, e) => sum + e.totalAmount, 0);

  const categoryTotals = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.totalAmount;
    return acc;
  }, {} as Record<string, number>);

  const handleSave = async () => {
    if (!projectId || !form.description) return;
    const totalAmount = form.quantity * form.price;
    await addExpense({ ...form, projectId, totalAmount }, receiptFile);
    setDialogOpen(false);
    setForm(emptyForm);
    setReceiptFile(undefined);
  };

  const handleReceiptPreview = (expense: Expense) => {
    if (expense.receiptFileData) {
      const url = URL.createObjectURL(expense.receiptFileData);
      setPreviewUrl(url);
    }
  };

  // AI Scan handlers
  const handleAiFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAiFile(file);
    setAiResult(null);
    setAiError(null);
    if (aiPreviewUrl) URL.revokeObjectURL(aiPreviewUrl);
    setAiPreviewUrl(URL.createObjectURL(file));
  };

  const handleAiScan = async () => {
    if (!aiFile || !openaiApiKey) return;
    setAiScanning(true);
    setAiError(null);
    setAiResult(null);

    try {
      const result = await extractExpenseFromImage(aiFile, openaiApiKey);
      setAiResult(result);
    } catch (err: any) {
      setAiError(err.message || 'Greška pri AI analizi.');
    } finally {
      setAiScanning(false);
    }
  };

  const handleAiAccept = () => {
    if (!aiResult) return;
    setForm({
      date: aiResult.date || getToday(),
      supplier: aiResult.supplier,
      description: aiResult.description,
      quantity: 1,
      price: aiResult.totalAmount,
      totalAmount: aiResult.totalAmount,
      category: (aiResult.category as ExpenseCategory) || 'ostalo',
    });
    setReceiptFile(aiFile || undefined);
    setAiScanOpen(false);
    setDialogOpen(true);

    // Cleanup
    setAiResult(null);
    setAiFile(null);
    if (aiPreviewUrl) URL.revokeObjectURL(aiPreviewUrl);
    setAiPreviewUrl(null);
  };

  const openAiScan = () => {
    if (!openaiApiKey) {
      setSettingsOpen(true);
      return;
    }
    setAiFile(null);
    setAiResult(null);
    setAiError(null);
    if (aiPreviewUrl) URL.revokeObjectURL(aiPreviewUrl);
    setAiPreviewUrl(null);
    setAiScanOpen(true);
  };

  const handleSaveApiKey = () => {
    setOpenaiApiKey(tempApiKey);
    setSettingsOpen(false);
    if (tempApiKey) {
      setAiScanOpen(true);
    }
  };

  const confidenceColor = (c: number) =>
    c >= 0.8 ? 'text-green-600' : c >= 0.5 ? 'text-amber-500' : 'text-red-500';
  const confidenceLabel = (c: number) =>
    c >= 0.8 ? 'Visoka' : c >= 0.5 ? 'Srednja' : 'Niska';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Troškovnik i računi</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => { setTempApiKey(openaiApiKey); setSettingsOpen(true); }}>
            <Settings className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={openAiScan}>
            <Sparkles className="h-4 w-4 mr-2" />
            AI Skeniranje
          </Button>
          <Button onClick={() => { setForm(emptyForm); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Ručni unos
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Ukupni troškovi</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(totalExpenses)}</p>
          </CardContent>
        </Card>
        {EXPENSE_CATEGORIES.slice(0, 3).map((cat) => (
          <Card key={cat.value}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">{cat.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(categoryTotals[cat.value] || 0)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pretraži po dobavljaču ili opisu..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-48">
          <option value="">Sve kategorije</option>
          {EXPENSE_CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>{cat.label}</option>
          ))}
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Receipt className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Nema evidentiranih troškova</p>
            <p className="text-sm text-muted-foreground mt-2">
              Koristite <strong>AI Skeniranje</strong> da automatski pročitate račun ili dodajte ručno
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum</TableHead>
                <TableHead>Dobavljač</TableHead>
                <TableHead>Opis</TableHead>
                <TableHead>Kategorija</TableHead>
                <TableHead className="text-right">Kol.</TableHead>
                <TableHead className="text-right">Cijena</TableHead>
                <TableHead className="text-right">Ukupno</TableHead>
                <TableHead className="text-right">Akcije</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell>{formatDate(expense.date)}</TableCell>
                  <TableCell>{expense.supplier}</TableCell>
                  <TableCell className="max-w-48 truncate">{expense.description}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {EXPENSE_CATEGORIES.find((c) => c.value === expense.category)?.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{expense.quantity}</TableCell>
                  <TableCell className="text-right">{formatCurrency(expense.price)}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(expense.totalAmount)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {expense.receiptFileData && (
                        <Button variant="ghost" size="icon" onClick={() => handleReceiptPreview(expense)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => deleteExpense(expense.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 font-bold">
                <TableCell colSpan={6} className="text-right">UKUPNO:</TableCell>
                <TableCell className="text-right">{formatCurrency(totalExpenses)}</TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Manual Add Expense Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent onClose={() => setDialogOpen(false)} className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novi trošak</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Datum</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div>
                <Label>Kategorija</Label>
                <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ExpenseCategory })}>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </Select>
              </div>
            </div>
            <div>
              <Label>Dobavljač</Label>
              <Input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
            </div>
            <div>
              <Label>Opis stavke *</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Količina</Label>
                <Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Cijena</Label>
                <Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Ukupno</Label>
                <Input value={formatCurrency(form.quantity * form.price)} readOnly className="bg-muted" />
              </div>
            </div>
            <div>
              <Label>Račun (slika/sken)</Label>
              <Input type="file" accept="image/*,.pdf" onChange={(e) => setReceiptFile(e.target.files?.[0])} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Otkaži</Button>
            <Button onClick={handleSave}>Dodaj</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Scan Dialog */}
      <Dialog open={aiScanOpen} onOpenChange={(open) => {
        if (!open) {
          setAiScanOpen(false);
          if (aiPreviewUrl) URL.revokeObjectURL(aiPreviewUrl);
          setAiPreviewUrl(null);
          setAiResult(null);
          setAiFile(null);
          setAiError(null);
        }
      }}>
        <DialogContent
          onClose={() => setAiScanOpen(false)}
          className="max-w-3xl max-h-[90vh] flex flex-col"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              AI Skeniranje računa
            </DialogTitle>
          </DialogHeader>

          <div className="flex gap-6 flex-1 min-h-0">
            {/* Left: Image upload/preview */}
            <div className="w-1/2 flex flex-col">
              {!aiFile ? (
                <label className="flex-1 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors p-6">
                  <Camera className="h-12 w-12 text-muted-foreground mb-3" />
                  <p className="text-sm font-medium">Fotografišite ili odaberite račun</p>
                  <p className="text-xs text-muted-foreground mt-1">JPG, PNG ili PDF</p>
                  <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleAiFileSelect} />
                </label>
              ) : (
                <div className="flex-1 flex flex-col">
                  <div className="flex-1 border rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                    {aiPreviewUrl && (
                      <img src={aiPreviewUrl} alt="Račun" className="max-h-[50vh] object-contain" />
                    )}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <div className="flex-1">
                      <Button variant="outline" size="sm" className="w-full" onClick={() => document.getElementById('ai-change-file')?.click()}>
                        Promijeni sliku
                      </Button>
                      <input id="ai-change-file" type="file" accept="image/*,.pdf" className="hidden" onChange={handleAiFileSelect} />
                    </div>
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={handleAiScan}
                      disabled={aiScanning}
                    >
                      {aiScanning ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analiziram...</>
                      ) : (
                        <><Sparkles className="h-4 w-4 mr-2" />Skeniraj sa AI</>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Results */}
            <div className="w-1/2 flex flex-col">
              {aiScanning && (
                <div className="flex-1 flex flex-col items-center justify-center">
                  <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
                  <p className="font-medium">OpenAI Vision analizira račun...</p>
                  <p className="text-sm text-muted-foreground mt-1">Čitam tekst, iznose i datume</p>
                </div>
              )}

              {aiError && (
                <div className="flex-1 flex flex-col items-center justify-center">
                  <AlertCircle className="h-10 w-10 text-destructive mb-4" />
                  <p className="font-medium text-destructive">Greška</p>
                  <p className="text-sm text-muted-foreground mt-1 text-center">{aiError}</p>
                  <Button variant="outline" size="sm" className="mt-4" onClick={handleAiScan}>
                    Pokušaj ponovo
                  </Button>
                </div>
              )}

              {aiResult && (
                <div className="flex-1 overflow-y-auto space-y-3">
                  {/* Confidence */}
                  <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className={`h-5 w-5 ${confidenceColor(aiResult.confidence)}`} />
                      <span className="text-sm font-medium">Pouzdanost:</span>
                    </div>
                    <Badge variant={aiResult.confidence >= 0.8 ? 'success' : aiResult.confidence >= 0.5 ? 'warning' : 'destructive'}>
                      {confidenceLabel(aiResult.confidence)} ({Math.round(aiResult.confidence * 100)}%)
                    </Badge>
                  </div>

                  {/* Extracted Fields */}
                  <div className="space-y-2">
                    <div className="border rounded-lg p-3">
                      <Label className="text-xs text-muted-foreground">Dobavljač</Label>
                      <p className="font-medium">{aiResult.supplier || '-'}</p>
                    </div>
                    <div className="border rounded-lg p-3">
                      <Label className="text-xs text-muted-foreground">Datum</Label>
                      <p className="font-medium">{aiResult.date ? formatDate(aiResult.date) : '-'}</p>
                    </div>
                    <div className="border rounded-lg p-3">
                      <Label className="text-xs text-muted-foreground">Opis</Label>
                      <p className="font-medium">{aiResult.description || '-'}</p>
                    </div>
                    <div className="border rounded-lg p-3">
                      <Label className="text-xs text-muted-foreground">Kategorija</Label>
                      <Badge variant="outline">
                        {EXPENSE_CATEGORIES.find((c) => c.value === aiResult.category)?.label || aiResult.category}
                      </Badge>
                    </div>

                    {/* Line Items */}
                    {aiResult.items.length > 0 && (
                      <div className="border rounded-lg p-3">
                        <Label className="text-xs text-muted-foreground mb-2 block">Stavke</Label>
                        <div className="space-y-1">
                          {aiResult.items.map((item, i) => (
                            <div key={i} className="flex justify-between text-sm">
                              <span className="truncate flex-1">{item.description}</span>
                              <span className="font-medium ml-2">{formatCurrency(item.total)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="border rounded-lg p-3 bg-primary/5">
                      <Label className="text-xs text-muted-foreground">Ukupan iznos</Label>
                      <p className="text-xl font-bold text-primary">{formatCurrency(aiResult.totalAmount)}</p>
                    </div>
                  </div>
                </div>
              )}

              {!aiScanning && !aiResult && !aiError && (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                  <Bot className="h-12 w-12 mb-3 opacity-30" />
                  <p className="text-sm">Odaberite sliku računa i kliknite "Skeniraj sa AI"</p>
                </div>
              )}
            </div>
          </div>

          {aiResult && (
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setAiResult(null)}>
                Skeniraj ponovo
              </Button>
              <Button onClick={handleAiAccept}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Prihvati i pregledaj
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Receipt Preview Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={() => { if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }}>
        <DialogContent onClose={() => { if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }} className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Pregled računa</DialogTitle>
          </DialogHeader>
          {previewUrl && <img src={previewUrl} alt="Račun" className="max-h-[70vh] object-contain mx-auto" />}
        </DialogContent>
      </Dialog>

      {/* API Key Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent onClose={() => setSettingsOpen(false)} className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              OpenAI Podešavanja
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>OpenAI API ključ</Label>
              <Input
                type="password"
                value={tempApiKey}
                onChange={(e) => setTempApiKey(e.target.value)}
                placeholder="sk-..."
              />
              <p className="text-xs text-muted-foreground mt-1">
                Ključ se čuva lokalno u vašem browseru. Nabavite ga na platform.openai.com/api-keys
              </p>
            </div>
            {openaiApiKey && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle className="h-4 w-4" />
                API ključ je konfigurisan
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>Otkaži</Button>
            <Button onClick={handleSaveApiKey} disabled={!tempApiKey}>Sačuvaj</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
