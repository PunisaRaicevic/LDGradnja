import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useExpenseStore } from '@/store/useExpenseStore';
import { Card, CardContent } from '@/components/ui/card';
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
  CheckCircle, Sparkles, AlertCircle,
  FileSpreadsheet, FileText, Download, Upload, Bell, X,
  DollarSign, Clock, FileText as FileIcon,
} from 'lucide-react';
import { formatCurrency, formatDate, getToday } from '@/lib/utils';
import { getStorageUrl } from '@/lib/supabase';
import { extractExpenseFromImage } from '@/lib/ai-extract';
import type { ExtractedExpense } from '@/lib/ai-extract';
import { EXPENSE_CATEGORIES } from '@/types';
import type { Expense, ExpenseCategory } from '@/types';
import ExpenseConfirmModal from '@/components/shared/ExpenseConfirmModal';
import { exportExpensesExcel, exportExpensesPDF } from '@/lib/expense-report';
import type { ReportFilters } from '@/lib/expense-report';

// Status config - matching invoice-app pattern
const statusConfig: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' | 'outline' }> = {
  confirmed: { label: 'Potvrđen', variant: 'success' },
  pending: { label: 'Čeka potvrdu', variant: 'warning' },
};

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
  const { expenses, loadExpenses, addExpense, deleteExpense, confirmExpense } = useExpenseStore();

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
  const [dragActive, setDragActive] = useState(false);

  // Confirmation modal
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingExtraction, setPendingExtraction] = useState<ExtractedExpense | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);


  // Detail modal
  const [detailExpense, setDetailExpense] = useState<Expense | null>(null);
  const [detailPreviewUrl, setDetailPreviewUrl] = useState<string | null>(null);

  // Report dialog
  const [reportOpen, setReportOpen] = useState(false);
  const [reportFilters, setReportFilters] = useState<ReportFilters>({});

  useEffect(() => {
    if (projectId) loadExpenses(projectId);
  }, [projectId, loadExpenses]);

  const filtered = expenses.filter((e) => {
    const matchSearch =
      e.supplier.toLowerCase().includes(search.toLowerCase()) ||
      e.description.toLowerCase().includes(search.toLowerCase());
    const matchCategory = !categoryFilter || e.category === categoryFilter;
    return matchSearch && matchCategory;
  });

  const totalExpenses = filtered.reduce((sum, e) => sum + e.totalAmount, 0);
  const pendingExpenses = expenses.filter((e) => e.status === 'pending');
  const totalTax = filtered.reduce((sum, e) => sum + (e.taxAmount || 0), 0);

  const handleSave = async () => {
    if (!projectId || !form.description) return;
    const totalAmount = form.quantity * form.price;
    await addExpense({ ...form, projectId, totalAmount, status: 'confirmed' }, receiptFile);
    setDialogOpen(false);
    setForm(emptyForm);
    setReceiptFile(undefined);
  };

  const handleReceiptPreview = async (expense: Expense) => {
    if (expense.receiptFilePath) {
      const url = await getStorageUrl('receipts', expense.receiptFilePath);
      if (url) setPreviewUrl(url);
    }
  };

  const handleRowClick = async (expense: Expense) => {
    setDetailExpense(expense);
    if (expense.receiptFilePath) {
      const url = await getStorageUrl('receipts', expense.receiptFilePath);
      setDetailPreviewUrl(url);
    } else {
      setDetailPreviewUrl(null);
    }
  };

  // Drag and drop handlers - matching invoice-app
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setAiFile(file);
      setAiResult(null);
      setAiError(null);
      if (aiPreviewUrl) URL.revokeObjectURL(aiPreviewUrl);
      setAiPreviewUrl(URL.createObjectURL(file));
    }
  }, [aiPreviewUrl]);

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
    if (!aiFile) return;
    setAiScanning(true);
    setAiError(null);
    setAiResult(null);

    try {
      const result = await extractExpenseFromImage(aiFile);
      setAiResult(result);
    } catch (err: any) {
      setAiError(err.message || 'Greška pri AI analizi.');
    } finally {
      setAiScanning(false);
    }
  };

  const handleAiAccept = () => {
    if (!aiResult) return;
    setPendingExtraction(aiResult);
    setPendingFile(aiFile);
    setPendingPreviewUrl(aiPreviewUrl);
    setAiScanOpen(false);
    setConfirmOpen(true);
    setAiResult(null);
    setAiFile(null);
    setAiPreviewUrl(null);
  };

  const handleConfirmSave = async (data: ExtractedExpense) => {
    if (!projectId) return;
    await addExpense(
      {
        projectId,
        date: data.date || getToday(),
        supplier: data.supplier,
        description: data.description,
        quantity: 1,
        price: data.totalAmount,
        totalAmount: data.totalAmount,
        category: (data.category as ExpenseCategory) || 'ostalo',
        invoiceNumber: data.invoiceNumber || undefined,
        dueDate: data.dueDate || undefined,
        vendorTaxId: data.vendorTaxId || undefined,
        taxAmount: data.taxAmount || 0,
        status: 'confirmed',
        extractionConfidence: data.confidence,
        lineItems: data.items.length > 0 ? data.items : undefined,
      },
      pendingFile || undefined
    );
    setConfirmOpen(false);
    setPendingExtraction(null);
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    setPendingPreviewUrl(null);
    setPendingFile(null);
  };

  const handleConfirmCancel = () => {
    setConfirmOpen(false);
    setPendingExtraction(null);
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    setPendingPreviewUrl(null);
    setPendingFile(null);
  };

  const openAiScan = () => {
    setAiFile(null);
    setAiResult(null);
    setAiError(null);
    if (aiPreviewUrl) URL.revokeObjectURL(aiPreviewUrl);
    setAiPreviewUrl(null);
    setAiScanOpen(true);
  };

  const handleExportExcel = () => {
    exportExpensesExcel(expenses, reportFilters);
    setReportOpen(false);
  };

  const handleExportPDF = () => {
    exportExpensesPDF(expenses, reportFilters);
    setReportOpen(false);
  };

  const removeAiFile = () => {
    if (aiPreviewUrl) URL.revokeObjectURL(aiPreviewUrl);
    setAiFile(null);
    setAiPreviewUrl(null);
    setAiResult(null);
    setAiError(null);
  };

  return (
    <div className="space-y-6">
      {/* Pending Confirmations Banner - matching invoice-app */}
      {pendingExpenses.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <Bell className="text-amber-600" size={20} />
              </div>
              <div>
                <p className="font-medium text-amber-800">
                  {pendingExpenses.length} trošak{pendingExpenses.length > 1 ? 'a' : ''} čeka potvrdu
                </p>
                <p className="text-sm text-amber-600">
                  Pregledajte i potvrdite ekstrahovane podatke
                </p>
              </div>
            </div>
            <Button
              size="sm"
              className="bg-amber-500 hover:bg-amber-600 text-white"
              onClick={() => {
                const first = pendingExpenses[0];
                if (first) confirmExpense(first.id, {});
              }}
            >
              Potvrdi sve
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Troškovnik i računi</h1>
          <p className="text-sm text-muted-foreground">Pregled troškova i upravljanje fakturama</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setReportOpen(true)}>
            <Download className="h-4 w-4 mr-2" />
            Izvještaj
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

      {/* Statistics Cards - matching invoice-app dashboard pattern */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-50/30">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Ukupni troškovi</p>
                <p className="text-xl font-bold mt-1">{formatCurrency(totalExpenses)}</p>
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <DollarSign className="text-blue-600" size={20} />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-50/30">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">PDV ukupno</p>
                <p className="text-xl font-bold mt-1">{formatCurrency(totalTax)}</p>
              </div>
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                <Receipt className="text-green-600" size={20} />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-amber-50/30">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Na čekanju</p>
                <p className="text-xl font-bold mt-1">{pendingExpenses.length}</p>
              </div>
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                <Clock className="text-amber-600" size={20} />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-purple-50/30">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Ukupno faktura</p>
                <p className="text-xl font-bold mt-1">{expenses.length}</p>
              </div>
              <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                <FileIcon className="text-purple-600" size={20} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
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
                <TableHead>Status</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead>Dobavljač</TableHead>
                <TableHead>Opis</TableHead>
                <TableHead>Kategorija</TableHead>
                <TableHead className="text-right">Kol.</TableHead>
                <TableHead className="text-right">Cijena</TableHead>
                <TableHead className="text-right">PDV</TableHead>
                <TableHead className="text-right">Ukupno</TableHead>
                <TableHead className="text-right">Akcije</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((expense) => {
                const status = statusConfig[expense.status] || statusConfig.confirmed;
                return (
                  <TableRow key={expense.id} className={`cursor-pointer hover:bg-muted/50 ${expense.status === 'pending' ? 'bg-amber-50/50' : ''}`} onClick={() => handleRowClick(expense)}>
                    <TableCell>
                      <Badge variant={status.variant}>
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(expense.date)}</TableCell>
                    <TableCell className="font-medium">{expense.supplier}</TableCell>
                    <TableCell className="max-w-48 truncate">{expense.description}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {EXPENSE_CATEGORIES.find((c) => c.value === expense.category)?.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{expense.quantity}</TableCell>
                    <TableCell className="text-right">{formatCurrency(expense.price)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(expense.taxAmount || 0)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(expense.totalAmount)}</TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        {expense.receiptFileName && (
                          <Button variant="ghost" size="icon" onClick={() => handleReceiptPreview(expense)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        {expense.status === 'pending' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => confirmExpense(expense.id, {})}
                            title="Potvrdi"
                          >
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => deleteExpense(expense.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              <TableRow className="bg-muted/50 font-bold">
                <TableCell colSpan={7} className="text-right">UKUPNO:</TableCell>
                <TableCell className="text-right">{formatCurrency(totalTax)}</TableCell>
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

      {/* AI Scan Dialog - matching invoice-app upload page */}
      <Dialog open={aiScanOpen} onOpenChange={(open) => {
        if (!open) {
          setAiScanOpen(false);
          removeAiFile();
        }
      }}>
        <DialogContent
          onClose={() => setAiScanOpen(false)}
          className="max-w-2xl"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              AI Skeniranje računa
            </DialogTitle>
          </DialogHeader>

          {!aiFile ? (
            /* Drag and drop zone - matching invoice-app */
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                dragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-muted-foreground/50 bg-muted/30'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-lg font-medium">
                Prevucite fajl ovdje
              </p>
              <p className="mt-1 text-sm text-muted-foreground">ili</p>
              <label className="mt-4 inline-block">
                <input
                  type="file"
                  className="hidden"
                  accept="image/*,.pdf"
                  onChange={handleAiFileSelect}
                />
                <span className="cursor-pointer inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                  Odaberite fajl
                </span>
              </label>
              <p className="mt-4 text-xs text-muted-foreground">
                PDF, JPG ili PNG do 10MB
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* File preview - matching invoice-app */}
              <div className="flex items-center gap-4 p-4 bg-muted/30 border rounded-xl">
                {aiPreviewUrl && aiFile?.type.startsWith('image/') ? (
                  <img src={aiPreviewUrl} alt="Preview" className="w-20 h-20 object-cover rounded-lg" />
                ) : (
                  <div className="w-20 h-20 bg-red-50 rounded-lg flex items-center justify-center">
                    <FileText className="text-red-400" size={32} />
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-medium">{aiFile?.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {aiFile ? (aiFile.size / 1024 / 1024).toFixed(2) : 0} MB
                  </p>
                </div>
                {!aiScanning && !aiResult && (
                  <button onClick={removeAiFile} className="p-2 hover:bg-muted rounded-full transition-colors">
                    <X size={20} className="text-muted-foreground" />
                  </button>
                )}
              </div>

              {/* Status message - matching invoice-app */}
              {aiScanning && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current" />
                  AI analizira fakturu... Sačekajte.
                </div>
              )}

              {aiError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl">
                  <AlertCircle size={20} />
                  {aiError}
                </div>
              )}

              {aiResult && (
                <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 border border-green-200 rounded-xl">
                  <CheckCircle size={20} />
                  Ekstrakcija završena. Pregledajte i potvrdite podatke.
                </div>
              )}

              {/* Action buttons - matching invoice-app */}
              <div className="flex gap-3">
                {!aiResult ? (
                  <Button
                    onClick={handleAiScan}
                    disabled={aiScanning}
                    className="flex-1"
                  >
                    {aiScanning ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Obrada u toku...</>
                    ) : (
                      <><Upload size={16} className="mr-2" />Upload i obradi</>
                    )}
                  </Button>
                ) : (
                  <Button onClick={handleAiAccept} className="flex-1">
                    <CheckCircle size={16} className="mr-2" />
                    Pregledaj i potvrdi
                  </Button>
                )}
                {!aiScanning && !aiResult && (
                  <Button variant="outline" onClick={removeAiFile}>
                    Otkaži
                  </Button>
                )}
                {aiResult && (
                  <Button variant="outline" onClick={() => { setAiResult(null); setAiError(null); }}>
                    Skeniraj ponovo
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Expense Confirmation Modal - matching invoice-app */}
      {pendingExtraction && (
        <ExpenseConfirmModal
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          extractedData={pendingExtraction}
          previewUrl={pendingPreviewUrl}
          previewType={pendingFile?.type}
          onConfirm={handleConfirmSave}
          onCancel={handleConfirmCancel}
        />
      )}

      {/* Receipt Preview Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent onClose={() => setPreviewUrl(null)} className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Pregled računa</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            previewUrl.toLowerCase().includes('.pdf') ? (
              <iframe src={previewUrl} className="w-full h-[75vh] rounded-lg border" title="Račun PDF" />
            ) : (
              <img src={previewUrl} alt="Račun" className="max-h-[75vh] object-contain mx-auto" />
            )
          )}
        </DialogContent>
      </Dialog>

      {/* Report Dialog - matching invoice-app style */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent onClose={() => setReportOpen(false)} className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Izvoz izvještaja
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Datum od</Label>
                <Input
                  type="date"
                  value={reportFilters.dateFrom || ''}
                  onChange={(e) => setReportFilters({ ...reportFilters, dateFrom: e.target.value || undefined })}
                />
              </div>
              <div>
                <Label>Datum do</Label>
                <Input
                  type="date"
                  value={reportFilters.dateTo || ''}
                  onChange={(e) => setReportFilters({ ...reportFilters, dateTo: e.target.value || undefined })}
                />
              </div>
            </div>
            <div>
              <Label>Kategorija</Label>
              <Select
                value={reportFilters.category || ''}
                onChange={(e) => setReportFilters({ ...reportFilters, category: e.target.value || undefined })}
              >
                <option value="">Sve kategorije</option>
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </Select>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-700">
                Izvoz će uključiti {expenses.length} troškova (bez filtera) ili filtrirane rezultate.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportOpen(false)}>Otkaži</Button>
            <Button variant="outline" onClick={handleExportExcel}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Excel
            </Button>
            <Button onClick={handleExportPDF}>
              <FileText className="h-4 w-4 mr-2" />
              PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Expense Detail Modal */}
      <Dialog open={!!detailExpense} onOpenChange={() => { setDetailExpense(null); setDetailPreviewUrl(null); }}>
        <DialogContent onClose={() => { setDetailExpense(null); setDetailPreviewUrl(null); }} className="max-w-4xl max-h-[90vh] overflow-hidden p-0">
          {detailExpense && (
            <>
              <div className="flex items-center justify-between p-6 border-b">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <FileIcon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Detalji fakture</h2>
                    <p className="text-sm text-muted-foreground">
                      {detailExpense.invoiceNumber || detailExpense.supplier}
                    </p>
                  </div>
                </div>
                <Badge variant={statusConfig[detailExpense.status]?.variant || 'outline'}>
                  {statusConfig[detailExpense.status]?.label || detailExpense.status}
                </Badge>
              </div>

              <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left: Receipt Preview */}
                  <div>
                    <h3 className="font-semibold mb-3">Dokument</h3>
                    <div className="border rounded-xl overflow-hidden bg-muted/30">
                      {detailPreviewUrl ? (
                        detailPreviewUrl.toLowerCase().includes('.pdf') ? (
                          <iframe src={detailPreviewUrl} className="w-full aspect-[3/4] rounded" title="Faktura PDF" />
                        ) : (
                          <img src={detailPreviewUrl} alt="Račun" className="w-full h-auto" />
                        )
                      ) : (
                        <div className="aspect-[3/4] flex flex-col items-center justify-center">
                          <Receipt className="w-12 h-12 text-muted-foreground mb-2" />
                          <p className="text-muted-foreground text-sm">Nema priloženog dokumenta</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Expense Data */}
                  <div className="space-y-4">
                    {/* Osnovni podaci */}
                    <div className="bg-muted/30 rounded-xl p-4 space-y-3 border">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <Clock size={16} className="text-primary" />
                        Osnovni podaci
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-muted-foreground">Broj fakture</label>
                          <p className="font-medium">{detailExpense.invoiceNumber || '-'}</p>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Datum</label>
                          <p className="font-medium">{detailExpense.date ? formatDate(detailExpense.date) : '-'}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-muted-foreground">Kategorija</label>
                          <p className="font-medium">
                            {EXPENSE_CATEGORIES.find((c) => c.value === detailExpense.category)?.label || detailExpense.category}
                          </p>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Rok plaćanja</label>
                          <p className="font-medium">{detailExpense.dueDate ? formatDate(detailExpense.dueDate) : '-'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Dobavljač */}
                    <div className="bg-muted/30 rounded-xl p-4 space-y-3 border">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <DollarSign size={16} className="text-primary" />
                        Dobavljač
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Naziv</label>
                        <p className="font-medium">{detailExpense.supplier || '-'}</p>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">PIB</label>
                        <p className="font-medium">{detailExpense.vendorTaxId || '-'}</p>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Opis</label>
                        <p className="text-sm text-muted-foreground">{detailExpense.description || '-'}</p>
                      </div>
                    </div>

                    {/* Iznosi */}
                    <div className="bg-muted/30 rounded-xl p-4 space-y-3 border">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <DollarSign size={16} className="text-primary" />
                        Iznosi
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="text-xs text-muted-foreground">Cijena</label>
                          <p className="font-medium">{formatCurrency(detailExpense.price)}</p>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">PDV</label>
                          <p className="font-medium">{formatCurrency(detailExpense.taxAmount || 0)}</p>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Ukupno</label>
                          <p className="text-lg font-bold text-primary">{formatCurrency(detailExpense.totalAmount)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Stavke */}
                    {detailExpense.lineItems && detailExpense.lineItems.length > 0 && (
                      <div className="bg-muted/30 rounded-xl p-4 border">
                        <p className="text-sm font-medium text-muted-foreground mb-2">
                          Stavke ({detailExpense.lineItems.length})
                        </p>
                        <div className="space-y-1">
                          {detailExpense.lineItems.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span className="text-muted-foreground truncate flex-1">
                                {item.description || `Stavka ${idx + 1}`}
                              </span>
                              <span className="font-medium ml-2">
                                {formatCurrency(item.total || 0)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
