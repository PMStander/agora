import type { A2UIMessage, A2UIComponent } from '../../../hooks/useA2UI';
import { registerTemplate } from '../registry';

// --- Pattern matching ---

const PRODUCT_KEYWORDS = ['product', 'item', 'sku', 'inventory', 'stock', 'catalog'];
const PRICE_PATTERN = /(?:price|cost|priced?\s+at)[:\s]*(?:[A-Z]{3}\s*)?[R$€£]?\s*([\d,]+(?:\.\d{1,2})?)/i;
const CURRENCY_PRICE = /[R$€£]\s*([\d,]+(?:\.\d{1,2})?)/;
const SALE_PRICE_PATTERN = /(?:sale|discount(?:ed)?|special)\s*(?:price)?[:\s]*(?:[A-Z]{3}\s*)?[R$€£]?\s*([\d,]+(?:\.\d{1,2})?)/i;
const STOCK_PATTERN = /(?:in\s*stock|out\s*of\s*stock|available|unavailable|back\s*order|(\d+)\s*(?:in\s+stock|available|units?\s+left|remaining))/i;
const PRODUCT_TYPE_PATTERN = /(?:type|kind)[:\s]*(simple|variable|grouped|external|digital|physical)/i;
const VARIANT_PATTERN = /(?:variant|variation|option|size|color)[:\s]+(.+?)(?:[.,;\n]|$)/gim;
const PRODUCT_NAME_PATTERN = /(?:product|item)\s*(?:name)?[:\s]+["']?([^"'\n]+?)["']?(?:\s*[-–—]|\s*$|\s*\n)/im;

registerTemplate({
  id: 'product-card',
  name: 'Product Card',

  match(text: string): number {
    const lower = text.toLowerCase();
    let score = 0;

    // Product keywords
    const hits = PRODUCT_KEYWORDS.filter(kw => lower.includes(kw));
    score += Math.min(hits.length * 0.12, 0.35);

    // Price signal
    if (PRICE_PATTERN.test(text) || CURRENCY_PRICE.test(text)) score += 0.2;

    // Stock status
    if (STOCK_PATTERN.test(text)) score += 0.15;

    // Product type or variants
    if (PRODUCT_TYPE_PATTERN.test(text)) score += 0.1;
    VARIANT_PATTERN.lastIndex = 0;
    if (VARIANT_PATTERN.test(text)) score += 0.1;

    return score;
  },

  extract(text: string): Record<string, unknown> {
    // Price
    let price: number | null = null;
    let currency = 'USD';
    const priceMatch = text.match(PRICE_PATTERN);
    if (priceMatch) {
      price = parseFloat(priceMatch[1].replace(/,/g, ''));
    } else {
      const currMatch = text.match(CURRENCY_PRICE);
      if (currMatch) price = parseFloat(currMatch[1].replace(/,/g, ''));
    }

    // Currency detection
    if (/\bR\s*[\d,]/.test(text) || /\bZAR\b/i.test(text)) currency = 'ZAR';
    else if (/€/.test(text) || /\bEUR\b/i.test(text)) currency = 'EUR';
    else if (/£/.test(text) || /\bGBP\b/i.test(text)) currency = 'GBP';

    // Sale price
    const salePriceMatch = text.match(SALE_PRICE_PATTERN);
    const salePrice = salePriceMatch ? parseFloat(salePriceMatch[1].replace(/,/g, '')) : null;

    // Stock
    let stockStatus = 'instock';
    const stockMatch = text.match(STOCK_PATTERN);
    if (stockMatch) {
      const lower = stockMatch[0].toLowerCase();
      if (lower.includes('out') || lower.includes('unavailable')) stockStatus = 'outofstock';
      else if (lower.includes('back')) stockStatus = 'onbackorder';
    }

    // Product type
    const typeMatch = text.match(PRODUCT_TYPE_PATTERN);
    const productType = typeMatch ? typeMatch[1].toLowerCase() : 'simple';

    // Name
    const nameMatch = text.match(PRODUCT_NAME_PATTERN);
    const name = nameMatch ? nameMatch[1].trim() : 'Product';

    // Variants
    const variants: string[] = [];
    VARIANT_PATTERN.lastIndex = 0;
    let vm: RegExpExecArray | null;
    while ((vm = VARIANT_PATTERN.exec(text)) !== null) {
      variants.push(vm[1].trim());
    }

    return {
      name,
      price,
      salePrice,
      currency,
      stockStatus,
      productType,
      variants,
    };
  },

  generate(data: Record<string, unknown>, surfaceId: string): A2UIMessage[] {
    const components: A2UIComponent[] = [
      { id: 'root', type: 'Column', children: ['product'] },
      {
        id: 'product', type: 'ProductCard', props: {
          name: '{{name}}',
          price: '{{price}}',
          salePrice: '{{salePrice}}',
          currency: '{{currency}}',
          stockStatus: '{{stockStatus}}',
          productType: '{{productType}}',
        },
      },
    ];

    const rootChildren = ['product'];

    // Add variant tags if present
    const variants = data.variants as string[];
    if (variants && variants.length > 0) {
      components.push({ id: 'variant-tags', type: 'TagList', props: { items: '{{variants}}' } });
      rootChildren.push('variant-tags');
    }

    const root = components.find(c => c.id === 'root')!;
    root.children = rootChildren;

    return [
      { type: 'dataModelUpdate', surfaceId, data },
      { type: 'surfaceUpdate', surfaceId, components },
      { type: 'beginRendering', surfaceId, rootId: 'root', catalog: 'auto-product-card' },
    ];
  },
});
