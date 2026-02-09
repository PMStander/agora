import { useState } from 'react';
import { useProductsStore, useSelectedProduct } from '../../stores/products';
import { useProducts } from '../../hooks/useProducts';
import {
  PRODUCT_TYPE_CONFIG,
  PRODUCT_STATUS_CONFIG,
  STOCK_STATUS_CONFIG,
} from '../../types/products';
import { VariationManager } from './VariationManager';

// ─── Helpers ────────────────────────────────────────────────────────────────

const statusBadgeColors: Record<string, string> = {
  zinc: 'bg-zinc-500/20 text-zinc-300',
  blue: 'bg-blue-500/20 text-blue-300',
  cyan: 'bg-cyan-500/20 text-cyan-300',
  indigo: 'bg-indigo-500/20 text-indigo-300',
  amber: 'bg-amber-500/20 text-amber-300',
  green: 'bg-emerald-500/20 text-emerald-300',
  purple: 'bg-purple-500/20 text-purple-300',
  red: 'bg-red-500/20 text-red-300',
};

function formatCurrency(amount: number | null, currency = 'USD'): string {
  if (amount == null) return '--';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatDate(iso: string | null): string {
  if (!iso) return '--';
  return new Date(iso).toLocaleDateString();
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ProductDetail() {
  const product = useSelectedProduct();
  const selectProduct = useProductsStore((s) => s.selectProduct);
  const { updateProductDetails, deleteProduct, getEffectivePrice, getProductPriceRange } =
    useProducts();

  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!product) return null;

  const typeConfig = PRODUCT_TYPE_CONFIG[product.product_type];
  const statusConfig = PRODUCT_STATUS_CONFIG[product.status];
  const stockConfig = STOCK_STATUS_CONFIG[product.stock_status];
  const effectivePrice = getEffectivePrice(product);
  const priceRange =
    product.product_type === 'variable'
      ? getProductPriceRange(product.id)
      : null;

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await deleteProduct(product.id);
    selectProduct(null);
  };

  const handleStatusChange = async (newStatus: 'published' | 'archived' | 'draft') => {
    await updateProductDetails(product.id, { status: newStatus });
  };

  return (
    <div className="w-80 border-l border-zinc-800 bg-zinc-900/50 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-400">Product Details</h2>
        <button
          onClick={() => selectProduct(null)}
          className="text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Image + Name */}
        <div className="flex flex-col items-center text-center gap-2">
          {product.featured_image_url ? (
            <img
              src={product.featured_image_url}
              alt={product.name}
              className="w-24 h-24 rounded-lg object-cover border-2 border-zinc-700"
            />
          ) : (
            <div className="w-24 h-24 rounded-lg bg-zinc-800 flex items-center justify-center border-2 border-zinc-700">
              <svg className="w-10 h-10 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
            </div>
          )}
          <div>
            <h3 className="text-lg font-medium text-zinc-100">{product.name}</h3>
            {product.sku && (
              <p className="text-xs text-zinc-500 mt-0.5">SKU: {product.sku}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                statusBadgeColors[typeConfig.color] ?? statusBadgeColors.zinc
              }`}
            >
              {typeConfig.label}
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                statusBadgeColors[statusConfig.color] ?? statusBadgeColors.zinc
              }`}
            >
              {statusConfig.label}
            </span>
          </div>
        </div>

        {/* Description */}
        {product.short_description && (
          <div>
            <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
              Description
            </h4>
            <p className="text-sm text-zinc-400">{product.short_description}</p>
          </div>
        )}

        {/* Pricing */}
        <div>
          <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
            Pricing
          </h4>
          <div className="space-y-2">
            {priceRange ? (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-zinc-500 w-24 shrink-0">Range</span>
                <span className="text-zinc-200">
                  {formatCurrency(priceRange.min, product.currency)} -{' '}
                  {formatCurrency(priceRange.max, product.currency)}
                </span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-zinc-500 w-24 shrink-0">Regular</span>
                  <span className="text-zinc-200">
                    {formatCurrency(product.regular_price, product.currency)}
                  </span>
                </div>
                {product.sale_price != null && (
                  <>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-zinc-500 w-24 shrink-0">Sale</span>
                      <span className="text-amber-400 font-medium">
                        {formatCurrency(product.sale_price, product.currency)}
                      </span>
                    </div>
                    {(product.sale_price_from || product.sale_price_to) && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-zinc-500 w-24 shrink-0">Sale Period</span>
                        <span className="text-zinc-400 text-xs">
                          {formatDate(product.sale_price_from)} - {formatDate(product.sale_price_to)}
                        </span>
                      </div>
                    )}
                  </>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-zinc-500 w-24 shrink-0">Effective</span>
                  <span className="text-zinc-100 font-medium">
                    {formatCurrency(effectivePrice, product.currency)}
                  </span>
                </div>
              </>
            )}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-zinc-500 w-24 shrink-0">Currency</span>
              <span className="text-zinc-300">{product.currency}</span>
            </div>
          </div>
        </div>

        {/* Inventory */}
        <div>
          <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
            Inventory
          </h4>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-zinc-500 w-24 shrink-0">Stock</span>
              <span
                className={`text-xs px-1.5 py-0.5 rounded ${
                  statusBadgeColors[stockConfig.color] ?? statusBadgeColors.zinc
                }`}
              >
                {stockConfig.label}
              </span>
            </div>
            {product.manage_stock && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-zinc-500 w-24 shrink-0">Quantity</span>
                <span className="text-zinc-300">
                  {product.stock_quantity ?? 0}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-zinc-500 w-24 shrink-0">Manage Stock</span>
              <span className="text-zinc-300">
                {product.manage_stock ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-zinc-500 w-24 shrink-0">Backorders</span>
              <span className="text-zinc-300">
                {product.backorders_allowed ? 'Allowed' : 'Not allowed'}
              </span>
            </div>
          </div>
        </div>

        {/* Shipping (not virtual) */}
        {!product.is_virtual && (
          <div>
            <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
              Shipping
            </h4>
            <div className="space-y-2">
              {product.weight != null && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-zinc-500 w-24 shrink-0">Weight</span>
                  <span className="text-zinc-300">{product.weight} kg</span>
                </div>
              )}
              {(product.length != null ||
                product.width != null ||
                product.height != null) && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-zinc-500 w-24 shrink-0">Dimensions</span>
                  <span className="text-zinc-300">
                    {product.length ?? '--'} x {product.width ?? '--'} x{' '}
                    {product.height ?? '--'} cm
                  </span>
                </div>
              )}
              {product.shipping_class && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-zinc-500 w-24 shrink-0">Class</span>
                  <span className="text-zinc-300">{product.shipping_class}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* External product info */}
        {product.product_type === 'external' && (
          <div>
            <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
              External Product
            </h4>
            <div className="space-y-2">
              {product.external_url && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-zinc-500 w-24 shrink-0">URL</span>
                  <a
                    href={product.external_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-400 hover:text-amber-300 truncate transition-colors"
                  >
                    {product.external_url}
                  </a>
                </div>
              )}
              {product.button_text && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-zinc-500 w-24 shrink-0">Button</span>
                  <span className="text-zinc-300">{product.button_text}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Grouped product note */}
        {product.product_type === 'grouped' && (
          <div>
            <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
              Grouped Product
            </h4>
            <p className="text-xs text-zinc-500">
              This is a grouped product. Linked child products are managed separately.
            </p>
          </div>
        )}

        {/* Variations (variable products) */}
        {product.product_type === 'variable' && (
          <div>
            <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
              Variations
            </h4>
            <VariationManager productId={product.id} />
          </div>
        )}
      </div>

      {/* Actions Footer */}
      <div className="border-t border-zinc-800 p-3 space-y-2">
        <div className="flex gap-2">
          {product.status !== 'published' && (
            <button
              onClick={() => handleStatusChange('published')}
              className="flex-1 px-3 py-2 text-xs bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors"
            >
              Publish
            </button>
          )}
          {product.status === 'published' && (
            <button
              onClick={() => handleStatusChange('archived')}
              className="flex-1 px-3 py-2 text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-lg hover:border-zinc-500 hover:text-zinc-100 transition-colors"
            >
              Archive
            </button>
          )}
          {product.status === 'archived' && (
            <button
              onClick={() => handleStatusChange('draft')}
              className="flex-1 px-3 py-2 text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-lg hover:border-zinc-500 hover:text-zinc-100 transition-colors"
            >
              Move to Draft
            </button>
          )}
        </div>
        <button
          onClick={handleDelete}
          className={`w-full px-3 py-2 text-xs rounded-lg transition-colors ${
            confirmDelete
              ? 'bg-red-500/30 text-red-300 border border-red-500/50'
              : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
          }`}
        >
          {confirmDelete ? 'Click again to confirm delete' : 'Delete Product'}
        </button>
      </div>
    </div>
  );
}
