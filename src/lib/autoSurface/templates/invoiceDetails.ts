import type { A2UIMessage, A2UIComponent } from '../../../hooks/useA2UI';
import { registerTemplate } from '../registry';

// --- Pattern matching ---

const INVOICE_KEYWORDS = ['invoice', 'bill', 'payment', 'due', 'outstanding', 'overdue'];
const QUOTE_KEYWORDS = ['quote', 'quotation', 'estimate', 'proposal'];
const INVOICE_STATUS = /(?:status|state)[:\s]*(draft|sent|viewed|partially[_\s]paid|paid|overdue|void|refunded|accepted|declined|expired|converted)/i;
const INVOICE_NUMBER = /(?:invoice|quote|quotation)\s*(?:#|no\.?|number)[:\s]*([A-Z0-9\-]+)/i;
const LINE_ITEM = /(?:^|\n)\s*[•\-*\d.]+\s*(.+?)\s*(?:[xX×]\s*(\d+))?\s*[-–—@]\s*(?:[R$€£])?\s*([\d,]+(?:\.\d{1,2})?)/gm;
const TOTAL_PATTERN = /(?:total|grand\s*total|amount\s*due)[:\s]*(?:[A-Z]{3}\s*)?[R$€£]?\s*([\d,]+(?:\.\d{1,2})?)/i;
const SUBTOTAL_PATTERN = /(?:subtotal|sub[_\s]total)[:\s]*(?:[R$€£])?\s*([\d,]+(?:\.\d{1,2})?)/i;
const TAX_PATTERN = /(?:tax|vat|gst)[:\s]*(?:[R$€£])?\s*([\d,]+(?:\.\d{1,2})?)/i;
const DISCOUNT_PATTERN = /(?:discount)[:\s]*(?:[R$€£])?\s*([\d,]+(?:\.\d{1,2})?)/i;
const DUE_DATE_PATTERN = /(?:due\s*date|payment\s*due|pay\s*by)[:\s]+(\d{1,2}[\s/\-]\w+[\s/\-]\d{2,4}|\w+\s+\d{1,2},?\s+\d{4})/i;

registerTemplate({
  id: 'invoice-details',
  name: 'Invoice / Quote Details',

  match(text: string): number {
    const lower = text.toLowerCase();
    let score = 0;

    // Invoice/quote keywords
    const invoiceHits = INVOICE_KEYWORDS.filter(kw => lower.includes(kw));
    const quoteHits = QUOTE_KEYWORDS.filter(kw => lower.includes(kw));
    const keywordHits = invoiceHits.length + quoteHits.length;
    score += Math.min(keywordHits * 0.12, 0.35);

    // Invoice/quote number
    if (INVOICE_NUMBER.test(text)) score += 0.2;

    // Total amount
    if (TOTAL_PATTERN.test(text)) score += 0.15;

    // Line items
    LINE_ITEM.lastIndex = 0;
    let lineItemCount = 0;
    while (LINE_ITEM.exec(text) !== null) lineItemCount++;
    if (lineItemCount >= 2) score += 0.2;
    else if (lineItemCount === 1) score += 0.1;

    // Status
    if (INVOICE_STATUS.test(text)) score += 0.1;

    return score;
  },

  extract(text: string): Record<string, unknown> {
    // Detect if quote or invoice
    const isQuote = /quote|quotation|estimate/i.test(text) && !/invoice/i.test(text);
    const docType = isQuote ? 'Quote' : 'Invoice';

    // Number
    const numberMatch = text.match(INVOICE_NUMBER);
    const docNumber = numberMatch ? numberMatch[1] : null;

    // Status
    const statusMatch = text.match(INVOICE_STATUS);
    const status = statusMatch ? statusMatch[1].toLowerCase().replace(/\s+/g, '_') : null;

    // Currency detection
    let currency = 'USD';
    if (/\bR\s*[\d,]/.test(text) || /\bZAR\b/i.test(text)) currency = 'ZAR';
    else if (/€/.test(text) || /\bEUR\b/i.test(text)) currency = 'EUR';
    else if (/£/.test(text) || /\bGBP\b/i.test(text)) currency = 'GBP';

    // Line items
    const items: { name: string; quantity: number; price: number; total: number }[] = [];
    LINE_ITEM.lastIndex = 0;
    let lm: RegExpExecArray | null;
    while ((lm = LINE_ITEM.exec(text)) !== null) {
      const name = lm[1].trim();
      const qty = lm[2] ? parseInt(lm[2], 10) : 1;
      const price = parseFloat(lm[3].replace(/,/g, ''));
      items.push({ name, quantity: qty, price, total: qty * price });
    }

    // Totals
    const totalMatch = text.match(TOTAL_PATTERN);
    const subtotalMatch = text.match(SUBTOTAL_PATTERN);
    const taxMatch = text.match(TAX_PATTERN);
    const discountMatch = text.match(DISCOUNT_PATTERN);
    const dueDateMatch = text.match(DUE_DATE_PATTERN);

    const total = totalMatch ? parseFloat(totalMatch[1].replace(/,/g, '')) : null;
    const subtotal = subtotalMatch ? parseFloat(subtotalMatch[1].replace(/,/g, '')) : null;
    const tax = taxMatch ? parseFloat(taxMatch[1].replace(/,/g, '')) : null;
    const discount = discountMatch ? parseFloat(discountMatch[1].replace(/,/g, '')) : null;

    return {
      docType,
      docNumber,
      status,
      currency,
      items,
      subtotal,
      tax,
      discount,
      total,
      dueDate: dueDateMatch ? dueDateMatch[1].trim() : null,
    };
  },

  generate(data: Record<string, unknown>, surfaceId: string): A2UIMessage[] {
    const docType = data.docType as string;
    const docNumber = data.docNumber as string | null;
    const title = docNumber ? `${docType} ${docNumber}` : docType;

    const components: A2UIComponent[] = [
      { id: 'root', type: 'Column', children: ['main-card'] },
      { id: 'main-card', type: 'Card', props: { title }, children: ['status-row', 'order-summary'] },
    ];

    const cardChildren = ['status-row', 'order-summary'];

    // Status + due date badges
    const statusBadges: string[] = [];
    if (data.status) {
      const toneMap: Record<string, string> = {
        draft: 'neutral', sent: 'info', viewed: 'info',
        partially_paid: 'warning', paid: 'success', overdue: 'danger',
        void: 'neutral', refunded: 'warning',
        accepted: 'success', declined: 'danger', expired: 'warning', converted: 'success',
      };
      components.push({
        id: 'status-badge', type: 'Badge', props: {
          label: String(data.status).replace(/_/g, ' '),
          tone: toneMap[data.status as string] ?? 'neutral',
        },
      });
      statusBadges.push('status-badge');
    }
    if (data.dueDate) {
      components.push({
        id: 'due-badge', type: 'Badge', props: {
          label: `Due: ${data.dueDate}`,
          tone: 'warning',
        },
      });
      statusBadges.push('due-badge');
    }
    components.push({ id: 'status-row', type: 'Row', children: statusBadges });

    // Order summary for line items
    components.push({
      id: 'order-summary', type: 'OrderSummary', props: {
        items: '{{items}}',
        currency: '{{currency}}',
        subtotal: '{{subtotal}}',
        tax: '{{tax}}',
        discount: '{{discount}}',
        total: '{{total}}',
      },
    });

    const mainCard = components.find(c => c.id === 'main-card')!;
    mainCard.children = cardChildren;

    return [
      { type: 'dataModelUpdate', surfaceId, data },
      { type: 'surfaceUpdate', surfaceId, components },
      { type: 'beginRendering', surfaceId, rootId: 'root', catalog: 'auto-invoice-details' },
    ];
  },
});
