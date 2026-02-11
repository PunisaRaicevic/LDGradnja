import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import {
  Bot, AlertTriangle, AlertCircle, Info, CheckCircle2, XCircle,
  Loader2, Calculator, FileQuestion, GitBranch, Brain, Check,
} from 'lucide-react';
import { useSettingsStore } from '@/store/useSettingsStore';
import { validateAllLocal } from '@/lib/predmjer-validator';
import { validateWithAI } from '@/lib/ai-validator';
import type { BillItem } from '@/types';
import type { ValidationIssue, ValidationResult, ChunkProgress } from '@/types/validation';

interface PredmjerValidatorProps {
  items: BillItem[];
  onApplyFixes: (fixes: { id: string; data: Partial<BillItem> }[]) => void;
}

const severityIcons = {
  error: <AlertCircle className="h-4 w-4 text-red-500" />,
  warning: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  info: <Info className="h-4 w-4 text-blue-500" />,
};

const categoryIcons = {
  math: <Calculator className="h-4 w-4" />,
  missing_data: <FileQuestion className="h-4 w-4" />,
  structure: <GitBranch className="h-4 w-4" />,
  semantic: <Brain className="h-4 w-4" />,
};

const categoryLabels = {
  math: 'Matematika',
  missing_data: 'Nedostaje',
  structure: 'Struktura',
  semantic: 'AI Semantika',
};

const severityLabels = {
  error: 'Greška',
  warning: 'Upozorenje',
  info: 'Info',
};

type FilterCategory = 'all' | 'math' | 'missing_data' | 'structure' | 'semantic';
type FilterSeverity = 'all' | 'error' | 'warning' | 'info';

export default function PredmjerValidator({ items, onApplyFixes }: PredmjerValidatorProps) {
  const { openaiApiKey } = useSettingsStore();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [aiRunning, setAiRunning] = useState(false);
  const [aiProgress, setAiProgress] = useState<ChunkProgress | null>(null);
  const [aiDone, setAiDone] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('all');
  const [filterSeverity, setFilterSeverity] = useState<FilterSeverity>('all');

  const handleOpen = useCallback(() => {
    setOpen(true);
    setAiDone(false);
    setAiError(null);
    setAiProgress(null);
    setFilterCategory('all');
    setFilterSeverity('all');

    // Run local validation immediately
    const localResult = validateAllLocal(items);
    setResult(localResult);
    setIssues(localResult.issues);
  }, [items]);

  const handleClose = () => {
    setOpen(false);
    setResult(null);
    setIssues([]);
    setAiRunning(false);
    setAiDone(false);
    setAiError(null);
    setAiProgress(null);
  };

  const handleRunAI = async () => {
    const apiKey = openaiApiKey || prompt('Unesite OpenAI API ključ:');
    if (!apiKey) return;

    setAiRunning(true);
    setAiError(null);

    try {
      const aiIssues = await validateWithAI(items, {
        apiKey,
        onProgress: setAiProgress,
      });

      setIssues((prev) => [...prev, ...aiIssues]);
      setResult((prev) =>
        prev
          ? { ...prev, semanticIssues: aiIssues.length, issues: [...prev.issues, ...aiIssues] }
          : null
      );
      setAiDone(true);
    } catch (err: any) {
      setAiError(err.message || 'Greška pri AI analizi');
    } finally {
      setAiRunning(false);
    }
  };

  const toggleIssue = (index: number) => {
    setIssues((prev) =>
      prev.map((issue, i) => (i === index ? { ...issue, accepted: !issue.accepted } : issue))
    );
  };

  const acceptAll = () => {
    setIssues((prev) =>
      prev.map((issue) => (issue.autoFixable ? { ...issue, accepted: true } : issue))
    );
  };

  const rejectAll = () => {
    setIssues((prev) => prev.map((issue) => ({ ...issue, accepted: false })));
  };

  const handleApply = () => {
    const fixes: { id: string; data: Partial<BillItem> }[] = [];

    for (const issue of issues) {
      if (!issue.accepted || !issue.autoFixable || !issue.suggestedValue) continue;

      const item = items[issue.rowIndex];
      if (!item) continue;

      const data: Partial<BillItem> = {};
      if (issue.field === 'totalPrice') {
        data.totalPrice = parseFloat(issue.suggestedValue);
      } else if (issue.field === 'unitPrice') {
        data.unitPrice = parseFloat(issue.suggestedValue);
      } else if (issue.field === 'quantity') {
        data.quantity = parseFloat(issue.suggestedValue);
      } else if (issue.field === 'unit') {
        data.unit = issue.suggestedValue;
      } else if (issue.field === 'ordinal') {
        data.ordinal = parseInt(issue.suggestedValue);
      } else if (issue.field === 'description') {
        data.description = issue.suggestedValue;
      }

      if (Object.keys(data).length > 0) {
        fixes.push({ id: item.id, data });
      }
    }

    if (fixes.length > 0) {
      onApplyFixes(fixes);
    }
    handleClose();
  };

  const filteredIssues = issues.filter((issue) => {
    if (filterCategory !== 'all' && issue.category !== filterCategory) return false;
    if (filterSeverity !== 'all' && issue.severity !== filterSeverity) return false;
    return true;
  });

  const acceptedCount = issues.filter((i) => i.accepted).length;
  const fixableCount = issues.filter((i) => i.autoFixable).length;

  return (
    <>
      <Button variant="outline" onClick={handleOpen} disabled={items.length === 0}>
        <Bot className="h-4 w-4 mr-2" />
        AI Provjera predmjera
      </Button>

      <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
        <DialogContent
          onClose={handleClose}
          className="max-w-5xl max-h-[90vh] flex flex-col"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              Provjera predmjera
            </DialogTitle>
          </DialogHeader>

          {result && (
            <>
              {/* Summary stats */}
              <div className="grid grid-cols-5 gap-3 mb-4">
                <div className="border rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold">{result.totalChecked}</p>
                  <p className="text-xs text-muted-foreground">Provjereno</p>
                </div>
                <div className="border rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-red-500">{result.mathErrors}</p>
                  <p className="text-xs text-muted-foreground">Matematika</p>
                </div>
                <div className="border rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-amber-500">{result.missingData}</p>
                  <p className="text-xs text-muted-foreground">Nedostaje</p>
                </div>
                <div className="border rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-blue-500">{result.structureIssues}</p>
                  <p className="text-xs text-muted-foreground">Struktura</p>
                </div>
                <div className="border rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-purple-500">{result.semanticIssues}</p>
                  <p className="text-xs text-muted-foreground">AI Semantika</p>
                </div>
              </div>

              {/* AI Section */}
              {!aiDone && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Brain className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium text-sm">AI Semantička analiza</p>
                        <p className="text-xs text-muted-foreground">
                          Pronalazi nelogične jedinice, neuobičajene cijene i duplikate
                        </p>
                      </div>
                    </div>
                    {!aiRunning && (
                      <Button size="sm" onClick={handleRunAI}>
                        <Brain className="h-4 w-4 mr-2" />
                        Pokreni AI analizu
                      </Button>
                    )}
                  </div>
                  {aiRunning && aiProgress && (
                    <div className="mt-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Chunk {aiProgress.currentChunk}/{aiProgress.totalChunks} — {aiProgress.processedRows}/{aiProgress.totalRows} redova
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${(aiProgress.processedRows / aiProgress.totalRows) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {aiError && (
                    <p className="mt-2 text-sm text-red-500">{aiError}</p>
                  )}
                </div>
              )}

              {aiDone && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <p className="text-sm text-green-700">
                    AI analiza završena — pronađeno {result.semanticIssues} semantičkih problema
                  </p>
                </div>
              )}

              {/* Filters */}
              {issues.length > 0 && (
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="text-sm text-muted-foreground mr-1">Kategorija:</span>
                  {(['all', 'math', 'missing_data', 'structure', 'semantic'] as FilterCategory[]).map((cat) => (
                    <Button
                      key={cat}
                      variant={filterCategory === cat ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFilterCategory(cat)}
                      className="text-xs h-7"
                    >
                      {cat === 'all' ? 'Sve' : categoryLabels[cat]}
                    </Button>
                  ))}
                  <span className="text-sm text-muted-foreground ml-3 mr-1">Ozbiljnost:</span>
                  {(['all', 'error', 'warning', 'info'] as FilterSeverity[]).map((sev) => (
                    <Button
                      key={sev}
                      variant={filterSeverity === sev ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFilterSeverity(sev)}
                      className="text-xs h-7"
                    >
                      {sev === 'all' ? 'Sve' : severityLabels[sev]}
                    </Button>
                  ))}
                </div>
              )}

              {/* Issues Table */}
              {issues.length > 0 ? (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <Button variant="outline" size="sm" onClick={acceptAll}>
                      <Check className="h-3 w-3 mr-1" />
                      Prihvati sve ({fixableCount})
                    </Button>
                    <Button variant="outline" size="sm" onClick={rejectAll}>
                      <XCircle className="h-3 w-3 mr-1" />
                      Odbij sve
                    </Button>
                  </div>

                  <div className="overflow-y-auto max-h-[35vh] border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10"></TableHead>
                          <TableHead className="w-10"></TableHead>
                          <TableHead className="w-20">Kat.</TableHead>
                          <TableHead className="w-14">Red</TableHead>
                          <TableHead className="w-20">Polje</TableHead>
                          <TableHead>Opis problema</TableHead>
                          <TableHead className="w-36">Trenutno → Predloženo</TableHead>
                          <TableHead className="w-16 text-center">Prihvati</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredIssues.map((issue, idx) => {
                          const originalIdx = issues.indexOf(issue);
                          const item = items[issue.rowIndex];
                          return (
                            <TableRow key={idx} className={issue.accepted ? 'bg-green-50/50' : ''}>
                              <TableCell>{severityIcons[issue.severity]}</TableCell>
                              <TableCell>{categoryIcons[issue.category]}</TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="text-xs">
                                  {categoryLabels[issue.category]}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm">#{item?.ordinal ?? issue.rowIndex + 1}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{issue.field}</TableCell>
                              <TableCell className="text-sm">{issue.message}</TableCell>
                              <TableCell className="text-xs">
                                {issue.suggestedValue ? (
                                  <span>
                                    <span className="text-red-500 line-through">{issue.currentValue}</span>
                                    {' → '}
                                    <span className="text-green-600 font-medium">{issue.suggestedValue}</span>
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">{issue.currentValue || '—'}</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {issue.autoFixable ? (
                                  <input
                                    type="checkbox"
                                    checked={issue.accepted}
                                    onChange={() => toggleIssue(originalIdx)}
                                    className="h-4 w-4 rounded border-gray-300 cursor-pointer"
                                  />
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </>
              ) : (
                <div className="py-8 text-center">
                  <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-green-500" />
                  <p className="font-medium">Predmjer izgleda ispravno!</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Lokalna provjera nije pronašla probleme. Pokrenite AI analizu za dublje provjere.
                  </p>
                </div>
              )}
            </>
          )}

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={handleClose}>Zatvori</Button>
            {acceptedCount > 0 && (
              <Button onClick={handleApply}>
                <Check className="h-4 w-4 mr-2" />
                Primijeni {acceptedCount} ispravki
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
