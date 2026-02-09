import { useState } from 'react';
import { useProductsStore } from '../../stores/products';
import { useProducts } from '../../hooks/useProducts';
import { ProductList } from './ProductList';
import { CategoryTree } from './CategoryTree';
import { ProductDetail } from './ProductDetail';
import { ProductForm } from './ProductForm';
import { OrderList } from './OrderList';
import { OrderDetail } from './OrderDetail';

const SUB_TABS = [
  { id: 'catalog', label: 'Catalog' },
  { id: 'categories', label: 'Categories' },
  { id: 'orders', label: 'Orders' },
] as const;

export function ProductsTab() {
  // Initialize data fetching + realtime subscriptions
  useProducts();

  const activeSubTab = useProductsStore((s) => s.activeSubTab);
  const setActiveSubTab = useProductsStore((s) => s.setActiveSubTab);
  const selectedProductId = useProductsStore((s) => s.selectedProductId);
  const selectedOrderId = useProductsStore((s) => s.selectedOrderId);
  const searchQuery = useProductsStore((s) => s.searchQuery);
  const setSearchQuery = useProductsStore((s) => s.setSearchQuery);

  const [showProductForm, setShowProductForm] = useState(false);

  return (
    <div className="flex flex-col h-full">
      {/* Sub-navigation bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center gap-1">
          {SUB_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`
                px-4 py-1.5 text-sm font-medium rounded-lg transition-colors
                ${activeSubTab === tab.id
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {activeSubTab === 'catalog' && (
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products..."
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-300 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 w-64"
            />
          )}
          {activeSubTab === 'catalog' && (
            <button
              onClick={() => setShowProductForm(true)}
              className="px-4 py-1.5 bg-amber-500 text-black text-sm font-medium rounded-lg hover:bg-amber-400 transition-colors"
            >
              New Product
            </button>
          )}
        </div>
      </div>

      {/* Sub-tab content */}
      <div className="flex-1 overflow-hidden flex">
        <div className="flex-1 overflow-hidden">
          {activeSubTab === 'catalog' && <ProductList />}
          {activeSubTab === 'categories' && <CategoryTree />}
          {activeSubTab === 'orders' && <OrderList />}
        </div>

        {/* Detail panels */}
        {activeSubTab === 'catalog' && selectedProductId && <ProductDetail />}
        {activeSubTab === 'orders' && selectedOrderId && (
          <div className="w-80 border-l border-zinc-800 bg-zinc-900/50">
            <OrderDetail />
          </div>
        )}
      </div>

      {/* Product Form Modal */}
      <ProductForm
        isOpen={showProductForm}
        onClose={() => setShowProductForm(false)}
      />
    </div>
  );
}
