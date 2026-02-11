import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTaskStore } from '@/store/useTaskStore';
import { getStorageUrl } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Search, Trash2, Camera, Download } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export default function PhotoGallery() {
  const { projectId } = useParams();
  const { photos, loadPhotos, addPhoto, deletePhoto } = useTaskStore();
  const [search, setSearch] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [description, setDescription] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (projectId) loadPhotos(projectId);
  }, [projectId, loadPhotos]);

  useEffect(() => {
    const loadUrls = async () => {
      const urls: Record<string, string> = {};
      for (const photo of photos) {
        if (photo.filePath && !photoUrls[photo.id]) {
          const url = await getStorageUrl('photos', photo.filePath);
          if (url) urls[photo.id] = url;
        }
      }
      if (Object.keys(urls).length > 0) setPhotoUrls((prev) => ({ ...prev, ...urls }));
    };
    loadUrls();
  }, [photos]);

  const filtered = photos.filter((p) =>
    (p.description || '').toLowerCase().includes(search.toLowerCase()) ||
    p.date.includes(search)
  );

  const groupedByDate = filtered.reduce((acc, photo) => {
    const date = photo.date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(photo);
    return acc;
  }, {} as Record<string, typeof filtered>);

  const handleUpload = async () => {
    if (!projectId || selectedFiles.length === 0) return;
    for (const file of selectedFiles) {
      await addPhoto(projectId, file, description);
    }
    setUploadOpen(false);
    setSelectedFiles([]);
    setDescription('');
  };

  const handlePreview = (photo: typeof photos[0]) => {
    const url = photoUrls[photo.id];
    if (url) setPreviewUrl(url);
  };

  const handleDownload = (photo: typeof photos[0]) => {
    const url = photoUrls[photo.id];
    if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.download = photo.fileName;
      a.click();
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Fotografije</h1>
        <Button onClick={() => setUploadOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Upload fotografija
        </Button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Pretraži po opisu ili datumu..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Camera className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Nema fotografija</p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(groupedByDate)
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([date, datePhotos]) => (
            <div key={date} className="mb-6">
              <h3 className="text-lg font-semibold mb-3">{formatDate(date)}</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {datePhotos.map((photo) => (
                  <Card key={photo.id} className="overflow-hidden group">
                    <div
                      className="aspect-square bg-muted flex items-center justify-center cursor-pointer relative"
                      onClick={() => handlePreview(photo)}
                    >
                      {photoUrls[photo.id] ? (
                        <img
                          src={photoUrls[photo.id]}
                          alt={photo.description || photo.fileName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Camera className="h-8 w-8 text-muted-foreground" />
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <div className="flex gap-2">
                          <Button variant="secondary" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleDownload(photo); }}>
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button variant="destructive" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); deletePhoto(photo.id); }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    <CardContent className="p-3">
                      <p className="text-sm truncate">{photo.description || photo.fileName}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent onClose={() => setUploadOpen(false)}>
          <DialogHeader>
            <DialogTitle>Upload fotografija</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Opis</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Opis fotografija (opciono)" />
            </div>
            <div>
              <Label>Fotografije</Label>
              <Input type="file" accept="image/*" multiple onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))} />
            </div>
            {selectedFiles.length > 0 && (
              <p className="text-sm text-muted-foreground">Odabrano: {selectedFiles.length} fotografija</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Otkaži</Button>
            <Button onClick={handleUpload} disabled={selectedFiles.length === 0}>Upload</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent onClose={() => setPreviewUrl(null)} className="max-w-4xl">
          {previewUrl && <img src={previewUrl} alt="Preview" className="max-h-[80vh] object-contain mx-auto" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
