import type { A2UIMessage, A2UIComponent } from '../../../hooks/useA2UI';
import { registerTemplate } from '../registry';

// --- Pattern matching ---

const DEAL_KEYWORDS = ['deal', 'opportunity', 'pipeline', 'proposal', 'negotiation'];
const STAGE_KEYWORDS = ['qualification', 'discovery', 'proposal', 'negotiation', 'closed', 'won', 'lost'];
const AMOUNT_PATTERN = /(?:value|amount|worth|deal\s*(?:size|value))[:\s]*(?:[A-Z]{3}\s*)?[R$€£]?\s*([\d,]+(?:\.\d{1,2})?)/i;
const CURRENCY_AMOUNT = /[R$€£]\s*([\d,]+(?:\.\d{1,2})?)/;
const PROBABILITY_PATTERN = /(?:probability|chance|likelihood|close\s*rate)[:\s]*(\d{1,3})\s*%/i;
const STAGE_PATTERN = /(?:stage|phase|step)[:\s]+([A-Za-z\s]+?)(?:[.,;\n]|$)/im;
const STATUS_PATTERN = /(?:deal\s*)?status[:\s]*(open|won|lost|abandoned)/i;
const CONTACT_DEAL_PATTERN = /(?:contact|client|customer)[:\s]+([A-Z][a-zA-Z\-']+(?:\s+[A-Z][a-zA-Z\-']+){0,3})/i;
const CLOSE_DATE_PATTERN = /(?:close|expected|target)\s*date[:\s]+(\d{1,2}[\s/\-]\w+[\s/\-]\d{2,4}|\w+\s+\d{1,2},?\s+\d{4})/i;

registerTemplate({
  id: 'deal-summary',
  name: 'Deal Summary',

  match(text: string): number {
    const lower = text.toLowerCase();
    let score = 0;

    // Deal keywords
    const dealHits = DEAL_KEYWORDS.filter(kw => lower.includes(kw));
    if (dealHits.length > 0) score += 0.25;

    // Stage keywords
    const stageHits = STAGE_KEYWORDS.filter(kw => lower.includes(kw));
    score += Math.min(stageHits.length * 0.1, 0.2);

    // Currency/amount
    if (AMOUNT_PATTERN.test(text) || CURRENCY_AMOUNT.test(text)) score += 0.2;

    // Probability
    if (PROBABILITY_PATTERN.test(text)) score += 0.15;

    // Stage/status explicit mention
    if (STAGE_PATTERN.test(text) || STATUS_PATTERN.test(text)) score += 0.1;

    return score;
  },

  extract(text: string): Record<string, unknown> {
    // Extract amount
    let amount: number | null = null;
    let currency = 'USD';
    const amountMatch = text.match(AMOUNT_PATTERN);
    if (amountMatch) {
      amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    } else {
      const currMatch = text.match(CURRENCY_AMOUNT);
      if (currMatch) {
        amount = parseFloat(currMatch[1].replace(/,/g, ''));
      }
    }

    // Detect currency
    if (/\bR\s*[\d,]/.test(text) || /\bZAR\b/i.test(text)) currency = 'ZAR';
    else if (/€/.test(text) || /\bEUR\b/i.test(text)) currency = 'EUR';
    else if (/£/.test(text) || /\bGBP\b/i.test(text)) currency = 'GBP';

    const probMatch = text.match(PROBABILITY_PATTERN);
    const stageMatch = text.match(STAGE_PATTERN);
    const statusMatch = text.match(STATUS_PATTERN);
    const contactMatch = text.match(CONTACT_DEAL_PATTERN);
    const closeDateMatch = text.match(CLOSE_DATE_PATTERN);

    // Try to extract deal title from first line or "deal: X" pattern
    const titleMatch = text.match(/(?:deal|opportunity)[:\s]+["']?([^"'\n]+?)["']?(?:\s*[-–—]|\s*$|\s*\n)/im);
    const title = titleMatch ? titleMatch[1].trim() : 'Deal Summary';

    return {
      title,
      amount,
      currency,
      stage: stageMatch ? stageMatch[1].trim() : null,
      status: statusMatch ? statusMatch[1].toLowerCase() : 'open',
      probability: probMatch ? parseInt(probMatch[1], 10) : null,
      contact: contactMatch ? contactMatch[1].trim() : null,
      closeDate: closeDateMatch ? closeDateMatch[1].trim() : null,
    };
  },

  generate(data: Record<string, unknown>, surfaceId: string): A2UIMessage[] {
    const components: A2UIComponent[] = [
      { id: 'root', type: 'Column', children: ['deal-card'] },
      {
        id: 'deal-card', type: 'DealCard', props: {
          title: '{{title}}',
          amount: '{{amount}}',
          currency: '{{currency}}',
          stage: '{{stage}}',
          status: '{{status}}',
          probability: '{{probability}}',
          contact: '{{contact}}',
        },
      },
    ];

    const rootChildren = ['deal-card'];

    // Add KPI row for additional details
    const kpiItems = [];
    if (data.probability != null) {
      kpiItems.push({ label: 'Win Probability', value: `${data.probability}%`, tone: 'info' });
    }
    if (data.closeDate) {
      kpiItems.push({ label: 'Close Date', value: String(data.closeDate), tone: 'neutral' });
    }
    if (data.stage) {
      kpiItems.push({ label: 'Stage', value: String(data.stage), tone: 'info' });
    }

    if (kpiItems.length > 0) {
      components.push({
        id: 'deal-kpis', type: 'KpiGrid', props: {
          items: '{{dealKpis}}',
          columns: Math.min(kpiItems.length, 3),
        },
      });
      rootChildren.push('deal-kpis');
      (data as Record<string, unknown>).dealKpis = kpiItems;
    }

    const root = components.find(c => c.id === 'root')!;
    root.children = rootChildren;

    return [
      { type: 'dataModelUpdate', surfaceId, data },
      { type: 'surfaceUpdate', surfaceId, components },
      { type: 'beginRendering', surfaceId, rootId: 'root', catalog: 'auto-deal-summary' },
    ];
  },
});
