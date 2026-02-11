import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useOrderStore } from '@/store/useOrderStore';
import { useProjectStore } from '@/store/useProjectStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Plus, Trash2, FileDown, ShoppingCart, X } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { generateOrderPDF } from '@/lib/pdf';
import { UNITS } from '@/types';
import type { OrderItem } from '@/types';

const statusConfig: Record<string, { label: string; variant: 'secondary' | 'warning' | 'success' }> = {
  created: { label: 'Kreirana', variant: 'secondary' },
  sent: { label: 'Poslata', variant: 'warning' },
  delivered: { label: 'Isporučena', variant: 'success' },
};

interface ItemForm {
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
}

export default function MaterialOrders() {
  const { projectId } = useParams();
  const { orders, loadOrders, addOrder, updateOrderStatus, deleteOrder } = useOrderStore();
  const { projects } = useProjectStore();
  const project = projects.find((p) => p.id === projectId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [supplier, setSupplier] = useState('');
  const [items, setItems] = useState<ItemForm[]>([{ description: '', unit: 'kom', quantity: 0, unitPrice: 0 }]);

  useEffect(() => {
    if (projectId) loadOrders(projectId);
  }, [projectId, loadOrders]);

  const addItemRow = () => {
    setItems([...items, { description: '', unit: 'kom', quantity: 0, unitPrice: 0 }]);
  };

  const removeItemRow = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof ItemForm, value: string | number) => {
    const updated = [...items];
    (updated[index] as any)[field] = value;
    setItems(updated);
  };

  const handleCreate = async () => {
    if (!projectId || !supplier || items.length === 0) return;
    const orderItems: Omit<OrderItem, 'id' | 'orderId'>[] = items
      .filter((item) => item.description)
      .map((item, index) => ({
        ordinal: index + 1,
        description: item.description,
        unit: item.unit,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.quantity * item.unitPrice,
      }));

    await addOrder({ projectId, supplier, items: orderItems });
    setDialogOpen(false);
    setSupplier('');
    setItems([{ description: '', unit: 'kom', quantity: 0, unitPrice: 0 }]);
  };

  const handleExportPDF = (orderId: string) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order || !project) return;
    const doc = generateOrderPDF(order, project.name);
    doc.save(`porudzbenica-${order.orderNumber}.pdf`);
  };

  const totalAll = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Nabavka materijala</h1>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova porudžbenica
        </Button>
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Nema porudžbenica</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card key={order.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-lg">{order.orderNumber}</CardTitle>
                    <Badge variant={statusConfig[order.status].variant}>
                      {statusConfig[order.status].label}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Select
                      value={order.status}
                      onChange={(e) => updateOrderStatus(order.id, e.target.value as any)}
                      className="w-36 h-8 text-xs"
                    >
                      <option value="created">Kreirana</option>
                      <option value="sent">Poslata</option>
                      <option value="delivered">Isporučena</option>
                    </Select>
                    <Button variant="outline" size="sm" onClick={() => handleExportPDF(order.id)}>
                      <FileDown className="h-4 w-4 mr-1" /> PDF
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteOrder(order.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-sm mb-4">
                  <div>
                    <span className="text-muted-foreground">Dobavljač:</span>
                    <p className="font-medium">{order.supplier}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Datum:</span>
                    <p className="font-medium">{formatDate(order.date)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Ukupno:</span>
                    <p className="font-medium">{formatCurrency(order.totalAmount)}</p>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">R.br</TableHead>
                      <TableHead>Opis</TableHead>
                      <TableHead className="w-16">Jed.</TableHead>
                      <TableHead className="w-20 text-right">Kol.</TableHead>
                      <TableHead className="w-28 text-right">Cijena</TableHead>
                      <TableHead className="w-28 text-right">Iznos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.ordinal}</TableCell>
                        <TableCell>{item.description}</TableCell>
                        <TableCell>{item.unit}</TableCell>
                        <TableCell className="text-right">{item.quantity.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Order Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent onClose={() => setDialogOpen(false)} className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Nova porudžbenica</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Dobavljač *</Label>
              <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Naziv dobavljača" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Stavke</Label>
                <Button variant="outline" size="sm" onClick={addItemRow}>
                  <Plus className="h-3 w-3 mr-1" /> Dodaj stavku
                </Button>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {items.map((item, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-4">
                      {index === 0 && <Label className="text-xs">Opis</Label>}
                      <Input value={item.description} onChange={(e) => updateItem(index, 'description', e.target.value)} placeholder="Materijal" />
                    </div>
                    <div className="col-span-2">
                      {index === 0 && <Label className="text-xs">Jed.</Label>}
                      <Select value={item.unit} onChange={(e) => updateItem(index, 'unit', e.target.value)}>
                        {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                      </Select>
                    </div>
                    <div className="col-span-2">
                      {index === 0 && <Label className="text-xs">Količina</Label>}
                      <Input type="number" step="0.01" value={item.quantity} onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="col-span-2">
                      {index === 0 && <Label className="text-xs">Cijena</Label>}
                      <Input type="number" step="0.01" value={item.unitPrice} onChange={(e) => updateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="col-span-1 text-right text-sm font-medium pt-1">
                      {formatCurrency(item.quantity * item.unitPrice)}
                    </div>
                    <div className="col-span-1">
                      {items.length > 1 && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeItemRow(index)}>
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-right mt-2 text-lg font-semibold">
                Ukupno: {formatCurrency(totalAll)}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Otkaži</Button>
            <Button onClick={handleCreate}>Kreiraj porudžbenicu</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
