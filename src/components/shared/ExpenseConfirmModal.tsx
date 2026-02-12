import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Edit3, X } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { EXPENSE_CATEGORIES } from '@/types';
import type { ExpenseCategory } from '@/types';
import type { ExtractedExpense } from '@/lib/ai-extract';

interface ExpenseConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  extractedData: ExtractedExpense;
  previewUrl: string | null;
  onConfirm: (data: ExtractedExpense) => void;
  onCancel: () => void;
}

function ConfidenceBadge({ value }: { value: number }) {
  if (value <= 0) return null;
  const variant = value >= 0.8 ? 'success' : value >= 0.5 ? 'warning' : 'destructive';
  const label = value >= 0.8 ? 'Visoka' : value >= 0.5 ? 'Srednja' : 'Niska';
  return (
    <Badge variant={variant} className="ml-2 text-[10px]">
      {label} {Math.round(value * 100)}%
    </Badge>
  );
}

export default function ExpenseConfirmModal({
  open,
  onOpenChange,
  extractedData,
  previewUrl,
  onConfirm,
  onCancel,
}: ExpenseConfirmModalProps) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ExtractedExpense>(extractedData);

  // Reset form when extractedData changes
  const [prevData, setPrevData] = useState(extractedData);
  if (extractedData !== prevData) {
    setPrevData(extractedData);
    setForm(extractedData);
    setEditing(false);
  }

  const confidence = form.confidence;

  const handleConfirm = () => {
    onConfirm(form);
  };

  const updateLineItem = (index: number, field: string, value: string | number) => {
    const items = [...form.items];
    items[index] = { ...items[index], [field]: value };
    if (field === 'quantity' || field === 'price') {
      items[index].total = Number(items[index].quantity) * Number(items[index].price);
    }
    setForm({ ...form, items });
  };

  // Calculate average confidence for the overall badge
  const confValues = Object.values(confidence).filter((v) => v > 0);
  const avgConfidence = confValues.length > 0 ? confValues.reduce((a, b) => a + b, 0) / confValues.length : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={onCancel} className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-primary" />
            Potvrda ekstraktovanih podataka
            <Badge variant={avgConfidence >= 0.8 ? 'success' : avgConfidence >= 0.5 ? 'warning' : 'destructive'} className="ml-2">
              Pouzdanost: {Math.round(avgConfidence * 100)}%
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-6 flex-1 min-h-0 overflow-hidden">
          {/* Left: Preview */}
          <div className="w-2/5 flex flex-col">
            <div className="flex-1 border rounded-lg overflow-hidden bg-muted flex items-center justify-center">
              {previewUrl ? (
                previewUrl.toLowerCase().endsWith('.pdf') ? (
                  <div className="text-center p-4">
                    <p className="text-sm text-muted-foreground">PDF dokument</p>
                    <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline text-sm mt-2">
                      Otvori PDF
                    </a>
                  </div>
                ) : (
                  <img src={previewUrl} alt="Račun" className="max-h-[60vh] object-contain" />
                )
              ) : (
                <p className="text-sm text-muted-foreground">Nema pregleda</p>
              )}
            </div>
          </div>

          {/* Right: Extracted data */}
          <div className="w-3/5 overflow-y-auto space-y-3 pr-1">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setEditing(!editing)}>
                {editing ? <><X className="h-3 w-3 mr-1" />Završi</> : <><Edit3 className="h-3 w-3 mr-1" />Uredi</>}
              </Button>
            </div>

            {/* Date */}
            <FieldRow label="Datum" confidence={confidence.date}>
              {editing ? (
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="h-8" />
              ) : (
                <span className="font-medium">{form.date ? formatDate(form.date) : '-'}</span>
              )}
            </FieldRow>

            {/* Invoice Number */}
            <FieldRow label="Broj fakture" confidence={confidence.invoiceNumber}>
              {editing ? (
                <Input value={form.invoiceNumber || ''} onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })} className="h-8" />
              ) : (
                <span className="font-medium">{form.invoiceNumber || '-'}</span>
              )}
            </FieldRow>

            {/* Supplier */}
            <FieldRow label="Dobavljač" confidence={confidence.supplier}>
              {editing ? (
                <Input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} className="h-8" />
              ) : (
                <span className="font-medium">{form.supplier || '-'}</span>
              )}
            </FieldRow>

            {/* Vendor Tax ID */}
            <FieldRow label="PIB dobavljača" confidence={confidence.vendorTaxId}>
              {editing ? (
                <Input value={form.vendorTaxId || ''} onChange={(e) => setForm({ ...form, vendorTaxId: e.target.value })} className="h-8" />
              ) : (
                <span className="font-medium">{form.vendorTaxId || '-'}</span>
              )}
            </FieldRow>

            {/* Description */}
            <FieldRow label="Opis" confidence={confidence.description}>
              {editing ? (
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="h-8" />
              ) : (
                <span className="font-medium">{form.description || '-'}</span>
              )}
            </FieldRow>

            {/* Category */}
            <FieldRow label="Kategorija" confidence={confidence.category}>
              {editing ? (
                <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ExpenseCategory })} className="h-8">
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </Select>
              ) : (
                <Badge variant="outline">
                  {EXPENSE_CATEGORIES.find((c) => c.value === form.category)?.label || form.category}
                </Badge>
              )}
            </FieldRow>

            {/* Due Date */}
            <FieldRow label="Rok plaćanja" confidence={confidence.dueDate}>
              {editing ? (
                <Input type="date" value={form.dueDate || ''} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="h-8" />
              ) : (
                <span className="font-medium">{form.dueDate ? formatDate(form.dueDate) : '-'}</span>
              )}
            </FieldRow>

            {/* Line Items */}
            {form.items.length > 0 && (
              <div className="border rounded-lg p-3">
                <div className="flex items-center mb-2">
                  <Label className="text-xs text-muted-foreground">Stavke</Label>
                  <ConfidenceBadge value={confidence.items} />
                </div>
                <div className="space-y-2">
                  {form.items.map((item, i) => (
                    <div key={i} className="border-b pb-2 last:border-b-0 last:pb-0">
                      {editing ? (
                        <div className="space-y-1">
                          <Input
                            value={item.description}
                            onChange={(e) => updateLineItem(i, 'description', e.target.value)}
                            placeholder="Opis"
                            className="h-7 text-sm"
                          />
                          <div className="flex gap-2">
                            <Input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateLineItem(i, 'quantity', parseFloat(e.target.value) || 0)}
                              placeholder="Kol."
                              className="h-7 text-sm w-20"
                            />
                            <Input
                              type="number"
                              step="0.01"
                              value={item.price}
                              onChange={(e) => updateLineItem(i, 'price', parseFloat(e.target.value) || 0)}
                              placeholder="Cijena"
                              className="h-7 text-sm w-24"
                            />
                            <span className="text-sm font-medium self-center whitespace-nowrap">
                              = {formatCurrency(item.total)}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between text-sm">
                          <span className="truncate flex-1">
                            {item.description}
                            {item.quantity > 1 && <span className="text-muted-foreground ml-1">x{item.quantity}</span>}
                          </span>
                          <span className="font-medium ml-2">{formatCurrency(item.total)}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tax Amount */}
            <FieldRow label="PDV" confidence={confidence.taxAmount}>
              {editing ? (
                <Input
                  type="number"
                  step="0.01"
                  value={form.taxAmount || 0}
                  onChange={(e) => setForm({ ...form, taxAmount: parseFloat(e.target.value) || 0 })}
                  className="h-8"
                />
              ) : (
                <span className="font-medium">{formatCurrency(form.taxAmount || 0)}</span>
              )}
            </FieldRow>

            {/* Total Amount */}
            <div className="border rounded-lg p-3 bg-primary/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Label className="text-xs text-muted-foreground">Ukupan iznos</Label>
                  <ConfidenceBadge value={confidence.totalAmount} />
                </div>
              </div>
              {editing ? (
                <Input
                  type="number"
                  step="0.01"
                  value={form.totalAmount}
                  onChange={(e) => setForm({ ...form, totalAmount: parseFloat(e.target.value) || 0 })}
                  className="h-9 text-lg font-bold mt-1"
                />
              ) : (
                <p className="text-xl font-bold text-primary mt-1">{formatCurrency(form.totalAmount)}</p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onCancel}>Otkaži</Button>
          <Button onClick={handleConfirm}>
            <CheckCircle className="h-4 w-4 mr-2" />
            Potvrdi i sačuvaj
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FieldRow({ label, confidence, children }: { label: string; confidence: number; children: React.ReactNode }) {
  return (
    <div className="border rounded-lg p-3">
      <div className="flex items-center mb-1">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <ConfidenceBadge value={confidence} />
      </div>
      {children}
    </div>
  );
}
