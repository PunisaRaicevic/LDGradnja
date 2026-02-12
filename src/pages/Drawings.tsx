import { useEffect, useState, lazy, Suspense } from 'react';
import { useParams } from 'react-router-dom';
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
  const { drawings, loadDrawings, addDrawing, deleteDrawing, getDrawingFile, getDrawingSignedUrl } = useDrawingStore();
  const { backendUrl, setBackendUrl, loadSettings } = useSettingsStore();
  const [search, setSearch] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [description, setDescription] = useState('');

  // Preview state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDrawing, setPreviewDrawing] = useState<Drawing | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [shareCADUrl, setShareCADUrl] = useState<string | null>(null);
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

  const handleUpload = async (files: File[]) => {
    if (!projectId) return;
    for (const file of files) {
      await addDrawing(projectId, file, description);
    }
    setUploadOpen(false);
    setDescription('');
  };

  const handlePreview = async (id: string) => {
    const drawing = drawings.find((d) => d.id === id);
    if (!drawing) return;
    setPreviewDrawing(drawing);
    setPreviewError(null);
    setPreviewUrl(null);
    setPreviewBlob(null);
    setShareCADUrl(null);
    setPreviewLoading(true);
    setPreviewOpen(true);

    if (drawing.fileType === 'pdf') {
      const blob = await getDrawingFile(id);
      if (!blob) {
        setPreviewLoading(false);
        setPreviewError('Nije moguće preuzeti fajl');
        return;
      }
      setPreviewUrl(URL.createObjectURL(blob));
      setPreviewLoading(false);
    } else if (drawing.fileType === 'dxf') {
      const blob = await getDrawingFile(id);
      if (!blob) {
        setPreviewLoading(false);
        setPreviewError('Nije moguće preuzeti fajl');
        return;
      }
      setPreviewBlob(blob);
      setPreviewLoading(false);
    } else if (drawing.fileType === 'dwg') {
      const signedUrl = await getDrawingSignedUrl(id);
      if (!signedUrl) {
        setPreviewLoading(false);
        setPreviewError('Nije moguće generisati URL za pregled');
        return;
      }
      setShareCADUrl(`https://sharecad.org/cadframe/load?url=${encodeURIComponent(signedUrl)}`);
      setPreviewLoading(false);
    } else {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewBlob(null);
    setShareCADUrl(null);
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Crtezi i planovi</h1>
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
        <Card>
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
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent onClose={() => setUploadOpen(false)}>
          <DialogHeader>
            <DialogTitle>Upload crteza</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Opis (opciono)" value={description} onChange={(e) => setDescription(e.target.value)} />
            <FileUpload
              onFilesSelected={handleUpload}
              accept=".pdf,.dwg,.dxf"
              multiple
              label="Prevucite PDF, DWG ili DXF fajlove ovdje"
            />
          </div>
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

          {/* DWG Preview via ShareCAD */}
          {shareCADUrl && !previewLoading && (
            <iframe
              src={shareCADUrl}
              className="w-full flex-1 min-h-[65vh] rounded border"
              title="DWG Preview (ShareCAD)"
              sandbox="allow-scripts allow-same-origin allow-popups"
            />
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
