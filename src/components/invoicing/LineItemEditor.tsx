import { useState, useMemo, useCallback } from 'react';
import { useProductsStore } from '../../stores/products';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface LineItemDraft {
  id: string; // local temp id
  product_id: string | null;
  variation_id: string | null;
  name: string;
  description: string | null;
  sku: string | null;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  tax_amount: number;
  sort_order: number;
}

interface LineItemEditorProps {
  items: LineItemDraft[];
  onChange: (items: LineItemDraft[]) => void;
  currency?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

let tempIdCounter = 0;
function newTempId(): string {
  return `tmp-${++tempIdCounter}-${Date.now()}`;
}

function calcLineSubtotal(item: LineItemDraft): number {
  return item.quantity * item.unit_price * (1 - item.discount_percent / 100);
}

function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

// ─── Component ──────────────────────────────────────────────────────────────

export function LineItemEditor({ items, onChange, currency = 'USD' }: LineItemEditorProps) {
  const products = useProductsStore((s) => s.products);
  const [productSearch, setProductSearch] = useState('');
  const [showProductPicker, setShowProductPicker] = useState(false);

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products.slice(0, 20);
    const q = productSearch.toLowerCase();
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.sku?.toLowerCase().includes(q) ?? false)
      )
      .slice(0, 20);
  }, [products, productSearch]);

  const handleAddBlankItem = useCallback(() => {
    const newItem: LineItemDraft = {
      id: newTempId(),
      product_id: null,
      variation_id: null,
      name: '',
      description: null,
      sku: null,
      quantity: 1,
      unit_price: 0,
      discount_percent: 0,
      tax_amount: 0,
      sort_order: items.length,
    };
    onChange([...items, newItem]);
  }, [items, onChange]);

  const handleAddFromProduct = useCallback(
    (productId: string) => {
      const product = products.find((p) => p.id === productId);
      if (!product) return;

      const newItem: LineItemDraft = {
        id: newTempId(),
        product_id: product.id,
        variation_id: null,
        name: product.name,
        description: product.short_description || null,
        sku: product.sku,
        quantity: 1,
        unit_price: product.sale_price ?? product.regular_price ?? 0,
        discount_percent: 0,
        tax_amount: 0,
        sort_order: items.length,
      };
      onChange([...items, newItem]);
      setShowProductPicker(false);
      setProductSearch('');
    },
    [products, items, onChange]
  );

  const handleUpdateItem = useCallback(
    (id: string, field: keyof LineItemDraft, value: any) => {
      onChange(
        items.map((item) =>
          item.id === id ? { ...item, [field]: value } : item
        )
      );
    },
    [items, onChange]
  );

  const handleRemoveItem = useCallback(
    (id: string) => {
      onChange(items.filter((item) => item.id !== id).map((item, idx) => ({ ...item, sort_order: idx })));
    },
    [items, onChange]
  );

  const handleMoveItem = useCallback(
    (id: string, direction: 'up' | 'down') => {
      const idx = items.findIndex((item) => item.id === id);
      if (idx === -1) return;
      const newIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= items.length) return;
      const newItems = [...items];
      [newItems[idx], newItems[newIdx]] = [newItems[newIdx], newItems[idx]];
      onChange(newItems.map((item, i) => ({ ...item, sort_order: i })));
    },
    [items, onChange]
  );

  const grandTotal = useMemo(
    () => items.reduce((sum, item) => sum + calcLineSubtotal(item) + item.tax_amount, 0),
    [items]
  );

  const subtotalSum = useMemo(
    () => items.reduce((sum, item) => sum + calcLineSubtotal(item), 0),
    [items]
  );

  const taxSum = useMemo(
    () => items.reduce((sum, item) => sum + item.tax_amount, 0),
    [items]
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
          Line Items ({items.length})
        </h4>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowProductPicker(!showProductPicker)}
            className="px-3 py-1 text-xs bg-indigo-500/20 text-indigo-400 rounded-lg hover:bg-indigo-500/30 transition-colors"
          >
            + From Product
          </button>
          <button
            type="button"
            onClick={handleAddBlankItem}
            className="px-3 py-1 text-xs bg-zinc-700 text-zinc-300 rounded-lg hover:bg-zinc-600 transition-colors"
          >
            + Manual
          </button>
        </div>
      </div>

      {/* Product Picker */}
      {showProductPicker && (
        <div className="bg-zinc-800/80 border border-zinc-700 rounded-lg p-3 space-y-2">
          <input
            type="text"
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            placeholder="Search products by name or SKU..."
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none transition-colors"
            autoFocus
          />
          <div className="max-h-40 overflow-y-auto space-y-1">
            {filteredProducts.length === 0 ? (
              <p className="text-xs text-zinc-500 py-2 text-center">No products found</p>
            ) : (
              filteredProducts.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => handleAddFromProduct(product.id)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-700/50 text-left transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-zinc-200 truncate">{product.name}</div>
                    <div className="text-[10px] text-zinc-500">
                      {product.sku ? `SKU: ${product.sku}` : 'No SKU'}
                    </div>
                  </div>
                  <div className="text-sm text-amber-400 shrink-0">
                    {formatCurrency(product.sale_price ?? product.regular_price ?? 0, currency)}
                  </div>
                </button>
              ))
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setShowProductPicker(false);
              setProductSearch('');
            }}
            className="w-full text-xs text-zinc-500 hover:text-zinc-300 py-1"
          >
            Close
          </button>
        </div>
      )}

      {/* Line Items Table */}
      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div
              key={item.id}
              className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 space-y-2"
            >
              <div className="flex items-start gap-2">
                {/* Sort controls */}
                <div className="flex flex-col gap-0.5 shrink-0 pt-1">
                  <button
                    type="button"
                    onClick={() => handleMoveItem(item.id, 'up')}
                    disabled={idx === 0}
                    className="text-zinc-500 hover:text-zinc-300 disabled:opacity-20 text-xs leading-none"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveItem(item.id, 'down')}
                    disabled={idx === items.length - 1}
                    className="text-zinc-500 hover:text-zinc-300 disabled:opacity-20 text-xs leading-none"
                  >
                    ▼
                  </button>
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => handleUpdateItem(item.id, 'name', e.target.value)}
                    placeholder="Item name"
                    className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none"
                  />
                  {item.sku && (
                    <span className="text-[10px] text-zinc-600 mt-0.5">
                      SKU: {item.sku}
                    </span>
                  )}
                </div>

                {/* Remove */}
                <button
                  type="button"
                  onClick={() => handleRemoveItem(item.id)}
                  className="text-zinc-500 hover:text-red-400 shrink-0 text-sm transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Qty / Price / Discount */}
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block text-[10px] text-zinc-500 mb-0.5">Qty</label>
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) =>
                      handleUpdateItem(item.id, 'quantity', Math.max(0, parseFloat(e.target.value) || 0))
                    }
                    min="0"
                    step="1"
                    className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200 focus:border-amber-500/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-500 mb-0.5">Unit Price</label>
                  <input
                    type="number"
                    value={item.unit_price}
                    onChange={(e) =>
                      handleUpdateItem(item.id, 'unit_price', Math.max(0, parseFloat(e.target.value) || 0))
                    }
                    min="0"
                    step="0.01"
                    className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200 focus:border-amber-500/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-500 mb-0.5">Discount %</label>
                  <input
                    type="number"
                    value={item.discount_percent}
                    onChange={(e) =>
                      handleUpdateItem(
                        item.id,
                        'discount_percent',
                        Math.min(100, Math.max(0, parseFloat(e.target.value) || 0))
                      )
                    }
                    min="0"
                    max="100"
                    step="0.01"
                    className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200 focus:border-amber-500/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-500 mb-0.5">Subtotal</label>
                  <div className="px-2 py-1 text-sm text-amber-400 font-medium">
                    {formatCurrency(calcLineSubtotal(item), currency)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {items.length === 0 && (
        <div className="text-center py-6 text-zinc-600 text-sm">
          No line items yet. Add items manually or from your product catalog.
        </div>
      )}

      {/* Totals */}
      {items.length > 0 && (
        <div className="border-t border-zinc-700 pt-3 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">Subtotal</span>
            <span className="text-zinc-300">{formatCurrency(subtotalSum, currency)}</span>
          </div>
          {taxSum > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Tax</span>
              <span className="text-zinc-300">{formatCurrency(taxSum, currency)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-semibold">
            <span className="text-zinc-300">Total</span>
            <span className="text-amber-400">{formatCurrency(grandTotal, currency)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
