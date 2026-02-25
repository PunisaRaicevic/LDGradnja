import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useFinanceStore } from '@/store/useFinanceStore';
import { useConstructionLogStore } from '@/store/useConstructionLogStore';
import { useProjectStore } from '@/store/useProjectStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Plus, Upload, FileSpreadsheet, FileText, Trash2, Eye,
  AlertTriangle, AlertCircle, CheckCircle, Loader2, BookOpen,
} from 'lucide-react';
import { formatDate, formatCurrency } from '@/lib/utils';
import { parseConstructionLogExcel } from '@/lib/construction-log-excel';
import { parseConstructionLogPDF } from '@/lib/construction-log-pdf';
import { validateLogPositions, computePositionTrackers } from '@/lib/construction-log-validator';
import LogSheetPreview from '@/components/shared/LogSheetPreview';
import { supabase } from '@/lib/supabase';
import type { ParsedSheetData, ParsedLogRow, LogValidationIssue, ConstructionLogSituation } from '@/types/construction-log';

type UploadStep = 'select-situation' | 'upload-files' | 'parsing' | 'preview' | 'saving' | 'done';

const MONTHS = [
  'Januar', 'Februar', 'Mart', 'April', 'Maj', 'Juni',
  'Juli', 'August', 'Septembar', 'Oktobar', 'Novembar', 'Decembar',
];

export default function ConstructionDiary() {
  const { projectId } = useParams();
  const { billItems, loadBillItems } = useFinanceStore();
  const {
    situations, positions,
    loadSituations, addSituation, deleteSituation, updateSituationStatus,
    addSheet, updateSheet, savePositions, loadPositions,
  } = useConstructionLogStore();
  const { projects } = useProjectStore();
  const _project = projects.find((p) => p.id === projectId);

  const [activeTab, setActiveTab] = useState('tracker');
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadStep, setUploadStep] = useState<UploadStep>('select-situation');
  const [parseProgress, setParseProgress] = useState('');

  // Upload flow state
  const [selectedSituationId, setSelectedSituationId] = useState<string>('');
  const [newSituationName, setNewSituationName] = useState('');
  const [newSituationMonth, setNewSituationMonth] = useState(new Date().getMonth() + 1);
  const [newSituationYear, setNewSituationYear] = useState(new Date().getFullYear());
  const [createNew, setCreateNew] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [parsedData, setParsedData] = useState<ParsedSheetData | null>(null);
  const [currentSheetId, setCurrentSheetId] = useState<string | null>(null);

  // View state
  const [viewSituation, setViewSituation] = useState<ConstructionLogSituation | null>(null);

  useEffect(() => {
    if (projectId) {
      loadBillItems(projectId);
      loadSituations(projectId);
      loadPositions(projectId);
    }
  }, [projectId, loadBillItems, loadSituations, loadPositions]);

  const resetUploadFlow = () => {
    setUploadStep('select-situation');
    setSelectedSituationId('');
    setNewSituationName('');
    setCreateNew(false);
    setSelectedFiles([]);
    setParsedData(null);
    setCurrentSheetId(null);
    setParseProgress('');
  };

  const openUploadDialog = () => {
    resetUploadFlow();
    setUploadDialogOpen(true);
  };

  const handleNextFromSituation = async () => {
    if (createNew) {
      if (!newSituationName || !projectId) return;
      const sit = await addSituation(projectId, {
        name: newSituationName,
        month: newSituationMonth,
        year: newSituationYear,
      });
      if (sit) setSelectedSituationId(sit.id);
      else return;
    }
    if (!selectedSituationId && !createNew) return;
    setUploadStep('upload-files');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(files);
  };

  const handleParse = async () => {
    if (selectedFiles.length === 0) return;
    setUploadStep('parsing');

    const file = selectedFiles[0];
    const isExcel = /\.(xlsx?|xls)$/i.test(file.name);
    const isPdf = /\.pdf$/i.test(file.name);

    try {
      // Create sheet record
      const situationId = selectedSituationId || (createNew ? situations[situations.length - 1]?.id : '');
      const sheet = await addSheet(situationId, {
        fileName: file.name,
        fileType: isExcel ? 'excel' : 'pdf',
      });
      if (sheet) setCurrentSheetId(sheet.id);

      // Upload file to storage
      if (projectId) {
        const path = `${projectId}/${situationId}/${file.name}`;
        await supabase.storage.from('construction-logs').upload(path, file, { upsert: true });
        if (sheet) {
          await updateSheet(sheet.id, { status: 'previewed' });
        }
      }

      let result: ParsedSheetData;
      if (isExcel) {
        result = await parseConstructionLogExcel(file, billItems, setParseProgress);
      } else if (isPdf) {
        result = await parseConstructionLogPDF(file, billItems, setParseProgress);
      } else {
        throw new Error('Nepodržani format fajla. Koristite .xlsx, .xls ili .pdf');
      }

      setParsedData(result);
      if (sheet) {
        await updateSheet(sheet.id, { parsedData: result });
      }
      setUploadStep('preview');
    } catch (err: any) {
      alert(err.message || 'Greška pri parsiranju fajla');
      setUploadStep('upload-files');
    }
  };

  const handleConfirmPositions = async (
    confirmedRows: { sheetName: string; row: ParsedLogRow }[]
  ) => {
    if (!projectId) return;
    setUploadStep('saving');

    const situationId = selectedSituationId || situations[situations.length - 1]?.id;

    // Compute cumulative quantities
    const previousPositions = positions.filter((p) => p.situationId !== situationId);

    const newPositions = confirmedRows.map((cr) => {
      const prevCum = previousPositions
        .filter((p) => p.billItemId === cr.row.matchedBillItemId)
        .reduce((sum, p) => sum + p.quantityThisPeriod, 0);

      return {
        projectId,
        billItemId: cr.row.matchedBillItemId,
        situationId,
        sheetId: currentSheetId,
        sheetName: cr.sheetName,
        detectedPosition: cr.row.detectedPosition,
        description: cr.row.description,
        unitUploaded: cr.row.unit,
        unitPriceUploaded: cr.row.unitPrice,
        quantityThisPeriod: cr.row.quantity,
        quantityCumulative: prevCum + cr.row.quantity,
        matchStatus: cr.row.userAction === 'skip'
          ? 'skipped' as const
          : cr.row.matchedBillItemId
            ? (cr.row.matchConfidence === 'high' ? 'auto' as const : 'manual' as const)
            : 'unmatched' as const,
      };
    });

    await savePositions(newPositions);

    // Run validation
    const currentPositions = newPositions.map((p, i) => ({
      ...p,
      id: `temp-${i}`,
      createdAt: new Date().toISOString(),
    }));
    const validationResults = validateLogPositions(currentPositions, billItems, previousPositions);

    if (currentSheetId) {
      await updateSheet(currentSheetId, {
        validationResults,
        status: 'confirmed',
      });
    }

    // Update situation status
    if (validationResults.some((v) => v.severity === 'error')) {
      await updateSituationStatus(situationId, 'confirmed');
    } else {
      await updateSituationStatus(situationId, 'validated');
    }

    // Reload data
    await loadPositions(projectId);
    await loadSituations(projectId);

    setUploadStep('done');
    setTimeout(() => {
      setUploadDialogOpen(false);
      resetUploadFlow();
    }, 1500);
  };

  // Compute trackers
  const trackers = computePositionTrackers(billItems, positions);

  // Gather all validation issues from all sheets
  const allValidationIssues: LogValidationIssue[] = situations.flatMap((sit) =>
    sit.sheets.flatMap((sh) => sh.validationResults || [])
  );

  const errorCount = allValidationIssues.filter((i) => i.severity === 'error').length;
  const warningCount = allValidationIssues.filter((i) => i.severity === 'warning').length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
        <h1 className="text-xl lg:text-2xl font-bold">Gradjevinska knjiga</h1>
        <Button onClick={openUploadDialog}>
          <Upload className="h-4 w-4 mr-2" />
          Upload knjige
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="tracker">Pregled pozicija</TabsTrigger>
          <TabsTrigger value="validation">
            Validacija
            {(errorCount > 0 || warningCount > 0) && (
              <Badge
                variant={errorCount > 0 ? 'destructive' : 'warning'}
                className="ml-2 text-[10px] px-1.5 py-0"
              >
                {errorCount + warningCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">Istorija ({situations.length})</TabsTrigger>
        </TabsList>

        {/* Tab 1: Position Tracker */}
        <TabsContent value="tracker">
          {billItems.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">
                  Predmjer radova je prazan. Prvo unesite stavke u sekciji "Predmjer radova"
                  da bi sistem mogao uporediti upload-ovane količine.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Poz.</TableHead>
                    <TableHead>Opis</TableHead>
                    <TableHead className="w-16">Jed.</TableHead>
                    <TableHead className="w-24 text-right">Predmjer</TableHead>
                    <TableHead className="w-24 text-right">Do sad</TableHead>
                    <TableHead className="w-24 text-right">Ovaj mj.</TableHead>
                    <TableHead className="w-24 text-right">Preostalo</TableHead>
                    <TableHead className="w-20 text-right">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trackers.map((t) => (
                    <TableRow
                      key={t.billItemId}
                      className={
                        t.status === 'exceeded'
                          ? 'bg-red-50 dark:bg-red-950/20'
                          : t.status === 'warning'
                            ? 'bg-orange-50 dark:bg-orange-950/20'
                            : t.quantityTotal > 0
                              ? 'bg-green-50 dark:bg-green-950/20'
                              : ''
                      }
                    >
                      <TableCell className="font-mono">{t.ordinal}</TableCell>
                      <TableCell className="max-w-xs truncate text-sm">{t.description}</TableCell>
                      <TableCell className="text-sm">{t.unit}</TableCell>
                      <TableCell className="text-right">{t.quantityFromPredmjer}</TableCell>
                      <TableCell className="text-right">{t.quantityCumulativePrevious || '-'}</TableCell>
                      <TableCell className="text-right">{t.quantityThisPeriod || '-'}</TableCell>
                      <TableCell className="text-right">
                        {t.quantityRemaining < 0 ? (
                          <span className="text-destructive font-medium">{t.quantityRemaining}</span>
                        ) : (
                          t.quantityRemaining
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={
                            t.status === 'exceeded'
                              ? 'text-destructive font-bold'
                              : t.status === 'warning'
                                ? 'text-orange-600 font-medium'
                                : ''
                          }
                        >
                          {t.percentComplete}%
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Tab 2: Validation Report */}
        <TabsContent value="validation">
          {allValidationIssues.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <p className="text-muted-foreground">
                  {situations.length === 0
                    ? 'Još niste upload-ovali nijednu građevinsku knjigu. Kliknite "Upload knjige" da počnete.'
                    : 'Sve pozicije su ispravne. Nema neslaganja sa predmjerom.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {/* Errors first */}
              {allValidationIssues
                .filter((i) => i.severity === 'error')
                .map((issue, idx) => (
                  <Card key={`err-${idx}`} className="border-destructive/50">
                    <CardContent className="py-3 flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="destructive" className="text-[10px]">
                            {issue.category === 'position_not_found' ? 'Pozicija ne postoji' : 'Količina prekoračena'}
                          </Badge>
                          <span className="text-sm font-mono">Poz. {issue.detectedPosition}</span>
                        </div>
                        <p className="text-sm">{issue.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Vrijednost: {issue.details.uploaded} | Očekivano: {issue.details.expected}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}

              {/* Warnings */}
              {allValidationIssues
                .filter((i) => i.severity === 'warning')
                .map((issue, idx) => (
                  <Card key={`warn-${idx}`} className="border-orange-300/50">
                    <CardContent className="py-3 flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="warning" className="text-[10px]">
                            {issue.category === 'price_mismatch'
                              ? 'Neslaganje cijene'
                              : issue.category === 'wrong_unit'
                                ? 'Pogrešna jedinica'
                                : 'Upozorenje'}
                          </Badge>
                          <span className="text-sm font-mono">Poz. {issue.detectedPosition}</span>
                        </div>
                        <p className="text-sm">{issue.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Vrijednost: {issue.details.uploaded} | Očekivano: {issue.details.expected}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}
        </TabsContent>

        {/* Tab 3: Situation History */}
        <TabsContent value="history">
          {situations.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">
                  Još niste upload-ovali nijednu građevinsku knjigu.
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Pripremite Excel ili PDF fajl sa obračunatim količinama i kliknite dugme ispod.
                </p>
                <Button className="mt-4" onClick={openUploadDialog}>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload prve knjige
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {situations.map((sit) => {
                const sitPositions = positions.filter((p) => p.situationId === sit.id);
                const sheetErrors = sit.sheets.flatMap((sh) =>
                  (sh.validationResults || []).filter((v) => v.severity === 'error')
                );
                const sheetWarnings = sit.sheets.flatMap((sh) =>
                  (sh.validationResults || []).filter((v) => v.severity === 'warning')
                );

                return (
                  <Card key={sit.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <CardTitle className="text-base">{sit.name}</CardTitle>
                          <Badge
                            variant={
                              sit.status === 'validated'
                                ? 'success'
                                : sit.status === 'confirmed'
                                  ? 'warning'
                                  : 'secondary'
                            }
                          >
                            {sit.status === 'validated'
                              ? 'Validirano'
                              : sit.status === 'confirmed'
                                ? 'Sa greškama'
                                : 'Draft'}
                          </Badge>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setViewSituation(sit)}
                            title="Pogledaj detalje"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm('Obrisati ovu situaciju i sve povezane podatke?')) {
                                deleteSituation(sit.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                        <div>
                          <span className="text-muted-foreground">Period:</span>{' '}
                          {sit.month ? `${MONTHS[sit.month - 1]} ${sit.year}` : '-'}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Pozicija:</span>{' '}
                          {sitPositions.length}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Fajlovi:</span>{' '}
                          {sit.sheets.length}
                        </div>
                        <div>
                          {sheetErrors.length > 0 && (
                            <Badge variant="destructive" className="mr-1 text-[10px]">
                              {sheetErrors.length} grešaka
                            </Badge>
                          )}
                          {sheetWarnings.length > 0 && (
                            <Badge variant="warning" className="text-[10px]">
                              {sheetWarnings.length} upozorenja
                            </Badge>
                          )}
                          {sheetErrors.length === 0 && sheetWarnings.length === 0 && sitPositions.length > 0 && (
                            <Badge variant="success" className="text-[10px] bg-green-600">OK</Badge>
                          )}
                        </div>
                      </div>
                      {sit.sheets.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {sit.sheets.map((sh) => (
                            <div
                              key={sh.id}
                              className="flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded"
                            >
                              {sh.fileType === 'excel' ? (
                                <FileSpreadsheet className="h-3 w-3 text-green-600" />
                              ) : (
                                <FileText className="h-3 w-3 text-red-500" />
                              )}
                              {sh.fileName}
                            </div>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        Kreirano: {formatDate(sit.createdAt)}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={(open) => { if (!open) resetUploadFlow(); setUploadDialogOpen(open); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {uploadStep === 'select-situation' && 'Korak 1: Za koji period upload-ujete knjigu?'}
              {uploadStep === 'upload-files' && 'Korak 2: Izaberite fajl građevinske knjige'}
              {uploadStep === 'parsing' && 'Čitanje fajla...'}
              {uploadStep === 'saving' && 'Čuvanje i provjera...'}
              {uploadStep === 'done' && 'Upload završen!'}
            </DialogTitle>
          </DialogHeader>

          {uploadStep === 'select-situation' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Izaberite mjesečnu situaciju za koju upload-ujete obračun, ili kreirajte novu.
              </p>

              {situations.length > 0 && !createNew && (
                <div>
                  <Label>Dodaj u postojeću situaciju</Label>
                  <Select
                    value={selectedSituationId}
                    onChange={(e) => setSelectedSituationId(e.target.value)}
                  >
                    <option value="">Izaberite situaciju...</option>
                    {situations.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.month ? `(${MONTHS[s.month - 1]} ${s.year})` : ''}
                      </option>
                    ))}
                  </Select>
                </div>
              )}

              {!createNew && (
                <Button variant="outline" className="w-full" onClick={() => setCreateNew(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Kreiraj novu situaciju
                </Button>
              )}

              {createNew && (
                <div className="space-y-3 border rounded-lg p-3">
                  <div>
                    <Label>Naziv situacije *</Label>
                    <Input
                      value={newSituationName}
                      onChange={(e) => setNewSituationName(e.target.value)}
                      placeholder="Npr. Situacija 1 - Januar 2026"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Mjesec</Label>
                      <Select
                        value={newSituationMonth}
                        onChange={(e) => setNewSituationMonth(parseInt(e.target.value))}
                      >
                        {MONTHS.map((m, i) => (
                          <option key={i} value={i + 1}>{m}</option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label>Godina</Label>
                      <Input
                        type="number"
                        value={newSituationYear}
                        onChange={(e) => setNewSituationYear(parseInt(e.target.value))}
                      />
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setCreateNew(false)}>
                    Otkaži
                  </Button>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
                  Otkaži
                </Button>
                <Button
                  onClick={handleNextFromSituation}
                  disabled={!createNew && !selectedSituationId}
                >
                  Dalje
                </Button>
              </DialogFooter>
            </div>
          )}

          {uploadStep === 'upload-files' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Upload-ujte Excel ili PDF fajl sa popunjenom građevinskom knjigom.
                Sistem će automatski pročitati pozicije i uporediti ih sa predmjerom.
              </p>
              <div>
                <Label>Fajl građevinske knjige</Label>
                <div className="mt-2 border-2 border-dashed rounded-lg p-6 text-center">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <input
                    type="file"
                    accept=".xlsx,.xls,.pdf"
                    onChange={handleFileChange}
                    className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Podržani formati: Excel (.xlsx, .xls) ili PDF
                  </p>
                </div>
              </div>

              {selectedFiles.length > 0 && (
                <div className="flex items-center gap-2 text-sm bg-muted p-2 rounded">
                  {/\.(xlsx?|xls)$/i.test(selectedFiles[0].name) ? (
                    <FileSpreadsheet className="h-4 w-4 text-green-600" />
                  ) : (
                    <FileText className="h-4 w-4 text-red-500" />
                  )}
                  {selectedFiles[0].name}
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setUploadStep('select-situation')}>
                  Nazad
                </Button>
                <Button onClick={handleParse} disabled={selectedFiles.length === 0}>
                  Pročitaj fajl
                </Button>
              </DialogFooter>
            </div>
          )}

          {uploadStep === 'parsing' && (
            <div className="py-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-sm text-muted-foreground">{parseProgress || 'Čitam podatke iz fajla...'}</p>
              <p className="text-xs text-muted-foreground mt-2">Molimo sačekajte, ovo može potrajati par sekundi.</p>
            </div>
          )}

          {uploadStep === 'saving' && (
            <div className="py-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-sm text-muted-foreground">Čuvam podatke i provjeravam sa predmjerom...</p>
            </div>
          )}

          {uploadStep === 'done' && (
            <div className="py-8 text-center">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
              <p className="font-medium">Knjiga uspješno upload-ovana!</p>
              <p className="text-sm text-muted-foreground mt-1">Pogledajte rezultate u tabovima "Pregled pozicija" i "Validacija".</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      {parsedData && (
        <LogSheetPreview
          open={uploadStep === 'preview'}
          onOpenChange={(open) => {
            if (!open) {
              setUploadStep('upload-files');
              setParsedData(null);
            }
          }}
          parsedData={parsedData}
          billItems={billItems}
          onConfirm={handleConfirmPositions}
        />
      )}

      {/* View Situation Details Dialog */}
      <Dialog open={!!viewSituation} onOpenChange={(open) => { if (!open) setViewSituation(null); }}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewSituation?.name}</DialogTitle>
          </DialogHeader>
          {viewSituation && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Period:</span>{' '}
                  {viewSituation.month
                    ? `${MONTHS[viewSituation.month - 1]} ${viewSituation.year}`
                    : '-'}
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>{' '}
                  <Badge
                    variant={
                      viewSituation.status === 'validated' ? 'success' : viewSituation.status === 'confirmed' ? 'warning' : 'secondary'
                    }
                  >
                    {viewSituation.status === 'validated' ? 'Validirano' : viewSituation.status === 'confirmed' ? 'Sa greškama' : 'Draft'}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Fajlovi:</span>{' '}
                  {viewSituation.sheets.map((s) => s.fileName).join(', ')}
                </div>
              </div>

              <h3 className="font-medium">Pozicije</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Poz.</TableHead>
                    <TableHead>Opis</TableHead>
                    <TableHead>Jed.</TableHead>
                    <TableHead className="text-right">Cijena</TableHead>
                    <TableHead className="text-right">Količina</TableHead>
                    <TableHead>Match</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {positions
                    .filter((p) => p.situationId === viewSituation.id)
                    .map((pos) => {
                      const billItem = billItems.find((b) => b.id === pos.billItemId);
                      return (
                        <TableRow key={pos.id}>
                          <TableCell className="font-mono">{pos.detectedPosition}</TableCell>
                          <TableCell className="max-w-xs truncate text-sm">{pos.description}</TableCell>
                          <TableCell>{pos.unitUploaded}</TableCell>
                          <TableCell className="text-right">{formatCurrency(pos.unitPriceUploaded)}</TableCell>
                          <TableCell className="text-right">{pos.quantityThisPeriod}</TableCell>
                          <TableCell>
                            {pos.matchStatus === 'skipped' ? (
                              <Badge variant="secondary">Preskočeno</Badge>
                            ) : billItem ? (
                              <Badge variant="success" className="bg-green-600">Poz. {billItem.ordinal}</Badge>
                            ) : (
                              <Badge variant="destructive">Nije</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>

              {/* Validation issues for this situation */}
              {viewSituation.sheets.some((s) => s.validationResults && s.validationResults.length > 0) && (
                <>
                  <h3 className="font-medium">Validacione greške</h3>
                  <div className="space-y-2">
                    {viewSituation.sheets.flatMap((sh) =>
                      (sh.validationResults || []).map((issue, idx) => (
                        <div
                          key={idx}
                          className={`flex items-center gap-2 text-sm p-2 rounded ${
                            issue.severity === 'error' ? 'bg-red-50 dark:bg-red-950/20' : 'bg-orange-50 dark:bg-orange-950/20'
                          }`}
                        >
                          {issue.severity === 'error' ? (
                            <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
                          )}
                          {issue.message}
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
