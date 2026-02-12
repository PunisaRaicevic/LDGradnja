import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useContractStore } from '@/store/useContractStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Plus, Search, Trash2, FileSignature, Download, Calendar, DollarSign, User, FileText } from 'lucide-react';
import { formatCurrency, formatDate, getToday } from '@/lib/utils';
import { getStorageUrl } from '@/lib/supabase';
import type { Contract } from '@/types';

const emptyForm = {
  type: 'investor' as Contract['type'],
  contractNumber: '',
  date: getToday(),
  amount: 0,
  deadline: '',
  partyName: '',
  contactInfo: '',
  scopeOfWork: '',
  paymentTerms: '',
};

export default function Contracts() {
  const { projectId } = useParams();
  const { contracts, loadContracts, addContract, deleteContract } = useContractStore();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState<File | undefined>();
  const [activeTab, setActiveTab] = useState('investor');
  const [detailContract, setDetailContract] = useState<Contract | null>(null);
  const [detailPreviewUrl, setDetailPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (projectId) loadContracts(projectId);
  }, [projectId, loadContracts]);

  const investorContracts = contracts.filter((c) => c.type === 'investor' && c.partyName.toLowerCase().includes(search.toLowerCase()));
  const subContracts = contracts.filter((c) => c.type === 'subcontractor' && c.partyName.toLowerCase().includes(search.toLowerCase()));

  const handleSave = async () => {
    if (!projectId || !form.partyName || !form.contractNumber) return;
    await addContract({ ...form, projectId }, file);
    setDialogOpen(false);
    setForm(emptyForm);
    setFile(undefined);
  };

  const handleDownload = async (contract: Contract) => {
    if (contract.filePath) {
      const url = await getStorageUrl('contracts', contract.filePath);
      if (url) {
        const a = document.createElement('a');
        a.href = url;
        a.download = contract.fileName || 'ugovor';
        a.click();
      }
    }
  };

  const handleRowClick = async (contract: Contract) => {
    setDetailContract(contract);
    if (contract.filePath) {
      const url = await getStorageUrl('contracts', contract.filePath);
      setDetailPreviewUrl(url);
    } else {
      setDetailPreviewUrl(null);
    }
  };

  const openNew = (type: Contract['type']) => {
    setForm({ ...emptyForm, type });
    setDialogOpen(true);
  };

  const renderTable = (items: Contract[]) => (
    items.length === 0 ? (
      <Card>
        <CardContent className="py-12 text-center">
          <FileSignature className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Nema ugovora</p>
        </CardContent>
      </Card>
    ) : (
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Br. ugovora</TableHead>
              <TableHead>Strana</TableHead>
              <TableHead>Datum</TableHead>
              <TableHead className="text-right">Iznos</TableHead>
              <TableHead>Rok</TableHead>
              <TableHead>Kontakt</TableHead>
              <TableHead className="text-right">Akcije</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((contract) => (
              <TableRow key={contract.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleRowClick(contract)}>
                <TableCell className="font-medium">{contract.contractNumber}</TableCell>
                <TableCell>{contract.partyName}</TableCell>
                <TableCell>{formatDate(contract.date)}</TableCell>
                <TableCell className="text-right">{formatCurrency(contract.amount)}</TableCell>
                <TableCell>{contract.deadline ? formatDate(contract.deadline) : '-'}</TableCell>
                <TableCell className="max-w-32 truncate">{contract.contactInfo || '-'}</TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end gap-1">
                    {contract.fileName && (
                      <Button variant="ghost" size="icon" onClick={() => handleDownload(contract)}>
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => deleteContract(contract.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    )
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Ugovori i dokumentacija</h1>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Pretraži ugovore..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="investor">Investitori</TabsTrigger>
            <TabsTrigger value="subcontractor">Podizvođači</TabsTrigger>
          </TabsList>
          <Button onClick={() => openNew(activeTab as Contract['type'])}>
            <Plus className="h-4 w-4 mr-2" />
            Novi ugovor
          </Button>
        </div>
        <TabsContent value="investor">{renderTable(investorContracts)}</TabsContent>
        <TabsContent value="subcontractor">{renderTable(subContracts)}</TabsContent>
      </Tabs>

      {/* Contract Detail Modal */}
      <Dialog open={!!detailContract} onOpenChange={() => { setDetailContract(null); setDetailPreviewUrl(null); }}>
        <DialogContent onClose={() => { setDetailContract(null); setDetailPreviewUrl(null); }} className="max-w-4xl max-h-[90vh] overflow-hidden p-0">
          {detailContract && (
            <>
              <div className="flex items-center justify-between p-6 border-b">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <FileSignature className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Ugovor {detailContract.contractNumber}</h2>
                    <p className="text-sm text-muted-foreground">{detailContract.partyName}</p>
                  </div>
                </div>
                {detailContract.fileName && (
                  <Button variant="outline" size="sm" onClick={() => handleDownload(detailContract)}>
                    <Download className="h-4 w-4 mr-2" />
                    Preuzmi
                  </Button>
                )}
              </div>

              <div className="p-6 overflow-y-auto max-h-[calc(90vh-100px)]">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left: Document Preview */}
                  <div>
                    <h3 className="font-semibold mb-3">Dokument</h3>
                    <div className="border rounded-xl overflow-hidden bg-muted/30">
                      {detailPreviewUrl ? (
                        detailPreviewUrl.toLowerCase().includes('.pdf') ? (
                          <iframe src={detailPreviewUrl} className="w-full aspect-[3/4] rounded" title="Ugovor PDF" />
                        ) : (
                          <div className="aspect-[3/4] flex flex-col items-center justify-center p-8">
                            <FileText className="w-16 h-16 text-muted-foreground mb-4" />
                            <p className="text-sm text-muted-foreground mb-3">{detailContract.fileName}</p>
                            <Button variant="outline" onClick={() => handleDownload(detailContract)}>
                              <Download className="h-4 w-4 mr-2" />
                              Preuzmi dokument
                            </Button>
                          </div>
                        )
                      ) : (
                        <div className="aspect-[3/4] flex flex-col items-center justify-center">
                          <FileSignature className="w-12 h-12 text-muted-foreground mb-2" />
                          <p className="text-muted-foreground text-sm">Nema priloženog dokumenta</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Contract Data */}
                  <div className="space-y-4">
                    <div className="bg-muted/30 rounded-xl p-4 space-y-3 border">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <Calendar size={16} className="text-primary" />
                        Osnovni podaci
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-muted-foreground">Broj ugovora</label>
                          <p className="font-medium">{detailContract.contractNumber}</p>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Datum</label>
                          <p className="font-medium">{formatDate(detailContract.date)}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-muted-foreground">Tip</label>
                          <p className="font-medium">{detailContract.type === 'investor' ? 'Investitor' : 'Podizvođač'}</p>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Rok izvršenja</label>
                          <p className="font-medium">{detailContract.deadline ? formatDate(detailContract.deadline) : '-'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-muted/30 rounded-xl p-4 space-y-3 border">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <User size={16} className="text-primary" />
                        Ugovorna strana
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Naziv</label>
                        <p className="font-medium">{detailContract.partyName}</p>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Kontakt</label>
                        <p className="font-medium">{detailContract.contactInfo || '-'}</p>
                      </div>
                    </div>

                    <div className="bg-muted/30 rounded-xl p-4 space-y-3 border">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <DollarSign size={16} className="text-primary" />
                        Finansijski podaci
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Iznos ugovora</label>
                        <p className="text-lg font-bold text-primary">{formatCurrency(detailContract.amount)}</p>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Način plaćanja</label>
                        <p className="text-sm">{detailContract.paymentTerms || '-'}</p>
                      </div>
                    </div>

                    {detailContract.scopeOfWork && (
                      <div className="bg-muted/30 rounded-xl p-4 space-y-2 border">
                        <label className="text-xs text-muted-foreground">Opseg radova</label>
                        <p className="text-sm whitespace-pre-wrap">{detailContract.scopeOfWork}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Contract Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent onClose={() => setDialogOpen(false)} className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Novi ugovor - {form.type === 'investor' ? 'Investitor' : 'Podizvođač'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Broj ugovora *</Label>
                <Input value={form.contractNumber} onChange={(e) => setForm({ ...form, contractNumber: e.target.value })} />
              </div>
              <div>
                <Label>Datum</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>{form.type === 'investor' ? 'Investitor' : 'Podizvođač'} *</Label>
              <Input value={form.partyName} onChange={(e) => setForm({ ...form, partyName: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Iznos ugovora</Label>
                <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Rok izvršenja</Label>
                <Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Kontakt informacije</Label>
              <Input value={form.contactInfo} onChange={(e) => setForm({ ...form, contactInfo: e.target.value })} placeholder="Telefon, email..." />
            </div>
            <div>
              <Label>Opseg radova</Label>
              <Textarea value={form.scopeOfWork} onChange={(e) => setForm({ ...form, scopeOfWork: e.target.value })} />
            </div>
            <div>
              <Label>Način plaćanja</Label>
              <Input value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })} />
            </div>
            <div>
              <Label>Dokument ugovora (PDF/Word)</Label>
              <Input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setFile(e.target.files?.[0])} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Otkaži</Button>
            <Button onClick={handleSave}>Sačuvaj</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
