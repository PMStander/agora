import { useEffect, useMemo, useState } from 'react';
import { useProductsStore, useSelectedOrder } from '../../stores/products';
import { useProducts } from '../../hooks/useProducts';
import { useCrmStore } from '../../stores/crm';
import {
  ORDER_STATUS_CONFIG,
  ORDER_TYPE_CONFIG,
  PAYMENT_STATUS_CONFIG,
  type OrderLineItem,
  type OrderStatus,
} from '../../types/products';

// ─── Helpers ────────────────────────────────────────────────────────────────

const badgeColors: Record<string, string> = {
  zinc: 'bg-zinc-500/20 text-zinc-400',
  blue: 'bg-blue-500/20 text-blue-400',
  cyan: 'bg-cyan-500/20 text-cyan-400',
  amber: 'bg-amber-500/20 text-amber-400',
  green: 'bg-green-500/20 text-green-400',
  purple: 'bg-purple-500/20 text-purple-400',
  red: 'bg-red-500/20 text-red-400',
};

function formatCurrency(amount: number | null, currency = 'USD'): string {
  if (amount == null) return '--';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Status transition buttons config
const STATUS_ACTIONS: Array<{
  targetStatus: OrderStatus;
  label: string;
  fromStatuses: OrderStatus[];
  style: string;
}> = [
  {
    targetStatus: 'processing',
    label: 'Process',
    fromStatuses: ['pending', 'on_hold', 'draft'],
    style: 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30',
  },
  {
    targetStatus: 'completed',
    label: 'Complete',
    fromStatuses: ['processing'],
    style: 'bg-green-500/20 text-green-400 hover:bg-green-500/30',
  },
  {
    targetStatus: 'cancelled',
    label: 'Cancel',
    fromStatuses: ['pending', 'processing', 'on_hold', 'draft'],
    style: 'bg-red-500/20 text-red-400 hover:bg-red-500/30',
  },
  {
    targetStatus: 'refunded',
    label: 'Refund',
    fromStatuses: ['completed'],
    style: 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30',
  },
];

// ─── Component ──────────────────────────────────────────────────────────────

export function OrderDetail() {
  const order = useSelectedOrder();
  const selectOrder = useProductsStore((s) => s.selectOrder);
  const { updateOrderStatus, deleteOrder, fetchOrderLineItems } = useProducts();
  const contacts = useCrmStore((s) => s.contacts);
  const companies = useCrmStore((s) => s.companies);

  const [lineItems, setLineItems] = useState<OrderLineItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Fetch line items when order changes
  useEffect(() => {
    if (!order) {
      setLineItems([]);
      return;
    }

    setLoadingItems(true);
    setConfirmDelete(false);
    fetchOrderLineItems(order.id)
      .then((items) => setLineItems(items))
      .finally(() => setLoadingItems(false));
  }, [order?.id, fetchOrderLineItems]);

  const contact = useMemo(
    () =>
      order?.contact_id
        ? contacts.find((c) => c.id === order.contact_id) ?? null
        : null,
    [contacts, order?.contact_id]
  );

  const company = useMemo(
    () =>
      order?.company_id
        ? companies.find((c) => c.id === order.company_id) ?? null
        : null,
    [companies, order?.company_id]
  );

  const availableActions = useMemo(() => {
    if (!order) return [];
    return STATUS_ACTIONS.filter((action) =>
      action.fromStatuses.includes(order.status)
    );
  }, [order?.status]);

  if (!order) return null;

  const statusConfig = ORDER_STATUS_CONFIG[order.status];
  const typeConfig = ORDER_TYPE_CONFIG[order.order_type];
  const paymentConfig = PAYMENT_STATUS_CONFIG[order.payment_status];

  const handleStatusUpdate = async (status: OrderStatus) => {
    await updateOrderStatus(order.id, status);
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await deleteOrder(order.id);
    selectOrder(null);
  };

  return (
    <div className="w-80 border-l border-zinc-800 bg-zinc-900/50 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-400">Order Details</h2>
        <button
          onClick={() => selectOrder(null)}
          className="text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Order Header */}
        <div className="text-center space-y-2">
          <h3 className="text-lg font-medium text-zinc-100 font-mono">
            {order.order_number}
          </h3>
          <div className="flex items-center justify-center gap-2">
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                badgeColors[typeConfig.color] ?? badgeColors.zinc
              }`}
            >
              {typeConfig.label}
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                badgeColors[statusConfig.color] ?? badgeColors.zinc
              }`}
            >
              {statusConfig.label}
            </span>
          </div>
        </div>

        {/* Summary */}
        <div>
          <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
            Summary
          </h4>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">Subtotal</span>
              <span className="text-zinc-300">
                {formatCurrency(order.subtotal, order.currency)}
              </span>
            </div>
            {order.tax_total > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-500">Tax</span>
                <span className="text-zinc-300">
                  {formatCurrency(order.tax_total, order.currency)}
                </span>
              </div>
            )}
            {order.shipping_total > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-500">Shipping</span>
                <span className="text-zinc-300">
                  {formatCurrency(order.shipping_total, order.currency)}
                </span>
              </div>
            )}
            {order.discount_total > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-500">Discount</span>
                <span className="text-red-400">
                  -{formatCurrency(order.discount_total, order.currency)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm pt-1.5 border-t border-zinc-800">
              <span className="text-zinc-300 font-medium">Total</span>
              <span className="text-amber-400 font-semibold">
                {formatCurrency(order.total, order.currency)}
              </span>
            </div>
          </div>
        </div>

        {/* Payment */}
        <div>
          <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
            Payment
          </h4>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">Status</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  badgeColors[paymentConfig.color] ?? badgeColors.zinc
                }`}
              >
                {paymentConfig.label}
              </span>
            </div>
            {order.payment_method && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-500">Method</span>
                <span className="text-zinc-300 capitalize">
                  {order.payment_method}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Contact / Company */}
        {(contact || company) && (
          <div>
            <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
              Customer
            </h4>
            <div className="space-y-1.5">
              {contact && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-500">Contact</span>
                  <span className="text-amber-400">
                    {contact.first_name} {contact.last_name}
                  </span>
                </div>
              )}
              {company && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-500">Company</span>
                  <span className="text-amber-400">{company.name}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Line Items */}
        <div>
          <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
            Line Items ({lineItems.length})
          </h4>
          {loadingItems ? (
            <p className="text-xs text-zinc-600">Loading items...</p>
          ) : lineItems.length === 0 ? (
            <p className="text-xs text-zinc-600">No line items</p>
          ) : (
            <div className="space-y-2">
              {/* Header */}
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 text-[10px] text-zinc-600 font-medium uppercase tracking-wider">
                <span>Item</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Price</span>
                <span className="text-right">Total</span>
              </div>
              {/* Items */}
              {lineItems.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[1fr_auto_auto_auto] gap-2 bg-zinc-800/30 border border-zinc-800 rounded p-2"
                >
                  <div className="min-w-0">
                    <div className="text-xs text-zinc-200 truncate">
                      {item.name}
                    </div>
                    {item.sku && (
                      <div className="text-[10px] text-zinc-600 font-mono">
                        {item.sku}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-zinc-400 text-right whitespace-nowrap">
                    x{item.quantity}
                  </span>
                  <span className="text-xs text-zinc-400 text-right whitespace-nowrap">
                    {formatCurrency(item.unit_price, order.currency)}
                  </span>
                  <span className="text-xs text-zinc-200 text-right font-medium whitespace-nowrap">
                    {formatCurrency(item.total, order.currency)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notes */}
        {(order.customer_note || order.internal_note) && (
          <div>
            <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
              Notes
            </h4>
            {order.customer_note && (
              <div className="mb-2">
                <div className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">
                  Customer Note
                </div>
                <p className="text-xs text-zinc-300 bg-zinc-800/50 border border-zinc-800 rounded p-2">
                  {order.customer_note}
                </p>
              </div>
            )}
            {order.internal_note && (
              <div>
                <div className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">
                  Internal Note
                </div>
                <p className="text-xs text-zinc-300 bg-zinc-800/50 border border-zinc-800 rounded p-2">
                  {order.internal_note}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Dates */}
        <div>
          <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
            Dates
          </h4>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-500">Created</span>
              <span className="text-zinc-400">{formatDate(order.created_at)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-500">Updated</span>
              <span className="text-zinc-400">{formatDate(order.updated_at)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions Footer */}
      <div className="border-t border-zinc-800 p-3 space-y-2">
        {/* Status transition buttons */}
        {availableActions.length > 0 && (
          <div className="flex gap-2">
            {availableActions.map((action) => (
              <button
                key={action.targetStatus}
                onClick={() => handleStatusUpdate(action.targetStatus)}
                className={`flex-1 px-3 py-2 text-xs rounded-lg transition-colors ${action.style}`}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}

        {/* Delete */}
        <button
          onClick={handleDelete}
          className={`w-full px-3 py-2 text-xs rounded-lg transition-colors ${
            confirmDelete
              ? 'bg-red-500/30 text-red-300 border border-red-500/50'
              : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
          }`}
        >
          {confirmDelete ? 'Click again to confirm delete' : 'Delete Order'}
        </button>
      </div>
    </div>
  );
}
