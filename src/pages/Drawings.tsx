import { useEffect, useState, lazy, Suspense } from 'react';
import { useParams } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';
import { useDrawingStore } from '@/store/useDrawingStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { FileUpload } from '@/components/shared/FileUpload';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import {
  Download, Trash2, Eye, Search, FileText, Upload, FileBox,
  Loader2, Settings, CheckCircle,
} from 'lucide-react';
import { formatDate, formatFileSize } from '@/lib/utils';
import type { Drawing } from '@/types';

const DxfViewer = lazy(() =>
  import('@/components/shared/DxfViewer').then((m) => ({ default: m.DxfViewer }))
);

export default function Drawings() {
  const { projectId } = useParams();
  const { drawings, loadDrawings, addDrawing, deleteDrawing, getDrawingFile } = useDrawingStore();
  const { backendUrl, setBackendUrl, loadSettings } = useSettingsStore();
  const [search, setSearch] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  // Preview state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDrawing, setPreviewDrawing] = useState<Drawing | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Settings
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tempBackendUrl, setTempBackendUrl] = useState('');

  useEffect(() => {
    if (projectId) loadDrawings(projectId);
    loadSettings();
  }, [projectId, loadDrawings, loadSettings]);

  const filtered = drawings.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleConfirmUpload = async () => {
    if (!projectId || pendingFiles.length === 0) return;
    setUploading(true);
    for (const file of pendingFiles) {
      await addDrawing(projectId, file, description);
    }
    setUploading(false);
    setUploadOpen(false);
    setDescription('');
    setPendingFiles([]);
  };

  const handlePreview = async (id: string) => {
    const drawing = drawings.find((d) => d.id === id);
    if (!drawing) return;

    setPreviewDrawing(drawing);
    setPreviewError(null);
    setPreviewUrl(null);
    setPreviewBlob(null);
    setPreviewLoading(true);
    setPreviewOpen(true);

    if (drawing.fileType === 'dwg') {
      // On native mobile: download to cache and open with FileOpener (DWG FastView etc.)
      // On web: fallback to window.open with signed URL
      if (Capacitor.isNativePlatform()) {
        try {
          const blob = await getDrawingFile(id);
          if (!blob) {
            setPreviewLoading(false);
            setPreviewError('Nije moguće preuzeti fajl');
            return;
          }
          // Convert blob to base64
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
              const result = reader.result as string;
              resolve(result.split(',')[1]);
            };
            reader.readAsDataURL(blob);
          });
          // Write to cache directory
          const fileName = drawing.fileName || `${drawing.name}.dwg`;
          const saved = await Filesystem.writeFile({
            path: fileName,
            data: base64,
            directory: Directory.Cache,
          });
          // Open with system file opener — OS will offer DWG FastView
          await FileOpener.open({
            filePath: saved.uri,
            contentType: 'application/acad',
          });
        } catch (e: any) {
          console.error('[DWG open]', e);
          setPreviewError(e.message || 'Greška pri otvaranju fajla');
        }
      } else if ((window as any).electronAPI?.isElectron) {
        // Electron desktop: open DWG with system app (AutoCAD)
        try {
          const blob = await getDrawingFile(id);
          if (!blob) {
            setPreviewLoading(false);
            setPreviewError('Nije moguće preuzeti fajl');
            return;
          }
          const fileName = drawing.fileName || `${drawing.name}.dwg`;
          const buffer = await blob.arrayBuffer();
          const result = await (window as any).electronAPI.openFileWithSystem(buffer, fileName);
          if (!result.success) {
            setPreviewError(result.error || 'Greška pri otvaranju fajla');
          }
        } catch (e: any) {
          setPreviewError(e.message || 'Greška pri otvaranju fajla');
        }
      } else {
        // Web browser: download .dwg file
        const blob = await getDrawingFile(id);
        if (!blob) {
          setPreviewLoading(false);
          setPreviewError('Nije moguće preuzeti fajl');
          return;
        }
        const fileName = drawing.fileName || `${drawing.name}.dwg`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      setPreviewLoading(false);
      setPreviewOpen(false);
      setPreviewDrawing(null);
      return;
    } else {
      const blob = await getDrawingFile(id);
      if (!blob) {
        setPreviewLoading(false);
        setPreviewError('Nije moguće preuzeti fajl');
        return;
      }
      if (drawing.fileType === 'pdf') {
        setPreviewUrl(URL.createObjectURL(blob));
      } else if (drawing.fileType === 'dxf') {
        setPreviewBlob(blob);
      }
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewBlob(null);
    setPreviewDrawing(null);
    setPreviewOpen(false);
    setPreviewError(null);
  };

  const handleDownload = async (id: string, fileName: string) => {
    const blob = await getDrawingFile(id);
    if (blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleSaveSettings = () => {
    setBackendUrl(tempBackendUrl);
    setSettingsOpen(false);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
        <h1 className="text-xl lg:text-2xl font-bold">Crtezi i planovi</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => { setTempBackendUrl(backendUrl); setSettingsOpen(true); }}>
            <Settings className="h-4 w-4" />
          </Button>
          <Button onClick={() => setUploadOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Upload
          </Button>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Pretrazi crteze..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Nema uploadovanih crteza</p>
          </CardContent>
        </Card>
      ) : (
        <>
        {/* Desktop table */}
        <Card className="hidden lg:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Naziv</TableHead>
                <TableHead>Tip</TableHead>
                <TableHead>Velicina</TableHead>
                <TableHead>Verzija</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead className="text-right">Akcije</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((drawing) => (
                <TableRow key={drawing.id}>
                  <TableCell className="font-medium">{drawing.name}</TableCell>
                  <TableCell>
                    <Badge variant={drawing.fileType === 'dwg' ? 'secondary' : drawing.fileType === 'dxf' ? 'outline' : 'default'}>
                      {drawing.fileType.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatFileSize(drawing.fileSize)}</TableCell>
                  <TableCell>v{drawing.version}</TableCell>
                  <TableCell>{formatDate(drawing.uploadedAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handlePreview(drawing.id)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDownload(drawing.id, drawing.fileName)}>
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteDrawing(drawing.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        {/* Mobile cards */}
        <div className="space-y-3 lg:hidden">
          {filtered.map((drawing) => (
            <Card key={drawing.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-medium text-sm leading-tight">{drawing.name}</h3>
                  <Badge variant={drawing.fileType === 'dwg' ? 'secondary' : drawing.fileType === 'dxf' ? 'outline' : 'default'}>
                    {drawing.fileType.toUpperCase()}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                  <span>{formatFileSize(drawing.fileSize)}</span>
                  <span>v{drawing.version}</span>
                  <span>{formatDate(drawing.uploadedAt)}</span>
                </div>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => handlePreview(drawing.id)}>
                    <Eye className="h-3.5 w-3.5 mr-1" /> Pregled
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDownload(drawing.id, drawing.fileName)}>
                    <Download className="h-3.5 w-3.5 mr-1" /> Preuzmi
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteDrawing(drawing.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        </>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={(open) => { if (!open) { setUploadOpen(false); setPendingFiles([]); setDescription(''); } }}>
        <DialogContent onClose={() => { setUploadOpen(false); setPendingFiles([]); setDescription(''); }}>
          <DialogHeader>
            <DialogTitle>Upload crteza</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Opis (opciono)" value={description} onChange={(e) => setDescription(e.target.value)} />
            <FileUpload
              onFilesSelected={setPendingFiles}
              accept=".pdf,.dwg,.dxf"
              multiple
              label="Prevucite PDF, DWG ili DXF fajlove ovdje"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setUploadOpen(false); setPendingFiles([]); setDescription(''); }}>Otkazi</Button>
            <Button onClick={handleConfirmUpload} disabled={pendingFiles.length === 0 || uploading}>
              {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              {uploading ? 'Uploadujem...' : `Upload (${pendingFiles.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={(open) => { if (!open) closePreview(); }}>
        <DialogContent onClose={closePreview} className="max-w-5xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {previewDrawing?.fileType === 'dwg' && <FileBox className="h-5 w-5 text-orange-500" />}
              {previewDrawing?.fileType === 'dxf' && <FileBox className="h-5 w-5 text-blue-500" />}
              {previewDrawing?.fileType === 'pdf' && <FileText className="h-5 w-5 text-red-500" />}
              {previewDrawing?.name}
              <Badge variant="outline" className="ml-2">{previewDrawing?.fileType.toUpperCase()}</Badge>
            </DialogTitle>
          </DialogHeader>

          {/* PDF Preview */}
          {previewUrl && previewDrawing?.fileType === 'pdf' && (
            <iframe src={previewUrl} className="w-full flex-1 min-h-[65vh] rounded border" title="PDF Preview" />
          )}

          {/* DXF Preview */}
          {previewBlob && !previewLoading && (
            <Suspense
              fallback={
                <div className="flex-1 min-h-[50vh] flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              }
            >
              <DxfViewer blob={previewBlob} className="flex-1 min-h-[50vh]" />
            </Suspense>
          )}

          {/* Loading spinner */}
          {previewLoading && (
            <div className="flex-1 min-h-[40vh] flex flex-col items-center justify-center">
              <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
              <p className="font-medium">Ucitavam pregled...</p>
            </div>
          )}

          {/* Error */}
          {previewError && !previewLoading && (
            <div className="flex-1 min-h-[40vh] flex flex-col items-center justify-center bg-muted/30 rounded-lg border border-dashed p-8">
              <FileBox className="h-12 w-12 text-destructive mb-4" />
              <p className="font-medium text-destructive mb-2">Greska pri ucitavanju</p>
              <p className="text-sm text-muted-foreground text-center mb-4">{previewError}</p>
              {previewDrawing && (
                <Button onClick={() => handleDownload(previewDrawing.id, previewDrawing.fileName)}>
                  <Download className="h-4 w-4 mr-2" />
                  Preuzmi
                </Button>
              )}
            </div>
          )}

          <DialogFooter>
            {previewDrawing && (
              <Button variant="outline" onClick={() => handleDownload(previewDrawing.id, previewDrawing.fileName)}>
                <Download className="h-4 w-4 mr-2" />
                Preuzmi
              </Button>
            )}
            <Button variant="outline" onClick={closePreview}>Zatvori</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Backend Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent onClose={() => setSettingsOpen(false)} className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Backend podesavanja
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Backend URL (Railway)</Label>
              <Input
                value={tempBackendUrl}
                onChange={(e) => setTempBackendUrl(e.target.value)}
                placeholder="https://ldgradnja-backend.up.railway.app"
              />
              <p className="text-xs text-muted-foreground mt-1">
                URL vaseg Railway servisa za konverziju DWG fajlova
              </p>
            </div>
            {backendUrl && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle className="h-4 w-4" />
                Backend je konfigurisan
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>Otkazi</Button>
            <Button onClick={handleSaveSettings}>Sacuvaj</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
