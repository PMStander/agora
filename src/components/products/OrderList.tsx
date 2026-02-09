import { useState } from 'react';
import { useProductsStore, useFilteredOrders } from '../../stores/products';
import { useProducts } from '../../hooks/useProducts';
import { useCrmStore } from '../../stores/crm';
import {
  ORDER_STATUS_CONFIG,
  ORDER_TYPE_CONFIG,
  PAYMENT_STATUS_CONFIG,
  type OrderStatus,
} from '../../types/products';
import { CreateOrderModal } from './CreateOrderModal';

// ─── Helpers ────────────────────────────────────────────────────────────────

const badgeColors: Record<string, string> = {
  zinc: 'bg-zinc-500/20 text-zinc-300',
  blue: 'bg-blue-500/20 text-blue-300',
  cyan: 'bg-cyan-500/20 text-cyan-300',
  amber: 'bg-amber-500/20 text-amber-300',
  green: 'bg-emerald-500/20 text-emerald-300',
  purple: 'bg-purple-500/20 text-purple-300',
  red: 'bg-red-500/20 text-red-300',
};

function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ─── Component ──────────────────────────────────────────────────────────────

export function OrderList() {
  const { isConfigured } = useProducts();
  const orders = useFilteredOrders();
  const contacts = useCrmStore((s) => s.contacts);
  const selectedOrderId = useProductsStore((s) => s.selectedOrderId);
  const selectOrder = useProductsStore((s) => s.selectOrder);
  const filters = useProductsStore((s) => s.filters);
  const setFilters = useProductsStore((s) => s.setFilters);

  const [showCreateModal, setShowCreateModal] = useState(false);

  const getContactName = (contactId: string | null): string => {
    if (!contactId) return '--';
    const contact = contacts.find((c) => c.id === contactId);
    if (!contact) return '--';
    return `${contact.first_name} ${contact.last_name}`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-zinc-100">Orders</h2>
          <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
            {orders.length}
          </span>
          {!isConfigured && (
            <span className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
              Local Mode
            </span>
          )}
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-1.5 bg-amber-500 text-black text-sm font-medium rounded-lg hover:bg-amber-400 transition-colors"
        >
          New Order
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800 bg-zinc-900/30">
        <select
          value={filters.orderStatus}
          onChange={(e) =>
            setFilters({ orderStatus: e.target.value as OrderStatus | 'all' })
          }
          className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-300"
        >
          <option value="all">All Statuses</option>
          {(Object.keys(ORDER_STATUS_CONFIG) as OrderStatus[]).map((status) => (
            <option key={status} value={status}>
              {ORDER_STATUS_CONFIG[status].label}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_0.8fr_0.8fr_1.2fr_1fr_0.8fr_1fr] gap-2 px-4 py-2 border-b border-zinc-800 bg-zinc-900/50 text-xs text-zinc-500 font-medium sticky top-0">
          <span>Order #</span>
          <span>Type</span>
          <span>Status</span>
          <span>Contact</span>
          <span>Total</span>
          <span>Payment</span>
          <span>Date</span>
        </div>

        {/* Table rows */}
        {orders.length === 0 ? (
          <div className="text-center text-zinc-600 py-12">
            <p className="text-sm">No orders found</p>
            <p className="text-xs mt-1">
              {filters.orderStatus !== 'all'
                ? 'Try adjusting your filters'
                : 'Create an order to get started'}
            </p>
          </div>
        ) : (
          orders.map((order) => {
            const statusConfig = ORDER_STATUS_CONFIG[order.status];
            const typeConfig = ORDER_TYPE_CONFIG[order.order_type];
            const paymentConfig = PAYMENT_STATUS_CONFIG[order.payment_status];

            return (
              <div
                key={order.id}
                onClick={() => selectOrder(order.id)}
                className={`
                  grid grid-cols-[1fr_0.8fr_0.8fr_1.2fr_1fr_0.8fr_1fr] gap-2 px-4 py-2.5 border-b border-zinc-800/50
                  cursor-pointer transition-colors
                  ${
                    selectedOrderId === order.id
                      ? 'bg-zinc-800'
                      : 'hover:bg-zinc-800/50'
                  }
                `}
              >
                {/* Order # */}
                <span className="text-sm text-zinc-100 truncate font-mono">
                  {order.order_number}
                </span>

                {/* Type */}
                <span>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded ${
                      badgeColors[typeConfig.color] ?? badgeColors.zinc
                    }`}
                  >
                    {typeConfig.label}
                  </span>
                </span>

                {/* Status */}
                <span>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded ${
                      badgeColors[statusConfig.color] ?? badgeColors.zinc
                    }`}
                  >
                    {statusConfig.label}
                  </span>
                </span>

                {/* Contact */}
                <span className="text-sm text-zinc-400 truncate">
                  {getContactName(order.contact_id)}
                </span>

                {/* Total */}
                <span className="text-sm text-zinc-200 font-medium">
                  {formatCurrency(order.total, order.currency)}
                </span>

                {/* Payment */}
                <span>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded ${
                      badgeColors[paymentConfig.color] ?? badgeColors.zinc
                    }`}
                  >
                    {paymentConfig.label}
                  </span>
                </span>

                {/* Date */}
                <span className="text-xs text-zinc-500">
                  {formatDate(order.created_at)}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Create Order Modal */}
      <CreateOrderModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </div>
  );
}
