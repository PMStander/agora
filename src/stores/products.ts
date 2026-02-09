import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type {
  Product,
  ProductVariation,
  ProductAttribute,
  ProductCategory,
  ProductTag,
  Order,
  ProductType,
  ProductStatus,
  StockStatus,
  OrderStatus,
} from '../types/products';

// ─── Store Interface ────────────────────────────────────────────────────────

interface ProductsState {
  // Data (loaded from Supabase, NOT persisted to localStorage)
  products: Product[];
  variations: ProductVariation[];
  attributes: ProductAttribute[];
  categories: ProductCategory[];
  tags: ProductTag[];
  orders: Order[];

  // UI State (persisted)
  selectedProductId: string | null;
  selectedOrderId: string | null;
  selectedCategoryId: string | null;
  activeSubTab: 'catalog' | 'categories' | 'orders';
  searchQuery: string;
  viewMode: 'grid' | 'list';
  filters: {
    productType: ProductType | 'all';
    productStatus: ProductStatus | 'all';
    stockStatus: StockStatus | 'all';
    categoryId: string | null;
    orderStatus: OrderStatus | 'all';
  };

  // ─── Product Actions ──────────────────────────────────────
  setProducts: (products: Product[]) => void;
  addProduct: (product: Product) => void;
  updateProduct: (productId: string, updates: Partial<Product>) => void;
  removeProduct: (productId: string) => void;

  // ─── Variation Actions ────────────────────────────────────
  setVariations: (variations: ProductVariation[]) => void;
  addVariation: (variation: ProductVariation) => void;
  updateVariation: (variationId: string, updates: Partial<ProductVariation>) => void;
  removeVariation: (variationId: string) => void;

  // ─── Attribute Actions ────────────────────────────────────
  setAttributes: (attributes: ProductAttribute[]) => void;

  // ─── Category Actions ─────────────────────────────────────
  setCategories: (categories: ProductCategory[]) => void;
  addCategory: (category: ProductCategory) => void;
  removeCategory: (categoryId: string) => void;

  // ─── Tag Actions ──────────────────────────────────────────
  setTags: (tags: ProductTag[]) => void;

  // ─── Order Actions ────────────────────────────────────────
  setOrders: (orders: Order[]) => void;
  addOrder: (order: Order) => void;
  updateOrder: (orderId: string, updates: Partial<Order>) => void;
  removeOrder: (orderId: string) => void;

  // ─── UI Actions ───────────────────────────────────────────
  selectProduct: (id: string | null) => void;
  selectOrder: (id: string | null) => void;
  selectCategory: (id: string | null) => void;
  setActiveSubTab: (tab: ProductsState['activeSubTab']) => void;
  setSearchQuery: (query: string) => void;
  setViewMode: (mode: 'grid' | 'list') => void;
  setFilters: (filters: Partial<ProductsState['filters']>) => void;
}

// ─── Store ──────────────────────────────────────────────────────────────────

const PRODUCTS_STORAGE_KEY = 'agora-products-v1';

export const useProductsStore = create<ProductsState>()(
  persist(
    (set) => ({
      // Initial data
      products: [],
      variations: [],
      attributes: [],
      categories: [],
      tags: [],
      orders: [],

      // UI State
      selectedProductId: null,
      selectedOrderId: null,
      selectedCategoryId: null,
      activeSubTab: 'catalog',
      searchQuery: '',
      viewMode: 'grid',
      filters: {
        productType: 'all',
        productStatus: 'all',
        stockStatus: 'all',
        categoryId: null,
        orderStatus: 'all',
      },

      // Product Actions (upsert pattern)
      setProducts: (products) => set({ products }),
      addProduct: (product) =>
        set((state) => {
          const idx = state.products.findIndex((p) => p.id === product.id);
          if (idx === -1) return { products: [product, ...state.products] };
          const products = [...state.products];
          products[idx] = { ...products[idx], ...product };
          return { products };
        }),
      updateProduct: (productId, updates) =>
        set((state) => ({
          products: state.products.map((p) =>
            p.id === productId ? { ...p, ...updates } : p
          ),
        })),
      removeProduct: (productId) =>
        set((state) => ({
          products: state.products.filter((p) => p.id !== productId),
          selectedProductId:
            state.selectedProductId === productId ? null : state.selectedProductId,
        })),

      // Variation Actions
      setVariations: (variations) => set({ variations }),
      addVariation: (variation) =>
        set((state) => {
          const idx = state.variations.findIndex((v) => v.id === variation.id);
          if (idx === -1) return { variations: [variation, ...state.variations] };
          const variations = [...state.variations];
          variations[idx] = { ...variations[idx], ...variation };
          return { variations };
        }),
      updateVariation: (variationId, updates) =>
        set((state) => ({
          variations: state.variations.map((v) =>
            v.id === variationId ? { ...v, ...updates } : v
          ),
        })),
      removeVariation: (variationId) =>
        set((state) => ({
          variations: state.variations.filter((v) => v.id !== variationId),
        })),

      // Attribute Actions
      setAttributes: (attributes) => set({ attributes }),

      // Category Actions
      setCategories: (categories) => set({ categories }),
      addCategory: (category) =>
        set((state) => {
          const idx = state.categories.findIndex((c) => c.id === category.id);
          if (idx === -1) return { categories: [...state.categories, category] };
          const categories = [...state.categories];
          categories[idx] = { ...categories[idx], ...category };
          return { categories };
        }),
      removeCategory: (categoryId) =>
        set((state) => ({
          categories: state.categories.filter((c) => c.id !== categoryId),
          selectedCategoryId:
            state.selectedCategoryId === categoryId ? null : state.selectedCategoryId,
        })),

      // Tag Actions
      setTags: (tags) => set({ tags }),

      // Order Actions
      setOrders: (orders) => set({ orders }),
      addOrder: (order) =>
        set((state) => {
          const idx = state.orders.findIndex((o) => o.id === order.id);
          if (idx === -1) return { orders: [order, ...state.orders] };
          const orders = [...state.orders];
          orders[idx] = { ...orders[idx], ...order };
          return { orders };
        }),
      updateOrder: (orderId, updates) =>
        set((state) => ({
          orders: state.orders.map((o) =>
            o.id === orderId ? { ...o, ...updates } : o
          ),
        })),
      removeOrder: (orderId) =>
        set((state) => ({
          orders: state.orders.filter((o) => o.id !== orderId),
          selectedOrderId:
            state.selectedOrderId === orderId ? null : state.selectedOrderId,
        })),

      // UI Actions
      selectProduct: (id) => set({ selectedProductId: id }),
      selectOrder: (id) => set({ selectedOrderId: id }),
      selectCategory: (id) => set({ selectedCategoryId: id }),
      setActiveSubTab: (tab) => set({ activeSubTab: tab }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setViewMode: (mode) => set({ viewMode: mode }),
      setFilters: (filters) =>
        set((state) => ({ filters: { ...state.filters, ...filters } })),
    }),
    {
      name: PRODUCTS_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Supabase-first: only persist UI state, NOT entity data
      partialize: (state) => ({
        selectedProductId: state.selectedProductId,
        selectedOrderId: state.selectedOrderId,
        selectedCategoryId: state.selectedCategoryId,
        activeSubTab: state.activeSubTab,
        viewMode: state.viewMode,
        filters: state.filters,
      }),
    }
  )
);

// ─── Selectors ──────────────────────────────────────────────────────────────

export const useSelectedProduct = () => {
  const products = useProductsStore((s) => s.products);
  const selectedId = useProductsStore((s) => s.selectedProductId);
  return products.find((p) => p.id === selectedId) || null;
};

export const useSelectedOrder = () => {
  const orders = useProductsStore((s) => s.orders);
  const selectedId = useProductsStore((s) => s.selectedOrderId);
  return orders.find((o) => o.id === selectedId) || null;
};

export const useVariationsForProduct = (productId: string | null) => {
  const variations = useProductsStore((s) => s.variations);
  if (!productId) return [];
  return variations.filter((v) => v.product_id === productId);
};

export const useFilteredProducts = () => {
  const products = useProductsStore((s) => s.products);
  const searchQuery = useProductsStore((s) => s.searchQuery);
  const filters = useProductsStore((s) => s.filters);

  return products.filter((product) => {
    if (filters.productType !== 'all' && product.product_type !== filters.productType)
      return false;
    if (filters.productStatus !== 'all' && product.status !== filters.productStatus)
      return false;
    if (filters.stockStatus !== 'all' && product.stock_status !== filters.stockStatus)
      return false;
    if (
      filters.categoryId &&
      product.category_ids &&
      !product.category_ids.includes(filters.categoryId)
    )
      return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        product.name.toLowerCase().includes(q) ||
        (product.sku?.toLowerCase().includes(q) ?? false) ||
        (product.description?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });
};

export const useFilteredOrders = () => {
  const orders = useProductsStore((s) => s.orders);
  const filters = useProductsStore((s) => s.filters);

  return orders.filter((order) => {
    if (filters.orderStatus !== 'all' && order.status !== filters.orderStatus)
      return false;
    return true;
  });
};

export const useCategoryTree = () => {
  const categories = useProductsStore((s) => s.categories);
  const roots = categories.filter((c) => !c.parent_id);
  const getChildren = (parentId: string): ProductCategory[] =>
    categories.filter((c) => c.parent_id === parentId);
  return { roots, getChildren, all: categories };
};
