import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

export interface Activity {
  id: string;
  type: 'invoice_created' | 'expense_added';
  title: string;
  description: string;
  timestamp: string;
  icon: string;
  status: 'completed' | 'pending';
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'warning' | 'alert' | 'success';
  isRead: boolean;
  createdAt: string;
  priority: 'low' | 'medium' | 'high';
}

@Injectable()
export class DashboardActivityService {
  constructor(@InjectEntityManager() private readonly em: EntityManager) {}

  async getRecentActivities(organizationId: string, limit = 10): Promise<Activity[]> {
    const [invoices, expenses] = await Promise.all([
      this.em.query(
        `SELECT id, number, total, created_at
         FROM invoices
         WHERE organization_id = $1 AND deleted_at IS NULL
         ORDER BY created_at DESC
         LIMIT 3`,
        [organizationId],
      ),
      this.em.query(
        `SELECT id, description, amount, created_at
         FROM expenses
         WHERE organization_id = $1 AND deleted_at IS NULL
         ORDER BY created_at DESC
         LIMIT 2`,
        [organizationId],
      ),
    ]);

    const items: Activity[] = [
      ...invoices.map((inv: any) => ({
        id: `inv_${inv.id}`,
        type: 'invoice_created' as const,
        title: 'Nueva factura creada',
        description: `Factura ${inv.number} por $${toMoney(inv.total)}`,
        timestamp: inv.created_at.toISOString(),
        icon: 'invoice',
        status: 'completed' as const,
      })),
      ...expenses.map((exp: any) => ({
        id: `exp_${exp.id}`,
        type: 'expense_added' as const,
        title: 'Gasto registrado',
        description: `${exp.description ?? ''} - $${toMoney(exp.amount)}`,
        timestamp: exp.created_at.toISOString(),
        icon: 'expense',
        status: 'pending' as const,
      })),
    ];

    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return items.slice(0, limit);
  }

  async getNotifications(organizationId: string, limit = 10): Promise<Notification[]> {
    const [lowStock, pending] = await Promise.all([
      this.em.query(
        `SELECT id, name, stock
         FROM products
         WHERE organization_id = $1 AND stock < 10 AND deleted_at IS NULL
         LIMIT 3`,
        [organizationId],
      ),
      this.em.query(
        `SELECT id, number, total, "dueDate"
         FROM invoices
         WHERE organization_id = $1 AND status = 'pending' AND deleted_at IS NULL
         LIMIT 2`,
        [organizationId],
      ),
    ]);

    const now = Date.now();
    const items: Notification[] = [
      ...lowStock.map((p: any, idx: number) => ({
        id: `stock_${p.id}`,
        title: 'Stock bajo',
        message: `El producto "${p.name}" tiene stock bajo (${p.stock} unidades)`,
        type: 'warning' as const,
        isRead: false,
        createdAt: new Date(now - 1000 * 60 * (20 + idx * 10)).toISOString(),
        priority: 'medium' as const,
      })),
      ...pending.map((inv: any, idx: number) => ({
        id: `invoice_${inv.id}`,
        title: 'Factura pendiente',
        message: `La factura ${inv.number} por $${toMoney(inv.total)} está pendiente`,
        type: 'alert' as const,
        isRead: false,
        createdAt: new Date(now - 1000 * 60 * 60 * (1 + idx)).toISOString(),
        priority: 'high' as const,
      })),
    ];

    if (items.length === 0) {
      items.push({
        id: 'system_1',
        title: 'Sistema operativo',
        message: 'El sistema está funcionando correctamente',
        type: 'success',
        isRead: false,
        createdAt: new Date(now).toISOString(),
        priority: 'low',
      });
    }

    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return items.slice(0, limit);
  }
}

const toMoney = (v: unknown): string => {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return (Number.isFinite(n) ? n : 0).toLocaleString();
};
