import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';
import { usePredmjerFileStore } from '@/store/usePredmjerFileStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { FileUpload } from '@/components/shared/FileUpload';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import {
  Download, Trash2, Eye, Search, Upload, Loader2,
  FileSpreadsheet, FileText, Image, FileIcon,
} from 'lucide-react';
import { formatDate, formatFileSize } from '@/lib/utils';
import type { PredmjerFile } from '@/types';

const fileTypeConfig: Record<string, { icon: typeof FileText; color: string; label: string }> = {
  pdf: { icon: FileText, color: 'text-red-500', label: 'PDF' },
  excel: { icon: FileSpreadsheet, color: 'text-green-600', label: 'Excel' },
  word: { icon: FileText, color: 'text-blue-600', label: 'Word' },
  image: { icon: Image, color: 'text-purple-500', label: 'Slika' },
  other: { icon: FileIcon, color: 'text-gray-500', label: 'Fajl' },
};

function FileTypeBadge({ fileType }: { fileType: string }) {
  const config = fileTypeConfig[fileType] || fileTypeConfig.other;
  return (
    <Badge variant="outline" className="gap-1">
      <config.icon className={`h-3 w-3 ${config.color}`} />
      {config.label}
    </Badge>
  );
}

export default function BillOfQuantities() {
  const { projectId } = useParams();
  const { files, loading, loadFiles, addFile, deleteFile, getFile, getSignedUrl } = usePredmjerFileStore();

  const [search, setSearch] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  // Preview state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<PredmjerFile | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (projectId) loadFiles(projectId);
  }, [projectId, loadFiles]);

  const filtered = files.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleConfirmUpload = async () => {
    if (!projectId || pendingFiles.length === 0) return;
    setUploading(true);
    for (const file of pendingFiles) {
      await addFile(projectId, file, description);
    }
    setUploading(false);
    setUploadOpen(false);
    setDescription('');
    setPendingFiles([]);
  };

  const handlePreview = async (file: PredmjerFile) => {
    setPreviewFile(file);
    setPreviewError(null);
    setPreviewUrl(null);
    setPreviewLoading(true);
    setPreviewOpen(true);

    // For native mobile: download and open with system app
    if (Capacitor.isNativePlatform()) {
      try {
        const blob = await getFile(file.id);
        if (!blob) {
          setPreviewLoading(false);
          setPreviewError('Nije moguće preuzeti fajl');
          return;
        }
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
          };
          reader.readAsDataURL(blob);
        });
        const saved = await Filesystem.writeFile({
          path: file.fileName,
          data: base64,
          directory: Directory.Cache,
        });
        const mimeTypes: Record<string, string> = {
          pdf: 'application/pdf',
          excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          word: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          image: 'image/jpeg',
        };
        await FileOpener.open({
          filePath: saved.uri,
          contentType: mimeTypes[file.fileType] || 'application/octet-stream',
        });
      } catch (e: any) {
        setPreviewError(e.message || 'Greška pri otvaranju fajla');
      }
      setPreviewLoading(false);
      setPreviewOpen(false);
      return;
    }

    // Web: inline preview for PDF and images, signed URL for others
    if (file.fileType === 'pdf' || file.fileType === 'image') {
      const blob = await getFile(file.id);
      if (!blob) {
        setPreviewLoading(false);
        setPreviewError('Nije moguće preuzeti fajl');
        return;
      }
      setPreviewUrl(URL.createObjectURL(blob));
      setPreviewLoading(false);
    } else {
      // Excel, Word, other — open signed URL in new tab
      const url = await getSignedUrl(file.id);
      if (url) {
        window.open(url, '_blank');
      } else {
        setPreviewError('Nije moguće generisati URL za pregled');
      }
      setPreviewLoading(false);
      setPreviewOpen(false);
    }
  };

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewFile(null);
    setPreviewOpen(false);
    setPreviewError(null);
  };

  const handleDownload = async (file: PredmjerFile) => {
    const blob = await getFile(file.id);
    if (blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.fileName;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
        <h1 className="text-xl lg:text-2xl font-bold">Predmjer radova</h1>
        <Button onClick={() => setUploadOpen(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Upload
        </Button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Pretraži fajlove..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? (
        <div className="py-12 text-center">
          <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Učitavam fajlove...</p>
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Nema uploadovanih fajlova</p>
            <p className="text-sm text-muted-foreground mt-1">
              Uploadujte PDF, Excel, Word ili slike predmjera
            </p>
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
                  <TableHead>Veličina</TableHead>
                  <TableHead>Opis</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead className="text-right">Akcije</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((file) => (
                  <TableRow key={file.id}>
                    <TableCell className="font-medium">{file.name}</TableCell>
                    <TableCell>
                      <FileTypeBadge fileType={file.fileType} />
                    </TableCell>
                    <TableCell>{formatFileSize(file.fileSize)}</TableCell>
                    <TableCell className="text-muted-foreground max-w-48 truncate">
                      {file.description || '—'}
                    </TableCell>
                    <TableCell>{formatDate(file.uploadedAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handlePreview(file)} title="Pregled">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDownload(file)} title="Preuzmi">
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteFile(file.id)} title="Obriši">
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
            {filtered.map((file) => (
              <Card key={file.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-medium text-sm leading-tight">{file.name}</h3>
                    <FileTypeBadge fileType={file.fileType} />
                  </div>
                  {file.description && (
                    <p className="text-xs text-muted-foreground mb-2">{file.description}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                    <span>{formatFileSize(file.fileSize)}</span>
                    <span>{formatDate(file.uploadedAt)}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={() => handlePreview(file)}>
                      <Eye className="h-3.5 w-3.5 mr-1" /> Pregled
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDownload(file)}>
                      <Download className="h-3.5 w-3.5 mr-1" /> Preuzmi
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteFile(file.id)}>
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
            <DialogTitle>Upload predmjera</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Opis (opciono)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <FileUpload
              onFilesSelected={setPendingFiles}
              accept=".pdf,.xlsx,.xls,.doc,.docx,.jpg,.jpeg,.png,.webp"
              multiple
              label="Prevucite PDF, Excel, Word ili slike ovdje"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setUploadOpen(false); setPendingFiles([]); setDescription(''); }}>
              Otkaži
            </Button>
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
              {previewFile && (
                <>
                  {(() => {
                    const config = fileTypeConfig[previewFile.fileType] || fileTypeConfig.other;
                    const Icon = config.icon;
                    return <Icon className={`h-5 w-5 ${config.color}`} />;
                  })()}
                  {previewFile.name}
                  <FileTypeBadge fileType={previewFile.fileType} />
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {/* PDF Preview */}
          {previewUrl && previewFile?.fileType === 'pdf' && (
            <iframe src={previewUrl} className="w-full flex-1 min-h-[65vh] rounded border" title="PDF Preview" />
          )}

          {/* Image Preview */}
          {previewUrl && previewFile?.fileType === 'image' && (
            <div className="flex-1 min-h-[50vh] flex items-center justify-center overflow-auto">
              <img src={previewUrl} alt={previewFile.name} className="max-w-full max-h-[70vh] object-contain rounded" />
            </div>
          )}

          {/* Loading */}
          {previewLoading && (
            <div className="flex-1 min-h-[40vh] flex flex-col items-center justify-center">
              <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
              <p className="font-medium">Učitavam pregled...</p>
            </div>
          )}

          {/* Error */}
          {previewError && !previewLoading && (
            <div className="flex-1 min-h-[40vh] flex flex-col items-center justify-center bg-muted/30 rounded-lg border border-dashed p-8">
              <FileIcon className="h-12 w-12 text-destructive mb-4" />
              <p className="font-medium text-destructive mb-2">Greška pri učitavanju</p>
              <p className="text-sm text-muted-foreground text-center mb-4">{previewError}</p>
              {previewFile && (
                <Button onClick={() => handleDownload(previewFile)}>
                  <Download className="h-4 w-4 mr-2" />
                  Preuzmi
                </Button>
              )}
            </div>
          )}

          <DialogFooter>
            {previewFile && (
              <Button variant="outline" onClick={() => handleDownload(previewFile)}>
                <Download className="h-4 w-4 mr-2" />
                Preuzmi
              </Button>
            )}
            <Button variant="outline" onClick={closePreview}>Zatvori</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
