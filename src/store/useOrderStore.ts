import { create } from 'zustand';
import type { PurchaseOrder, OrderItem } from '@/types';
import { db } from '@/lib/db';
import { generateId, getToday } from '@/lib/utils';

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

export const useOrderStore = create<OrderStore>((set) => ({
  orders: [],
  loading: false,

  loadOrders: async (projectId) => {
    set({ loading: true });
    const orders = await db.purchaseOrders.where('projectId').equals(projectId).toArray();
    set({ orders, loading: false });
  },

  addOrder: async (data) => {
    const existingCount = await db.purchaseOrders
      .where('projectId')
      .equals(data.projectId)
      .count();

    const orderId = generateId();
    const items: OrderItem[] = data.items.map((item) => ({
      ...item,
      id: generateId(),
      orderId,
    }));

    const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);

    const order: PurchaseOrder = {
      id: orderId,
      projectId: data.projectId,
      orderNumber: `PO-${String(existingCount + 1).padStart(4, '0')}`,
      date: getToday(),
      supplier: data.supplier,
      items,
      totalAmount,
      status: 'created',
      materialRequestId: data.materialRequestId,
      createdAt: new Date().toISOString(),
    };

    await db.purchaseOrders.add(order);
    set((state) => ({ orders: [...state.orders, order] }));
    return order;
  },

  updateOrderStatus: async (id, status) => {
    await db.purchaseOrders.update(id, { status });
    set((state) => ({
      orders: state.orders.map((o) => (o.id === id ? { ...o, status } : o)),
    }));
  },

  deleteOrder: async (id) => {
    await db.purchaseOrders.delete(id);
    set((state) => ({ orders: state.orders.filter((o) => o.id !== id) }));
  },
}));
