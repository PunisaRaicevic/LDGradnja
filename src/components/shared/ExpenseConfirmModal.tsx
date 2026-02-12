import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  X, CheckCircle, AlertTriangle,
  Edit2, Save, Building, Calendar, DollarSign,
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { EXPENSE_CATEGORIES } from '@/types';
import type { ExtractedExpense } from '@/lib/ai-extract';

interface ExpenseConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  extractedData: ExtractedExpense;
  previewUrl: string | null;
  previewType?: string;
  onConfirm: (data: ExtractedExpense) => void;
  onCancel: () => void;
}

// Confidence level colors - matching invoice-app pattern
const getConfidenceColor = (confidence: number | undefined) => {
  if (!confidence) return 'bg-gray-100 text-gray-500';
  if (confidence >= 0.9) return 'bg-green-100 text-green-700';
  if (confidence >= 0.7) return 'bg-yellow-100 text-yellow-700';
  return 'bg-red-100 text-red-700';
};

const getConfidenceLabel = (confidence: number | undefined) => {
  if (!confidence) return 'Nepoznato';
  if (confidence >= 0.9) return 'Visoka';
  if (confidence >= 0.7) return 'Srednja';
  return 'Niska';
};

export default function ExpenseConfirmModal({
  open,
  onOpenChange,
  extractedData,
  previewUrl,
  previewType,
  onConfirm,
  onCancel,
}: ExpenseConfirmModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    date: extractedData.date || '',
    invoiceNumber: extractedData.invoiceNumber || '',
    supplier: extractedData.supplier || '',
    vendorTaxId: extractedData.vendorTaxId || '',
    description: extractedData.description || '',
    dueDate: extractedData.dueDate || '',
    category: extractedData.category || 'ostalo',
    taxAmount: extractedData.taxAmount || 0,
    totalAmount: extractedData.totalAmount || 0,
  });

  // Update form when extractedData changes
  useEffect(() => {
    setFormData({
      date: extractedData.date || '',
      invoiceNumber: extractedData.invoiceNumber || '',
      supplier: extractedData.supplier || '',
      vendorTaxId: extractedData.vendorTaxId || '',
      description: extractedData.description || '',
      dueDate: extractedData.dueDate || '',
      category: extractedData.category || 'ostalo',
      taxAmount: extractedData.taxAmount || 0,
      totalAmount: extractedData.totalAmount || 0,
    });
    setIsEditing(false);
  }, [extractedData]);

  if (!open) return null;

  const confidence = extractedData.confidence || {};
  const lineItems = extractedData.items || [];
  const hasLowConfidence = Object.values(confidence).some((c) => c > 0 && c < 0.7);

  const handleInputChange = (field: string, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleConfirm = () => {
    setIsSaving(true);
    onConfirm({
      ...extractedData,
      date: formData.date,
      invoiceNumber: formData.invoiceNumber,
      supplier: formData.supplier,
      vendorTaxId: formData.vendorTaxId,
      description: formData.description,
      dueDate: formData.dueDate,
      category: formData.category,
      taxAmount: Number(formData.taxAmount),
      totalAmount: Number(formData.totalAmount),
    });
    setIsSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={onCancel} className="max-w-4xl max-h-[90vh] overflow-hidden p-0">
        {/* Header - matching invoice-app pattern */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Potvrdi podatke fakture</h2>
              <p className="text-sm text-muted-foreground">
                Provjeri izvučene podatke i potvrdi ako su tačni
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Invoice Preview - matching invoice-app */}
            <div>
              <h3 className="font-semibold mb-3">Originalna faktura</h3>
              <div className="border rounded-xl overflow-hidden bg-muted/30">
                {previewUrl ? (
                  previewType === 'application/pdf' || previewUrl.toLowerCase().includes('.pdf') ? (
                    <iframe src={previewUrl} className="w-full aspect-[3/4] rounded" title="Faktura PDF" />
                  ) : (
                    <img src={previewUrl} alt="Faktura" className="w-full h-auto" />
                  )
                ) : (
                  <div className="aspect-[3/4] flex items-center justify-center">
                    <p className="text-muted-foreground">Nema pregleda</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Extracted Data - matching invoice-app sections */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Izvučeni podaci</h3>
                {!isEditing ? (
                  <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                    <Edit2 size={14} className="mr-1" />
                    Uredi
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                    <Save size={14} className="mr-1" />
                    Završi
                  </Button>
                )}
              </div>

              {/* Warning for low confidence - matching invoice-app */}
              {hasLowConfidence && (
                <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-700">Niska pouzdanost</p>
                    <p className="text-sm text-amber-600">
                      Neki podaci imaju nisku pouzdanost ekstrakcije. Molimo provjerite.
                    </p>
                  </div>
                </div>
              )}

              {/* Section: Osnovni podaci - matching invoice-app */}
              <div className="bg-muted/30 rounded-xl p-4 space-y-3 border">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Calendar size={16} className="text-primary" />
                  Osnovni podaci
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-muted-foreground">Broj fakture</label>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${getConfidenceColor(confidence.invoiceNumber)}`}>
                        {getConfidenceLabel(confidence.invoiceNumber)}
                      </span>
                    </div>
                    {isEditing ? (
                      <Input value={formData.invoiceNumber} onChange={(e) => handleInputChange('invoiceNumber', e.target.value)} className="h-9" />
                    ) : (
                      <p className="font-medium">{formData.invoiceNumber || '-'}</p>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-muted-foreground">Datum</label>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${getConfidenceColor(confidence.date)}`}>
                        {getConfidenceLabel(confidence.date)}
                      </span>
                    </div>
                    {isEditing ? (
                      <Input type="date" value={formData.date} onChange={(e) => handleInputChange('date', e.target.value)} className="h-9" />
                    ) : (
                      <p className="font-medium">{formData.date ? formatDate(formData.date) : '-'}</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Kategorija</label>
                    {isEditing ? (
                      <Select value={formData.category} onChange={(e) => handleInputChange('category', e.target.value)} className="h-9">
                        {EXPENSE_CATEGORIES.map((cat) => (
                          <option key={cat.value} value={cat.value}>{cat.label}</option>
                        ))}
                      </Select>
                    ) : (
                      <p className="font-medium">
                        {EXPENSE_CATEGORIES.find((c) => c.value === formData.category)?.label || formData.category}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Rok plaćanja</label>
                    {isEditing ? (
                      <Input type="date" value={formData.dueDate} onChange={(e) => handleInputChange('dueDate', e.target.value)} className="h-9" />
                    ) : (
                      <p className="font-medium">{formData.dueDate ? formatDate(formData.dueDate) : '-'}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Section: Dobavljač - matching invoice-app */}
              <div className="bg-muted/30 rounded-xl p-4 space-y-3 border">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Building size={16} className="text-primary" />
                  Dobavljač
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-muted-foreground">Naziv</label>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${getConfidenceColor(confidence.supplier)}`}>
                      {getConfidenceLabel(confidence.supplier)}
                    </span>
                  </div>
                  {isEditing ? (
                    <Input value={formData.supplier} onChange={(e) => handleInputChange('supplier', e.target.value)} className="h-9" />
                  ) : (
                    <p className="font-medium">{formData.supplier || '-'}</p>
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-muted-foreground">PIB</label>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${getConfidenceColor(confidence.vendorTaxId)}`}>
                      {getConfidenceLabel(confidence.vendorTaxId)}
                    </span>
                  </div>
                  {isEditing ? (
                    <Input value={formData.vendorTaxId} onChange={(e) => handleInputChange('vendorTaxId', e.target.value)} className="h-9" />
                  ) : (
                    <p className="font-medium">{formData.vendorTaxId || '-'}</p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Opis</label>
                  {isEditing ? (
                    <Input value={formData.description} onChange={(e) => handleInputChange('description', e.target.value)} className="h-9" />
                  ) : (
                    <p className="text-sm text-muted-foreground">{formData.description || '-'}</p>
                  )}
                </div>
              </div>

              {/* Section: Iznosi - matching invoice-app */}
              <div className="bg-muted/30 rounded-xl p-4 space-y-3 border">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <DollarSign size={16} className="text-primary" />
                  Iznosi
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">PDV</label>
                    {isEditing ? (
                      <Input type="number" step="0.01" value={formData.taxAmount} onChange={(e) => handleInputChange('taxAmount', e.target.value)} className="h-9" />
                    ) : (
                      <p className="font-medium">{formatCurrency(Number(formData.taxAmount))}</p>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-muted-foreground">Ukupno</label>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${getConfidenceColor(confidence.totalAmount)}`}>
                        {getConfidenceLabel(confidence.totalAmount)}
                      </span>
                    </div>
                    {isEditing ? (
                      <Input type="number" step="0.01" value={formData.totalAmount} onChange={(e) => handleInputChange('totalAmount', e.target.value)} className="h-9" />
                    ) : (
                      <p className="text-lg font-bold text-primary">
                        {formatCurrency(Number(formData.totalAmount))}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Line Items Preview - matching invoice-app */}
              {lineItems.length > 0 && (
                <div className="bg-muted/30 rounded-xl p-4 border">
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    Stavke ({lineItems.length})
                  </p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {lineItems.slice(0, 5).map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-muted-foreground truncate flex-1">
                          {item.description || `Stavka ${idx + 1}`}
                        </span>
                        <span className="font-medium ml-2">
                          {formatCurrency(item.total || 0)}
                        </span>
                      </div>
                    ))}
                    {lineItems.length > 5 && (
                      <p className="text-xs text-muted-foreground">
                        + {lineItems.length - 5} više stavki
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer - matching invoice-app */}
        <div className="flex items-center justify-between p-6 border-t bg-muted/30">
          <Button variant="outline" onClick={onCancel}>
            Zatvori
          </Button>
          <div className="flex gap-3">
            <Button onClick={handleConfirm} disabled={isEditing || isSaving}>
              <CheckCircle size={16} className="mr-2" />
              Potvrdi podatke
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
