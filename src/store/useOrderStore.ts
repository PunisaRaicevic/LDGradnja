import { create } from 'zustand';
import type { PurchaseOrder, OrderItem } from '@/types';
import { supabase } from '@/lib/supabase';
import { getToday } from '@/lib/utils';

interface OrderStore {
  orders: PurchaseOrder[];
  loading: boolean;
  loadOrders: (projectId: string) => Promise<void>;
  addOrder: (data: {
    projectId: string;
    supplier: string;
    items: Omit<OrderItem, 'id' | 'orderId'>[];
    materialRequestId?: string;
  }) => Promise<PurchaseOrder>;
  updateOrderStatus: (id: string, status: PurchaseOrder['status']) => Promise<void>;
  deleteOrder: (id: string) => Promise<void>;
}

function mapOrder(r: any, items: OrderItem[]): PurchaseOrder {
  return {
    id: r.id, projectId: r.project_id, orderNumber: r.order_number, date: r.date,
    supplier: r.supplier, items, totalAmount: Number(r.total_amount), status: r.status,
    materialRequestId: r.material_request_id, createdAt: r.created_at,
  };
}
function mapItem(r: any): OrderItem {
  return {
    id: r.id, orderId: r.order_id, ordinal: r.ordinal, description: r.description,
    unit: r.unit || '', quantity: Number(r.quantity), unitPrice: Number(r.unit_price), amount: Number(r.amount),
  };
}

export const useOrderStore = create<OrderStore>((set) => ({
  orders: [],
  loading: false,

  loadOrders: async (projectId) => {
    set({ loading: true });
    const { data: orderRows } = await supabase.from('purchase_orders').select('*').eq('project_id', projectId).order('created_at', { ascending: false });
    const orders: PurchaseOrder[] = [];
    for (const or of orderRows || []) {
      const { data: itemRows } = await supabase.from('order_items').select('*').eq('order_id', or.id).order('ordinal');
      orders.push(mapOrder(or, (itemRows || []).map(mapItem)));
    }
    set({ orders, loading: false });
  },

  addOrder: async (data) => {
    const { count } = await supabase.from('purchase_orders')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', data.projectId);

    const totalAmount = data.items.reduce((sum, i) => sum + i.amount, 0);

    const { data: orderRow } = await supabase.from('purchase_orders').insert({
      project_id: data.projectId, order_number: `PO-${String((count || 0) + 1).padStart(4, '0')}`,
      date: getToday(), supplier: data.supplier, total_amount: totalAmount, status: 'created',
      material_request_id: data.materialRequestId || null,
    }).select().single();
    if (!orderRow) throw new Error('Failed to create order');

    const itemRows = data.items.map((i) => ({
      order_id: orderRow.id, ordinal: i.ordinal, description: i.description,
      unit: i.unit, quantity: i.quantity, unit_price: i.unitPrice, amount: i.amount,
    }));
    const { data: insertedItems } = await supabase.from('order_items').insert(itemRows).select();
    const order = mapOrder(orderRow, (insertedItems || []).map(mapItem));
    set((s) => ({ orders: [...s.orders, order] }));
    return order;
  },

  updateOrderStatus: async (id, status) => {
    await supabase.from('purchase_orders').update({ status }).eq('id', id);
    set((s) => ({ orders: s.orders.map((o) => (o.id === id ? { ...o, status } : o)) }));
  },

  deleteOrder: async (id) => {
    await supabase.from('purchase_orders').delete().eq('id', id);
    set((s) => ({ orders: s.orders.filter((o) => o.id !== id) }));
  },
}));
