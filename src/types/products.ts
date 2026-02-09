// ─── Product Types ──────────────────────────────────────────────────────────

export type ProductType = 'simple' | 'variable' | 'grouped' | 'external';
export type ProductStatus = 'draft' | 'published' | 'archived';
export type StockStatus = 'instock' | 'outofstock' | 'onbackorder';
export type TaxStatus = 'taxable' | 'shipping_only' | 'none';
export type CatalogVisibility = 'visible' | 'catalog' | 'search' | 'hidden';

export type OrderType = 'order' | 'quote' | 'invoice';
export type OrderStatus =
  | 'pending'
  | 'processing'
  | 'on_hold'
  | 'completed'
  | 'cancelled'
  | 'refunded'
  | 'failed'
  | 'draft';
export type PaymentStatus = 'unpaid' | 'paid' | 'partially_paid' | 'refunded';

// ─── Product Entities ───────────────────────────────────────────────────────

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
  image_url: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface ProductTag {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface ProductAttribute {
  id: string;
  name: string;
  slug: string;
  type: 'select' | 'text' | 'color_swatch';
  sort_order: number;
  terms: ProductAttributeTerm[];
  created_at: string;
}

export interface ProductAttributeTerm {
  id: string;
  attribute_id: string;
  name: string;
  slug: string;
  sort_order: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  description: string | null;
  short_description: string | null;
  product_type: ProductType;
  status: ProductStatus;

  // Pricing
  regular_price: number | null;
  sale_price: number | null;
  sale_price_from: string | null;
  sale_price_to: string | null;
  currency: string;

  // Tax
  tax_status: TaxStatus;
  tax_class: string | null;

  // Inventory
  manage_stock: boolean;
  stock_quantity: number | null;
  stock_status: StockStatus;
  backorders_allowed: boolean;
  low_stock_threshold: number | null;
  sold_individually: boolean;

  // Shipping
  is_virtual: boolean;
  is_downloadable: boolean;
  weight: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  shipping_class: string | null;

  // External
  external_url: string | null;
  button_text: string | null;

  // Hierarchy
  parent_id: string | null;

  // Media
  featured_image_url: string | null;
  gallery_image_urls: string[];

  // Downloads
  downloads: unknown[];
  download_limit: number;
  download_expiry_days: number;

  // Display
  menu_order: number;
  purchase_note: string | null;
  catalog_visibility: CatalogVisibility;

  // Extensibility
  custom_fields: Record<string, unknown>;

  // Reviews
  reviews_allowed: boolean;
  average_rating: number;
  rating_count: number;

  // Timestamps
  published_at: string | null;
  created_at: string;
  updated_at: string;

  // Client-side enrichment (not in DB)
  category_ids?: string[];
  tag_ids?: string[];
  variations?: ProductVariation[];
}

export interface ProductVariation {
  id: string;
  product_id: string;
  sku: string | null;
  description: string | null;

  regular_price: number | null;
  sale_price: number | null;
  sale_price_from: string | null;
  sale_price_to: string | null;

  manage_stock: boolean;
  stock_quantity: number | null;
  stock_status: StockStatus;
  backorders_allowed: boolean;

  attributes: Record<string, string>;

  weight: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  shipping_class: string | null;

  is_virtual: boolean;
  is_downloadable: boolean;
  downloads: unknown[];

  image_url: string | null;
  menu_order: number;
  status: ProductStatus;

  created_at: string;
  updated_at: string;
}

// ─── Order Entities ─────────────────────────────────────────────────────────

export interface Order {
  id: string;
  order_number: string;
  order_type: OrderType;
  status: OrderStatus;

  contact_id: string | null;
  company_id: string | null;
  deal_id: string | null;

  subtotal: number;
  tax_total: number;
  shipping_total: number;
  discount_total: number;
  total: number;
  currency: string;

  billing_address: Record<string, unknown>;
  shipping_address: Record<string, unknown>;

  payment_method: string | null;
  payment_status: PaymentStatus;

  customer_note: string | null;
  internal_note: string | null;
  owner_agent_id: string | null;

  created_at: string;
  updated_at: string;

  // Client-side enrichment
  line_items?: OrderLineItem[];
}

export interface OrderLineItem {
  id: string;
  order_id: string;
  product_id: string | null;
  variation_id: string | null;

  name: string;
  sku: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
  tax_amount: number;
  total: number;

  attributes: Record<string, string>;
  metadata: Record<string, unknown>;

  created_at: string;
}

export interface DealProduct {
  id: string;
  deal_id: string;
  product_id: string;
  variation_id: string | null;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  subtotal: number;
  notes: string | null;
  created_at: string;
}

// ─── Config Objects ─────────────────────────────────────────────────────────

export const PRODUCT_TYPE_CONFIG: Record<ProductType, { label: string; color: string }> = {
  simple: { label: 'Simple', color: 'blue' },
  variable: { label: 'Variable', color: 'purple' },
  grouped: { label: 'Grouped', color: 'cyan' },
  external: { label: 'External', color: 'amber' },
};

export const PRODUCT_STATUS_CONFIG: Record<ProductStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'zinc' },
  published: { label: 'Published', color: 'green' },
  archived: { label: 'Archived', color: 'red' },
};

export const STOCK_STATUS_CONFIG: Record<StockStatus, { label: string; color: string }> = {
  instock: { label: 'In Stock', color: 'green' },
  outofstock: { label: 'Out of Stock', color: 'red' },
  onbackorder: { label: 'On Backorder', color: 'amber' },
};

export const ORDER_STATUS_CONFIG: Record<OrderStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'amber' },
  processing: { label: 'Processing', color: 'blue' },
  on_hold: { label: 'On Hold', color: 'zinc' },
  completed: { label: 'Completed', color: 'green' },
  cancelled: { label: 'Cancelled', color: 'red' },
  refunded: { label: 'Refunded', color: 'purple' },
  failed: { label: 'Failed', color: 'red' },
  draft: { label: 'Draft', color: 'zinc' },
};

export const ORDER_TYPE_CONFIG: Record<OrderType, { label: string; color: string }> = {
  order: { label: 'Order', color: 'blue' },
  quote: { label: 'Quote', color: 'amber' },
  invoice: { label: 'Invoice', color: 'green' },
};

export const PAYMENT_STATUS_CONFIG: Record<PaymentStatus, { label: string; color: string }> = {
  unpaid: { label: 'Unpaid', color: 'red' },
  paid: { label: 'Paid', color: 'green' },
  partially_paid: { label: 'Partial', color: 'amber' },
  refunded: { label: 'Refunded', color: 'purple' },
};
