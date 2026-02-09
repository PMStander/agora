-- ============================================================================
-- Phase 2: Products — Full WooCommerce-style Product Schema
-- ============================================================================

-- ─── Product Categories (hierarchical) ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  parent_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
  image_url TEXT,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_categories_parent ON product_categories(parent_id);
CREATE INDEX idx_product_categories_slug ON product_categories(slug);

-- ─── Product Tags ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS product_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Product Attributes ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS product_attributes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'select' CHECK (type IN ('select', 'text', 'color_swatch')),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Product Attribute Terms ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS product_attribute_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attribute_id UUID NOT NULL REFERENCES product_attributes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(attribute_id, slug)
);

CREATE INDEX idx_product_attribute_terms_attribute ON product_attribute_terms(attribute_id);

-- ─── Products ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  sku TEXT UNIQUE,
  description TEXT,
  short_description TEXT,
  product_type TEXT NOT NULL DEFAULT 'simple'
    CHECK (product_type IN ('simple', 'variable', 'grouped', 'external')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),

  -- Pricing
  regular_price NUMERIC(15,2),
  sale_price NUMERIC(15,2),
  sale_price_from TIMESTAMPTZ,
  sale_price_to TIMESTAMPTZ,
  currency TEXT NOT NULL DEFAULT 'USD',

  -- Tax
  tax_status TEXT NOT NULL DEFAULT 'taxable'
    CHECK (tax_status IN ('taxable', 'shipping_only', 'none')),
  tax_class TEXT,

  -- Inventory
  manage_stock BOOLEAN NOT NULL DEFAULT false,
  stock_quantity INT,
  stock_status TEXT NOT NULL DEFAULT 'instock'
    CHECK (stock_status IN ('instock', 'outofstock', 'onbackorder')),
  backorders_allowed BOOLEAN NOT NULL DEFAULT false,
  low_stock_threshold INT,
  sold_individually BOOLEAN NOT NULL DEFAULT false,

  -- Shipping & Dimensions
  is_virtual BOOLEAN NOT NULL DEFAULT false,
  is_downloadable BOOLEAN NOT NULL DEFAULT false,
  weight NUMERIC(10,3),
  length NUMERIC(10,2),
  width NUMERIC(10,2),
  height NUMERIC(10,2),
  shipping_class TEXT,

  -- External product
  external_url TEXT,
  button_text TEXT,

  -- Hierarchy (grouped/variable parent)
  parent_id UUID REFERENCES products(id) ON DELETE SET NULL,

  -- Media
  featured_image_url TEXT,
  gallery_image_urls TEXT[] NOT NULL DEFAULT '{}',

  -- Downloads
  downloads JSONB NOT NULL DEFAULT '[]',
  download_limit INT DEFAULT -1,
  download_expiry_days INT DEFAULT -1,

  -- Display
  menu_order INT NOT NULL DEFAULT 0,
  purchase_note TEXT,
  catalog_visibility TEXT NOT NULL DEFAULT 'visible'
    CHECK (catalog_visibility IN ('visible', 'catalog', 'search', 'hidden')),

  -- Extensibility
  custom_fields JSONB NOT NULL DEFAULT '{}',

  -- Reviews
  reviews_allowed BOOLEAN NOT NULL DEFAULT true,
  average_rating NUMERIC(3,2) NOT NULL DEFAULT 0,
  rating_count INT NOT NULL DEFAULT 0,

  -- Timestamps
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_type ON products(product_type);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_stock_status ON products(stock_status);
CREATE INDEX idx_products_parent ON products(parent_id);
CREATE INDEX idx_products_created ON products(created_at DESC);

-- ─── Product Variations ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS product_variations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku TEXT,
  description TEXT,

  -- Pricing
  regular_price NUMERIC(15,2),
  sale_price NUMERIC(15,2),
  sale_price_from TIMESTAMPTZ,
  sale_price_to TIMESTAMPTZ,

  -- Inventory
  manage_stock BOOLEAN NOT NULL DEFAULT false,
  stock_quantity INT,
  stock_status TEXT NOT NULL DEFAULT 'instock'
    CHECK (stock_status IN ('instock', 'outofstock', 'onbackorder')),
  backorders_allowed BOOLEAN NOT NULL DEFAULT false,

  -- Attributes (e.g. {"color": "red", "size": "xl"})
  attributes JSONB NOT NULL DEFAULT '{}',

  -- Shipping & Dimensions
  weight NUMERIC(10,3),
  length NUMERIC(10,2),
  width NUMERIC(10,2),
  height NUMERIC(10,2),
  shipping_class TEXT,

  -- Type flags
  is_virtual BOOLEAN NOT NULL DEFAULT false,
  is_downloadable BOOLEAN NOT NULL DEFAULT false,
  downloads JSONB NOT NULL DEFAULT '[]',

  -- Media
  image_url TEXT,

  -- Display
  menu_order INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('draft', 'published', 'archived')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_variations_product ON product_variations(product_id);
CREATE INDEX idx_product_variations_attributes ON product_variations USING GIN (attributes);

-- ─── Junction Tables ───────────────────────────────────────────────────────

-- Product ↔ Category
CREATE TABLE IF NOT EXISTS product_category_map (
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES product_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, category_id)
);

-- Product ↔ Tag
CREATE TABLE IF NOT EXISTS product_tag_map (
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES product_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, tag_id)
);

-- Product ↔ Attribute (which attributes are assigned + variation usage)
CREATE TABLE IF NOT EXISTS product_attribute_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  attribute_id UUID NOT NULL REFERENCES product_attributes(id) ON DELETE CASCADE,
  term_ids UUID[] NOT NULL DEFAULT '{}',
  is_used_for_variations BOOLEAN NOT NULL DEFAULT false,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(product_id, attribute_id)
);

CREATE INDEX idx_product_attribute_map_product ON product_attribute_map(product_id);

-- Grouped Product Members
CREATE TABLE IF NOT EXISTS grouped_product_members (
  group_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (group_id, member_id)
);

-- ─── RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_attribute_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variations ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_category_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_tag_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_attribute_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE grouped_product_members ENABLE ROW LEVEL SECURITY;

-- Permissive policies (tighten when auth is added)
CREATE POLICY "Allow all on product_categories" ON product_categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on product_tags" ON product_tags FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on product_attributes" ON product_attributes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on product_attribute_terms" ON product_attribute_terms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on products" ON products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on product_variations" ON product_variations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on product_category_map" ON product_category_map FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on product_tag_map" ON product_tag_map FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on product_attribute_map" ON product_attribute_map FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on grouped_product_members" ON grouped_product_members FOR ALL USING (true) WITH CHECK (true);

-- ─── Realtime ──────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE products, product_variations, product_categories;

-- ─── Seed: Default Categories ──────────────────────────────────────────────

INSERT INTO product_categories (name, slug, description, display_order) VALUES
  ('Uncategorized', 'uncategorized', 'Default category', 0)
ON CONFLICT (slug) DO NOTHING;
