import { useState, useMemo } from 'react';
import { useProducts } from '../../hooks/useProducts';
import { useCrmStore } from '../../stores/crm';
import {
  ORDER_TYPE_CONFIG,
  type OrderType,
} from '../../types/products';
import { AGENTS } from '../../types/supabase';

// ─── Types ──────────────────────────────────────────────────────────────────

interface LineItemRow {
  key: number;
  product_id: string;
  name: string;
  sku: string;
  quantity: number;
  unit_price: number;
}

interface CreateOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

let lineItemKeyCounter = 0;
function nextKey(): number {
  return ++lineItemKeyCounter;
}

function generateOrderNumber(): string {
  return `ORD-${Date.now()}`;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function CreateOrderModal({ isOpen, onClose }: CreateOrderModalProps) {
  const { createOrder, products } = useProducts();
  const contacts = useCrmStore((s) => s.contacts);
  const companies = useCrmStore((s) => s.companies);

  // ── Form State ──
  const [orderType, setOrderType] = useState<OrderType>('order');
  const [contactId, setContactId] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [customerNote, setCustomerNote] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [agentId, setAgentId] = useState('');
  const [lineItems, setLineItems] = useState<LineItemRow[]>([
    { key: nextKey(), product_id: '', name: '', sku: '', quantity: 1, unit_price: 0 },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Published products for the picker
  const availableProducts = useMemo(
    () => products.filter((p) => p.status === 'published'),
    [products]
  );

  // Running total
  const runningTotal = useMemo(
    () => lineItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0),
    [lineItems]
  );

  // Agent groups for dropdown
  const orchestrators = AGENTS.filter((a) => a.team === 'orchestrator');
  const personalAgents = AGENTS.filter((a) => a.team === 'personal');
  const businessAgents = AGENTS.filter((a) => a.team === 'business');

  const orderTypeOptions = Object.entries(ORDER_TYPE_CONFIG) as [
    OrderType,
    { label: string; color: string },
  ][];

  if (!isOpen) return null;

  const resetForm = () => {
    setOrderType('order');
    setContactId('');
    setCompanyId('');
    setCurrency('USD');
    setCustomerNote('');
    setInternalNote('');
    setAgentId('');
    setLineItems([
      { key: nextKey(), product_id: '', name: '', sku: '', quantity: 1, unit_price: 0 },
    ]);
  };

  const handleProductSelect = (index: number, productId: string) => {
    setLineItems((prev) => {
      const updated = [...prev];
      if (productId) {
        const product = availableProducts.find((p) => p.id === productId);
        if (product) {
          updated[index] = {
            ...updated[index],
            product_id: productId,
            name: product.name,
            sku: product.sku ?? '',
            unit_price: product.regular_price ?? 0,
          };
        }
      } else {
        updated[index] = {
          ...updated[index],
          product_id: '',
          name: '',
          sku: '',
          unit_price: 0,
        };
      }
      return updated;
    });
  };

  const handleLineItemChange = (
    index: number,
    field: 'name' | 'sku' | 'quantity' | 'unit_price',
    value: string | number
  ) => {
    setLineItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      { key: nextKey(), product_id: '', name: '', sku: '', quantity: 1, unit_price: 0 },
    ]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate at least one line item has a name
    const validItems = lineItems.filter((li) => li.name.trim());
    if (validItems.length === 0) return;

    setIsSubmitting(true);

    try {
      await createOrder({
        order_number: generateOrderNumber(),
        order_type: orderType,
        contact_id: contactId || undefined,
        company_id: companyId || undefined,
        currency,
        customer_note: customerNote.trim() || undefined,
        internal_note: internalNote.trim() || undefined,
        owner_agent_id: agentId || undefined,
        line_items: validItems.map((li) => ({
          product_id: li.product_id || undefined,
          name: li.name,
          sku: li.sku || undefined,
          quantity: li.quantity,
          unit_price: li.unit_price,
        })),
      });

      resetForm();
      onClose();
    } catch (err) {
      console.error('Failed to create order:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasValidItems = lineItems.some((li) => li.name.trim());

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-100">Create Order</h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Order Type */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">
              Order Type
            </label>
            <div className="flex gap-2">
              {orderTypeOptions.map(([value, config]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setOrderType(value)}
                  className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                    orderType === value
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300'
                  }`}
                >
                  {config.label}
                </button>
              ))}
            </div>
          </div>

          {/* Contact + Company */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">
                Contact
              </label>
              <select
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-amber-500/50 focus:outline-none transition-colors"
              >
                <option value="">No contact</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.first_name} {c.last_name}
                    {c.email ? ` (${c.email})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">
                Company
              </label>
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-amber-500/50 focus:outline-none transition-colors"
              >
                <option value="">No company</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.domain ? ` (${c.domain})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-zinc-400">Line Items</label>
              <button
                type="button"
                onClick={addLineItem}
                className="px-2 py-1 text-xs bg-zinc-800 border border-zinc-700 rounded text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors"
              >
                + Add Item
              </button>
            </div>

            <div className="space-y-2">
              {/* Column headers */}
              <div className="grid grid-cols-[1fr_0.6fr_auto_auto_auto] gap-2 text-[10px] text-zinc-600 font-medium uppercase tracking-wider px-1">
                <span>Product</span>
                <span>Name / SKU</span>
                <span className="w-16 text-center">Qty</span>
                <span className="w-24 text-right">Unit Price</span>
                <span className="w-8"></span>
              </div>

              {lineItems.map((item, index) => (
                <div
                  key={item.key}
                  className="grid grid-cols-[1fr_0.6fr_auto_auto_auto] gap-2 items-start bg-zinc-800/30 border border-zinc-800 rounded-lg p-2"
                >
                  {/* Product picker */}
                  <select
                    value={item.product_id}
                    onChange={(e) => handleProductSelect(index, e.target.value)}
                    className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200 focus:border-amber-500/50 focus:outline-none transition-colors"
                  >
                    <option value="">Custom item...</option>
                    {availableProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.sku ? ` [${p.sku}]` : ''}
                      </option>
                    ))}
                  </select>

                  {/* Name / SKU (editable for custom items) */}
                  <div className="space-y-1">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) =>
                        handleLineItemChange(index, 'name', e.target.value)
                      }
                      placeholder="Item name"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none transition-colors"
                    />
                    <input
                      type="text"
                      value={item.sku}
                      onChange={(e) =>
                        handleLineItemChange(index, 'sku', e.target.value)
                      }
                      placeholder="SKU"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-[10px] text-zinc-400 placeholder-zinc-600 font-mono focus:border-amber-500/50 focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Quantity */}
                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) =>
                      handleLineItemChange(
                        index,
                        'quantity',
                        Math.max(1, parseInt(e.target.value) || 1)
                      )
                    }
                    className="w-16 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200 text-center focus:border-amber-500/50 focus:outline-none transition-colors"
                  />

                  {/* Unit Price */}
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={item.unit_price}
                    onChange={(e) =>
                      handleLineItemChange(
                        index,
                        'unit_price',
                        Math.max(0, parseFloat(e.target.value) || 0)
                      )
                    }
                    className="w-24 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200 text-right focus:border-amber-500/50 focus:outline-none transition-colors"
                  />

                  {/* Remove */}
                  <button
                    type="button"
                    onClick={() => removeLineItem(index)}
                    disabled={lineItems.length <= 1}
                    className="w-8 h-8 flex items-center justify-center text-zinc-600 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {/* Running total */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-800">
              <span className="text-sm text-zinc-400">Total</span>
              <span className="text-sm font-semibold text-amber-400">
                {formatCurrency(runningTotal, currency)}
              </span>
            </div>
          </div>

          {/* Currency */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-amber-500/50 focus:outline-none transition-colors"
            >
              <option value="USD">USD - US Dollar</option>
              <option value="EUR">EUR - Euro</option>
              <option value="GBP">GBP - British Pound</option>
              <option value="ZAR">ZAR - South African Rand</option>
              <option value="CAD">CAD - Canadian Dollar</option>
              <option value="AUD">AUD - Australian Dollar</option>
              <option value="JPY">JPY - Japanese Yen</option>
            </select>
          </div>

          {/* Agent */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">
              Assign Agent
            </label>
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-amber-500/50 focus:outline-none transition-colors"
            >
              <option value="">Unassigned</option>
              <optgroup label="Orchestrator">
                {orchestrators.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.emoji} {a.name} -- {a.role}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Personal Team">
                {personalAgents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.emoji} {a.name} -- {a.role}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Business Team">
                {businessAgents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.emoji} {a.name} -- {a.role}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Notes */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">
                Customer Note
              </label>
              <textarea
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
                placeholder="Note visible to customer..."
                rows={3}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none resize-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">
                Internal Note
              </label>
              <textarea
                value={internalNote}
                onChange={(e) => setInternalNote(e.target.value)}
                placeholder="Internal team note..."
                rows={3}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none resize-none transition-colors"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!hasValidItems || isSubmitting}
              className="px-5 py-2 text-sm bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Creating...' : 'Create Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
