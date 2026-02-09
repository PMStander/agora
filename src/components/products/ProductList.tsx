import { useProductsStore, useFilteredProducts } from '../../stores/products';
import { useProducts } from '../../hooks/useProducts';
import {
  PRODUCT_TYPE_CONFIG,
  PRODUCT_STATUS_CONFIG,
  STOCK_STATUS_CONFIG,
  type ProductType,
  type ProductStatus,
  type StockStatus,
} from '../../types/products';

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

// ─── Component ──────────────────────────────────────────────────────────────

export function ProductList() {
  const { getProductPriceRange } = useProducts();
  const products = useFilteredProducts();
  const selectedProductId = useProductsStore((s) => s.selectedProductId);
  const selectProduct = useProductsStore((s) => s.selectProduct);
  const viewMode = useProductsStore((s) => s.viewMode);
  const setViewMode = useProductsStore((s) => s.setViewMode);
  const filters = useProductsStore((s) => s.filters);
  const setFilters = useProductsStore((s) => s.setFilters);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-zinc-100">Products</h2>
          <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
            {products.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Grid/List toggle */}
          <div className="flex items-center bg-zinc-800 border border-zinc-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-2.5 py-1.5 text-xs transition-colors ${
                viewMode === 'grid'
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="Grid view"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-2.5 py-1.5 text-xs transition-colors ${
                viewMode === 'list'
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="List view"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="18" x2="20" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800 bg-zinc-900/30">
        <select
          value={filters.productType}
          onChange={(e) =>
            setFilters({ productType: e.target.value as ProductType | 'all' })
          }
          className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-300"
        >
          <option value="all">All Types</option>
          {(Object.keys(PRODUCT_TYPE_CONFIG) as ProductType[]).map((type) => (
            <option key={type} value={type}>
              {PRODUCT_TYPE_CONFIG[type].label}
            </option>
          ))}
        </select>
        <select
          value={filters.productStatus}
          onChange={(e) =>
            setFilters({ productStatus: e.target.value as ProductStatus | 'all' })
          }
          className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-300"
        >
          <option value="all">All Statuses</option>
          {(Object.keys(PRODUCT_STATUS_CONFIG) as ProductStatus[]).map((status) => (
            <option key={status} value={status}>
              {PRODUCT_STATUS_CONFIG[status].label}
            </option>
          ))}
        </select>
        <select
          value={filters.stockStatus}
          onChange={(e) =>
            setFilters({ stockStatus: e.target.value as StockStatus | 'all' })
          }
          className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-300"
        >
          <option value="all">All Stock</option>
          {(Object.keys(STOCK_STATUS_CONFIG) as StockStatus[]).map((status) => (
            <option key={status} value={status}>
              {STOCK_STATUS_CONFIG[status].label}
            </option>
          ))}
        </select>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {products.length === 0 ? (
          <div className="text-center text-zinc-600 py-12">
            <p className="text-sm">No products found</p>
            <p className="text-xs mt-1">
              {filters.productType !== 'all' ||
              filters.productStatus !== 'all' ||
              filters.stockStatus !== 'all'
                ? 'Try adjusting your filters'
                : 'Create a product to get started'}
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <GridView
            products={products}
            selectedProductId={selectedProductId}
            selectProduct={selectProduct}
            getProductPriceRange={getProductPriceRange}
          />
        ) : (
          <ListView
            products={products}
            selectedProductId={selectedProductId}
            selectProduct={selectProduct}
            getProductPriceRange={getProductPriceRange}
          />
        )}
      </div>
    </div>
  );
}

// ─── Grid View ──────────────────────────────────────────────────────────────

function GridView({
  products,
  selectedProductId,
  selectProduct,
  getProductPriceRange,
}: {
  products: ReturnType<typeof useFilteredProducts>;
  selectedProductId: string | null;
  selectProduct: (id: string | null) => void;
  getProductPriceRange: (id: string) => { min: number; max: number } | null;
}) {
  return (
    <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 p-4">
      {products.map((product) => {
        const typeConfig = PRODUCT_TYPE_CONFIG[product.product_type];
        const statusConfig = PRODUCT_STATUS_CONFIG[product.status];
        const stockConfig = STOCK_STATUS_CONFIG[product.stock_status];
        const priceRange =
          product.product_type === 'variable'
            ? getProductPriceRange(product.id)
            : null;

        return (
          <div
            key={product.id}
            onClick={() => selectProduct(product.id)}
            className={`
              bg-zinc-900 border rounded-lg overflow-hidden cursor-pointer transition-colors
              ${selectedProductId === product.id
                ? 'border-amber-500/50'
                : 'border-zinc-800 hover:border-zinc-700'
              }
            `}
          >
            {/* Image */}
            <div className="aspect-[4/3] bg-zinc-800 flex items-center justify-center overflow-hidden">
              {product.featured_image_url ? (
                <img
                  src={product.featured_image_url}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-zinc-600 text-3xl">
                  <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                  </svg>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="p-3 space-y-2">
              <div>
                <h3 className="text-sm font-medium text-zinc-100 truncate">
                  {product.name}
                </h3>
                {product.sku && (
                  <p className="text-xs text-zinc-500 mt-0.5">SKU: {product.sku}</p>
                )}
              </div>

              {/* Price */}
              <div className="text-sm">
                {priceRange ? (
                  <span className="text-zinc-200">
                    {formatCurrency(priceRange.min, product.currency)}
                    {' - '}
                    {formatCurrency(priceRange.max, product.currency)}
                  </span>
                ) : (
                  <div className="flex items-center gap-2">
                    {product.sale_price != null ? (
                      <>
                        <span className="text-amber-400 font-medium">
                          {formatCurrency(product.sale_price, product.currency)}
                        </span>
                        <span className="text-zinc-500 line-through text-xs">
                          {formatCurrency(product.regular_price, product.currency)}
                        </span>
                      </>
                    ) : (
                      <span className="text-zinc-200">
                        {formatCurrency(product.regular_price, product.currency)}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-1">
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                    statusBadgeColors[typeConfig.color] ?? statusBadgeColors.zinc
                  }`}
                >
                  {typeConfig.label}
                </span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                    statusBadgeColors[statusConfig.color] ?? statusBadgeColors.zinc
                  }`}
                >
                  {statusConfig.label}
                </span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                    statusBadgeColors[stockConfig.color] ?? statusBadgeColors.zinc
                  }`}
                >
                  {stockConfig.label}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── List View ──────────────────────────────────────────────────────────────

function ListView({
  products,
  selectedProductId,
  selectProduct,
  getProductPriceRange,
}: {
  products: ReturnType<typeof useFilteredProducts>;
  selectedProductId: string | null;
  selectProduct: (id: string | null) => void;
  getProductPriceRange: (id: string) => { min: number; max: number } | null;
}) {
  return (
    <div>
      {/* Table header */}
      <div className="grid grid-cols-[40px_2fr_1fr_1fr_1fr_1fr_1fr] gap-2 px-4 py-2 border-b border-zinc-800 bg-zinc-900/50 text-xs text-zinc-500 font-medium sticky top-0">
        <span></span>
        <span>Name</span>
        <span>SKU</span>
        <span>Type</span>
        <span>Status</span>
        <span>Stock</span>
        <span>Price</span>
      </div>

      {/* Table rows */}
      {products.map((product) => {
        const typeConfig = PRODUCT_TYPE_CONFIG[product.product_type];
        const statusConfig = PRODUCT_STATUS_CONFIG[product.status];
        const stockConfig = STOCK_STATUS_CONFIG[product.stock_status];
        const priceRange =
          product.product_type === 'variable'
            ? getProductPriceRange(product.id)
            : null;

        return (
          <div
            key={product.id}
            onClick={() => selectProduct(product.id)}
            className={`
              grid grid-cols-[40px_2fr_1fr_1fr_1fr_1fr_1fr] gap-2 px-4 py-2.5 border-b border-zinc-800/50
              cursor-pointer transition-colors items-center
              ${selectedProductId === product.id
                ? 'bg-zinc-800'
                : 'hover:bg-zinc-800/50'
              }
            `}
          >
            {/* Thumbnail */}
            <div className="w-8 h-8 bg-zinc-800 rounded overflow-hidden flex items-center justify-center shrink-0">
              {product.featured_image_url ? (
                <img
                  src={product.featured_image_url}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <svg className="w-4 h-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
              )}
            </div>

            {/* Name */}
            <span className="text-sm text-zinc-100 truncate">{product.name}</span>

            {/* SKU */}
            <span className="text-sm text-zinc-400 truncate">
              {product.sku ?? '--'}
            </span>

            {/* Type */}
            <span>
              <span
                className={`text-xs px-1.5 py-0.5 rounded ${
                  statusBadgeColors[typeConfig.color] ?? statusBadgeColors.zinc
                }`}
              >
                {typeConfig.label}
              </span>
            </span>

            {/* Status */}
            <span>
              <span
                className={`text-xs px-1.5 py-0.5 rounded ${
                  statusBadgeColors[statusConfig.color] ?? statusBadgeColors.zinc
                }`}
              >
                {statusConfig.label}
              </span>
            </span>

            {/* Stock */}
            <span>
              <span
                className={`text-xs px-1.5 py-0.5 rounded ${
                  statusBadgeColors[stockConfig.color] ?? statusBadgeColors.zinc
                }`}
              >
                {stockConfig.label}
              </span>
            </span>

            {/* Price */}
            <span className="text-sm text-zinc-300">
              {priceRange ? (
                <>
                  {formatCurrency(priceRange.min, product.currency)}
                  {' - '}
                  {formatCurrency(priceRange.max, product.currency)}
                </>
              ) : product.sale_price != null ? (
                <span className="flex items-center gap-1.5">
                  <span className="text-amber-400">
                    {formatCurrency(product.sale_price, product.currency)}
                  </span>
                  <span className="text-zinc-500 line-through text-xs">
                    {formatCurrency(product.regular_price, product.currency)}
                  </span>
                </span>
              ) : (
                formatCurrency(product.regular_price, product.currency)
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
