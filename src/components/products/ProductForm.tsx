import { useState, useEffect } from 'react';
import { useProductsStore } from '../../stores/products';
import { useProducts } from '../../hooks/useProducts';
import {
  PRODUCT_TYPE_CONFIG,
  PRODUCT_STATUS_CONFIG,
  STOCK_STATUS_CONFIG,
  type ProductType,
  type ProductStatus,
  type StockStatus,
} from '../../types/products';

// ─── Props ──────────────────────────────────────────────────────────────────

interface ProductFormProps {
  isOpen: boolean;
  onClose: () => void;
  editProductId?: string | null;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ProductForm({ isOpen, onClose, editProductId }: ProductFormProps) {
  const { createProduct, updateProductDetails } = useProducts();
  const products = useProductsStore((s) => s.products);
  const categories = useProductsStore((s) => s.categories);

  const editProduct = editProductId
    ? products.find((p) => p.id === editProductId) ?? null
    : null;

  // ── Form State ──
  const [productType, setProductType] = useState<ProductType>('simple');
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [sku, setSku] = useState('');
  const [description, setDescription] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [status, setStatus] = useState<ProductStatus>('draft');

  // Pricing
  const [regularPrice, setRegularPrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [salePriceFrom, setSalePriceFrom] = useState('');
  const [salePriceTo, setSalePriceTo] = useState('');
  const [currency, setCurrency] = useState('USD');

  // Inventory
  const [manageStock, setManageStock] = useState(false);
  const [stockQuantity, setStockQuantity] = useState('');
  const [stockStatus, setStockStatus] = useState<StockStatus>('instock');
  const [backordersAllowed, setBackordersAllowed] = useState(false);
  const [lowStockThreshold, setLowStockThreshold] = useState('');

  // Shipping
  const [isVirtual, setIsVirtual] = useState(false);
  const [weight, setWeight] = useState('');
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [shippingClass, setShippingClass] = useState('');

  // External
  const [externalUrl, setExternalUrl] = useState('');
  const [buttonText, setButtonText] = useState('');

  // Categories
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);

  // Media
  const [featuredImageUrl, setFeaturedImageUrl] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [slugDirty, setSlugDirty] = useState(false);

  // ── Populate form when editing ──
  useEffect(() => {
    if (editProduct) {
      setProductType(editProduct.product_type);
      setName(editProduct.name);
      setSlug(editProduct.slug);
      setSku(editProduct.sku ?? '');
      setDescription(editProduct.description ?? '');
      setShortDescription(editProduct.short_description ?? '');
      setStatus(editProduct.status);
      setRegularPrice(editProduct.regular_price?.toString() ?? '');
      setSalePrice(editProduct.sale_price?.toString() ?? '');
      setSalePriceFrom(editProduct.sale_price_from ?? '');
      setSalePriceTo(editProduct.sale_price_to ?? '');
      setCurrency(editProduct.currency);
      setManageStock(editProduct.manage_stock);
      setStockQuantity(editProduct.stock_quantity?.toString() ?? '');
      setStockStatus(editProduct.stock_status);
      setBackordersAllowed(editProduct.backorders_allowed);
      setLowStockThreshold(editProduct.low_stock_threshold?.toString() ?? '');
      setIsVirtual(editProduct.is_virtual);
      setWeight(editProduct.weight?.toString() ?? '');
      setLength(editProduct.length?.toString() ?? '');
      setWidth(editProduct.width?.toString() ?? '');
      setHeight(editProduct.height?.toString() ?? '');
      setShippingClass(editProduct.shipping_class ?? '');
      setExternalUrl(editProduct.external_url ?? '');
      setButtonText(editProduct.button_text ?? '');
      setSelectedCategoryIds(editProduct.category_ids ?? []);
      setFeaturedImageUrl(editProduct.featured_image_url ?? '');
      setSlugDirty(true);
    }
  }, [editProduct]);

  if (!isOpen) return null;

  // Auto-generate slug from name
  const handleNameChange = (value: string) => {
    setName(value);
    if (!slugDirty) {
      setSlug(
        value
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
      );
    }
  };

  const resetForm = () => {
    setProductType('simple');
    setName('');
    setSlug('');
    setSku('');
    setDescription('');
    setShortDescription('');
    setStatus('draft');
    setRegularPrice('');
    setSalePrice('');
    setSalePriceFrom('');
    setSalePriceTo('');
    setCurrency('USD');
    setManageStock(false);
    setStockQuantity('');
    setStockStatus('instock');
    setBackordersAllowed(false);
    setLowStockThreshold('');
    setIsVirtual(false);
    setWeight('');
    setLength('');
    setWidth('');
    setHeight('');
    setShippingClass('');
    setExternalUrl('');
    setButtonText('');
    setSelectedCategoryIds([]);
    setFeaturedImageUrl('');
    setSlugDirty(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);

    const data: Record<string, unknown> = {
      name: name.trim(),
      slug: slug.trim() || name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      product_type: productType,
      status,
      sku: sku.trim() || undefined,
      description: description.trim() || undefined,
      short_description: shortDescription.trim() || undefined,
      regular_price: regularPrice ? parseFloat(regularPrice) : undefined,
      sale_price: salePrice ? parseFloat(salePrice) : undefined,
      sale_price_from: salePriceFrom || undefined,
      sale_price_to: salePriceTo || undefined,
      currency,
      manage_stock: manageStock,
      stock_quantity: stockQuantity ? parseInt(stockQuantity, 10) : undefined,
      stock_status: stockStatus,
      backorders_allowed: backordersAllowed,
      low_stock_threshold: lowStockThreshold
        ? parseInt(lowStockThreshold, 10)
        : undefined,
      is_virtual: isVirtual,
      featured_image_url: featuredImageUrl.trim() || undefined,
    };

    // Shipping fields (only if not virtual)
    if (!isVirtual) {
      if (weight) data.weight = parseFloat(weight);
      if (length) data.length = parseFloat(length);
      if (width) data.width = parseFloat(width);
      if (height) data.height = parseFloat(height);
      if (shippingClass.trim()) data.shipping_class = shippingClass.trim();
    }

    // External fields
    if (productType === 'external') {
      if (externalUrl.trim()) data.external_url = externalUrl.trim();
      if (buttonText.trim()) data.button_text = buttonText.trim();
    }

    try {
      if (editProduct) {
        await updateProductDetails(editProduct.id, data);
      } else {
        await createProduct(
          data as Parameters<typeof createProduct>[0]
        );
      }
      resetForm();
      onClose();
    } catch (err) {
      console.error('Failed to save product:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const showPricing = productType !== 'grouped';
  const showShipping = !isVirtual && productType !== 'external';
  const showExternal = productType === 'external';

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-100">
            {editProduct ? 'Edit Product' : 'Create Product'}
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Product Type Selector */}
          <div>
            <label className="block text-sm text-zinc-400 mb-2">
              Product Type
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(Object.keys(PRODUCT_TYPE_CONFIG) as ProductType[]).map(
                (type) => {
                  const config = PRODUCT_TYPE_CONFIG[type];
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setProductType(type)}
                      className={`
                        px-3 py-2 text-sm rounded-lg border transition-colors text-center
                        ${productType === type
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                          : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300'
                        }
                      `}
                    >
                      {config.label}
                    </button>
                  );
                }
              )}
            </div>
          </div>

          {/* Name + Slug */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">
                Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Product name"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none transition-colors"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Slug</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setSlugDirty(true);
                }}
                placeholder="product-slug"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* SKU + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">SKU</label>
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="PROD-001"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ProductStatus)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-amber-500/50 focus:outline-none transition-colors"
              >
                {(Object.keys(PRODUCT_STATUS_CONFIG) as ProductStatus[]).map(
                  (s) => (
                    <option key={s} value={s}>
                      {PRODUCT_STATUS_CONFIG[s].label}
                    </option>
                  )
                )}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Full product description..."
              rows={3}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none resize-none transition-colors"
            />
          </div>

          {/* Short Description */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">
              Short Description
            </label>
            <input
              type="text"
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              placeholder="Brief product summary"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none transition-colors"
            />
          </div>

          {/* ─── Pricing ─── */}
          {showPricing && (
            <>
              <div className="border-t border-zinc-800 pt-4">
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                  Pricing
                </h3>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">
                    Regular Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={regularPrice}
                    onChange={(e) => setRegularPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">
                    Sale Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">
                    Currency
                  </label>
                  <input
                    type="text"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                    placeholder="USD"
                    maxLength={3}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none transition-colors"
                  />
                </div>
              </div>
              {salePrice && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">
                      Sale From
                    </label>
                    <input
                      type="date"
                      value={salePriceFrom}
                      onChange={(e) => setSalePriceFrom(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-amber-500/50 focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">
                      Sale To
                    </label>
                    <input
                      type="date"
                      value={salePriceTo}
                      onChange={(e) => setSalePriceTo(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-amber-500/50 focus:outline-none transition-colors"
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {/* ─── Inventory ─── */}
          <div className="border-t border-zinc-800 pt-4">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
              Inventory
            </h3>
          </div>
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={manageStock}
                onChange={(e) => setManageStock(e.target.checked)}
                className="rounded border-zinc-600 bg-zinc-800 text-amber-500 focus:ring-amber-500/50"
              />
              Manage stock
            </label>

            {manageStock && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">
                    Stock Quantity
                  </label>
                  <input
                    type="number"
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(e.target.value)}
                    placeholder="0"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">
                    Low Stock Threshold
                  </label>
                  <input
                    type="number"
                    value={lowStockThreshold}
                    onChange={(e) => setLowStockThreshold(e.target.value)}
                    placeholder="5"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none transition-colors"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">
                  Stock Status
                </label>
                <select
                  value={stockStatus}
                  onChange={(e) =>
                    setStockStatus(e.target.value as StockStatus)
                  }
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-amber-500/50 focus:outline-none transition-colors"
                >
                  {(Object.keys(STOCK_STATUS_CONFIG) as StockStatus[]).map(
                    (s) => (
                      <option key={s} value={s}>
                        {STOCK_STATUS_CONFIG[s].label}
                      </option>
                    )
                  )}
                </select>
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={backordersAllowed}
                    onChange={(e) => setBackordersAllowed(e.target.checked)}
                    className="rounded border-zinc-600 bg-zinc-800 text-amber-500 focus:ring-amber-500/50"
                  />
                  Allow backorders
                </label>
              </div>
            </div>
          </div>

          {/* ─── Shipping ─── */}
          {showShipping && (
            <>
              <div className="border-t border-zinc-800 pt-4">
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                  Shipping
                </h3>
              </div>

              <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer mb-3">
                <input
                  type="checkbox"
                  checked={isVirtual}
                  onChange={(e) => setIsVirtual(e.target.checked)}
                  className="rounded border-zinc-600 bg-zinc-800 text-amber-500 focus:ring-amber-500/50"
                />
                Virtual product (no shipping)
              </label>

              {!isVirtual && (
                <>
                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <label className="block text-sm text-zinc-400 mb-1">
                        Weight (kg)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={weight}
                        onChange={(e) => setWeight(e.target.value)}
                        placeholder="0"
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-zinc-400 mb-1">
                        L (cm)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={length}
                        onChange={(e) => setLength(e.target.value)}
                        placeholder="0"
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-zinc-400 mb-1">
                        W (cm)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={width}
                        onChange={(e) => setWidth(e.target.value)}
                        placeholder="0"
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-zinc-400 mb-1">
                        H (cm)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={height}
                        onChange={(e) => setHeight(e.target.value)}
                        placeholder="0"
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none transition-colors"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">
                      Shipping Class
                    </label>
                    <input
                      type="text"
                      value={shippingClass}
                      onChange={(e) => setShippingClass(e.target.value)}
                      placeholder="standard, express, freight..."
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none transition-colors"
                    />
                  </div>
                </>
              )}
            </>
          )}

          {/* ─── External ─── */}
          {showExternal && (
            <>
              <div className="border-t border-zinc-800 pt-4">
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                  External Product
                </h3>
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">
                  External URL
                </label>
                <input
                  type="url"
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  placeholder="https://example.com/product"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">
                  Button Text
                </label>
                <input
                  type="text"
                  value={buttonText}
                  onChange={(e) => setButtonText(e.target.value)}
                  placeholder="Buy Now"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none transition-colors"
                />
              </div>
            </>
          )}

          {/* ─── Categories ─── */}
          {categories.length > 0 && (
            <>
              <div className="border-t border-zinc-800 pt-4">
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                  Categories
                </h3>
              </div>
              <div className="max-h-36 overflow-y-auto bg-zinc-800 border border-zinc-700 rounded-lg p-3 space-y-1.5">
                {categories.map((cat) => (
                  <label
                    key={cat.id}
                    className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer hover:text-zinc-100"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCategoryIds.includes(cat.id)}
                      onChange={() => toggleCategory(cat.id)}
                      className="rounded border-zinc-600 bg-zinc-700 text-amber-500 focus:ring-amber-500/50"
                    />
                    {cat.name}
                  </label>
                ))}
              </div>
            </>
          )}

          {/* ─── Featured Image ─── */}
          <div className="border-t border-zinc-800 pt-4">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
              Media
            </h3>
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">
              Featured Image URL
            </label>
            <input
              type="url"
              value={featuredImageUrl}
              onChange={(e) => setFeaturedImageUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none transition-colors"
            />
          </div>

          {/* ─── Actions ─── */}
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
              disabled={!name.trim() || isSubmitting}
              className="px-5 py-2 text-sm bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting
                ? 'Saving...'
                : editProduct
                  ? 'Save Changes'
                  : 'Create Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
