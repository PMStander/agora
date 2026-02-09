import { useCallback, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useProductsStore } from '../stores/products';
import { handleRealtimePayload } from '../lib/realtimeHelpers';
import type {
  Product,
  ProductVariation,
  ProductAttribute,
  ProductCategory,
  ProductTag,
  Order,
  OrderLineItem,
  ProductType,
  ProductStatus,
  OrderStatus,
} from '../types/products';

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useProducts() {
  const store = useProductsStore();
  const initializedRef = useRef(false);

  // ── Initial fetch + realtime subscriptions ──
  useEffect(() => {
    if (!isSupabaseConfigured() || initializedRef.current) return;
    initializedRef.current = true;

    // Fetch products
    supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) store.setProducts(data as Product[]);
      });

    // Fetch variations
    supabase
      .from('product_variations')
      .select('*')
      .order('menu_order')
      .then(({ data, error }) => {
        if (!error && data) store.setVariations(data as ProductVariation[]);
      });

    // Fetch attributes with terms
    supabase
      .from('product_attributes')
      .select('*, product_attribute_terms(*)')
      .order('sort_order')
      .then(({ data, error }) => {
        if (!error && data) {
          store.setAttributes(
            data.map((a: any) => ({
              ...a,
              terms: (a.product_attribute_terms || []).sort(
                (x: any, y: any) => x.sort_order - y.sort_order
              ),
            })) as ProductAttribute[]
          );
        }
      });

    // Fetch categories
    supabase
      .from('product_categories')
      .select('*')
      .order('display_order')
      .then(({ data, error }) => {
        if (!error && data) store.setCategories(data as ProductCategory[]);
      });

    // Fetch tags
    supabase
      .from('product_tags')
      .select('*')
      .order('name')
      .then(({ data, error }) => {
        if (!error && data) store.setTags(data as ProductTag[]);
      });

    // Fetch orders
    supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (!error && data) store.setOrders(data as Order[]);
      });

    // ── Realtime subscriptions ──
    const productsSub = supabase
      .channel('products-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        (payload) =>
          handleRealtimePayload<Product>(
            payload,
            store.addProduct,
            store.updateProduct,
            store.removeProduct
          )
      )
      .subscribe();

    const variationsSub = supabase
      .channel('variations-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'product_variations' },
        (payload) =>
          handleRealtimePayload<ProductVariation>(
            payload,
            store.addVariation,
            store.updateVariation,
            store.removeVariation
          )
      )
      .subscribe();

    const ordersSub = supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) =>
          handleRealtimePayload<Order>(
            payload,
            store.addOrder,
            store.updateOrder,
            store.removeOrder
          )
      )
      .subscribe();

    return () => {
      productsSub.unsubscribe();
      variationsSub.unsubscribe();
      ordersSub.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Product CRUD ──

  const createProduct = useCallback(
    async (data: {
      name: string;
      slug: string;
      product_type?: ProductType;
      status?: ProductStatus;
      sku?: string;
      description?: string;
      short_description?: string;
      regular_price?: number;
      sale_price?: number;
      currency?: string;
      manage_stock?: boolean;
      stock_quantity?: number;
      is_virtual?: boolean;
      is_downloadable?: boolean;
      featured_image_url?: string;
      external_url?: string;
      button_text?: string;
      custom_fields?: Record<string, unknown>;
    }) => {
      const { data: product, error } = await supabase
        .from('products')
        .insert(data)
        .select()
        .single();
      if (error) {
        console.error('[Products] Error creating product:', error);
        return null;
      }
      store.addProduct(product as Product);
      return product as Product;
    },
    [store]
  );

  const updateProductDetails = useCallback(
    async (productId: string, updates: Partial<Product>) => {
      const { error } = await supabase
        .from('products')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', productId);
      if (error) {
        console.error('[Products] Error updating product:', error);
        return;
      }
      store.updateProduct(productId, updates);
    },
    [store]
  );

  const deleteProduct = useCallback(
    async (productId: string) => {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);
      if (error) {
        console.error('[Products] Error deleting product:', error);
        return;
      }
      store.removeProduct(productId);
    },
    [store]
  );

  // ── Variation CRUD ──

  const createVariation = useCallback(
    async (data: {
      product_id: string;
      sku?: string;
      regular_price?: number;
      sale_price?: number;
      attributes?: Record<string, string>;
      stock_quantity?: number;
      manage_stock?: boolean;
      image_url?: string;
    }) => {
      const { data: variation, error } = await supabase
        .from('product_variations')
        .insert(data)
        .select()
        .single();
      if (error) {
        console.error('[Products] Error creating variation:', error);
        return null;
      }
      store.addVariation(variation as ProductVariation);
      return variation as ProductVariation;
    },
    [store]
  );

  const updateVariationDetails = useCallback(
    async (variationId: string, updates: Partial<ProductVariation>) => {
      const { error } = await supabase
        .from('product_variations')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', variationId);
      if (error) {
        console.error('[Products] Error updating variation:', error);
        return;
      }
      store.updateVariation(variationId, updates);
    },
    [store]
  );

  const deleteVariation = useCallback(
    async (variationId: string) => {
      const { error } = await supabase
        .from('product_variations')
        .delete()
        .eq('id', variationId);
      if (error) {
        console.error('[Products] Error deleting variation:', error);
        return;
      }
      store.removeVariation(variationId);
    },
    [store]
  );

  // ── Order CRUD ──

  const createOrder = useCallback(
    async (data: {
      order_number: string;
      order_type?: string;
      contact_id?: string;
      company_id?: string;
      deal_id?: string;
      currency?: string;
      customer_note?: string;
      internal_note?: string;
      owner_agent_id?: string;
      line_items?: Array<{
        product_id?: string;
        variation_id?: string;
        name: string;
        sku?: string;
        quantity: number;
        unit_price: number;
        attributes?: Record<string, string>;
      }>;
    }) => {
      const { line_items, ...orderData } = data;

      const { data: order, error } = await supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single();
      if (error) {
        console.error('[Products] Error creating order:', error);
        return null;
      }

      // Insert line items if provided
      if (line_items?.length) {
        const items = line_items.map((li) => ({
          order_id: order.id,
          product_id: li.product_id,
          variation_id: li.variation_id,
          name: li.name,
          sku: li.sku,
          quantity: li.quantity,
          unit_price: li.unit_price,
          subtotal: li.quantity * li.unit_price,
          total: li.quantity * li.unit_price,
          attributes: li.attributes || {},
        }));

        await supabase.from('order_line_items').insert(items);

        // Update order totals
        const subtotal = items.reduce((sum, i) => sum + i.total, 0);
        await supabase
          .from('orders')
          .update({ subtotal, total: subtotal })
          .eq('id', order.id);

        order.subtotal = subtotal;
        order.total = subtotal;
      }

      store.addOrder(order as Order);
      return order as Order;
    },
    [store]
  );

  const updateOrderStatus = useCallback(
    async (orderId: string, status: OrderStatus) => {
      const { error } = await supabase
        .from('orders')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', orderId);
      if (error) {
        console.error('[Products] Error updating order:', error);
        return;
      }
      store.updateOrder(orderId, { status });
    },
    [store]
  );

  const deleteOrder = useCallback(
    async (orderId: string) => {
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId);
      if (error) {
        console.error('[Products] Error deleting order:', error);
        return;
      }
      store.removeOrder(orderId);
    },
    [store]
  );

  // ── Category CRUD ──

  const createCategory = useCallback(
    async (data: {
      name: string;
      slug: string;
      description?: string;
      parent_id?: string;
      image_url?: string;
    }) => {
      const { data: category, error } = await supabase
        .from('product_categories')
        .insert(data)
        .select()
        .single();
      if (error) {
        console.error('[Products] Error creating category:', error);
        return null;
      }
      store.addCategory(category as ProductCategory);
      return category as ProductCategory;
    },
    [store]
  );

  const deleteCategory = useCallback(
    async (categoryId: string) => {
      const { error } = await supabase
        .from('product_categories')
        .delete()
        .eq('id', categoryId);
      if (error) {
        console.error('[Products] Error deleting category:', error);
        return;
      }
      store.removeCategory(categoryId);
    },
    [store]
  );

  // ── Computed helpers ──

  /** Get effective price for a product (handles sale date windows) */
  const getEffectivePrice = useCallback((product: Product): number | null => {
    if (product.sale_price != null) {
      const now = new Date();
      const from = product.sale_price_from ? new Date(product.sale_price_from) : null;
      const to = product.sale_price_to ? new Date(product.sale_price_to) : null;

      if (from && now < from) return product.regular_price;
      if (to && now > to) return product.regular_price;
      return product.sale_price;
    }
    return product.regular_price;
  }, []);

  /** Get price range for a variable product across its variations */
  const getProductPriceRange = useCallback(
    (productId: string): { min: number; max: number } | null => {
      const productVariations = store.variations.filter(
        (v) => v.product_id === productId
      );
      if (productVariations.length === 0) return null;

      const prices = productVariations
        .map((v) => v.sale_price ?? v.regular_price)
        .filter((p): p is number => p != null);

      if (prices.length === 0) return null;
      return { min: Math.min(...prices), max: Math.max(...prices) };
    },
    [store.variations]
  );

  /** Fetch line items for a specific order */
  const fetchOrderLineItems = useCallback(
    async (orderId: string): Promise<OrderLineItem[]> => {
      const { data, error } = await supabase
        .from('order_line_items')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at');
      if (error) {
        console.error('[Products] Error fetching line items:', error);
        return [];
      }
      return data as OrderLineItem[];
    },
    []
  );

  return {
    // Data
    products: store.products,
    variations: store.variations,
    attributes: store.attributes,
    categories: store.categories,
    tags: store.tags,
    orders: store.orders,

    // Product
    createProduct,
    updateProductDetails,
    deleteProduct,

    // Variation
    createVariation,
    updateVariationDetails,
    deleteVariation,

    // Order
    createOrder,
    updateOrderStatus,
    deleteOrder,
    fetchOrderLineItems,

    // Category
    createCategory,
    deleteCategory,

    // Computed
    getEffectivePrice,
    getProductPriceRange,

    // State
    isConfigured: isSupabaseConfigured(),
  };
}
