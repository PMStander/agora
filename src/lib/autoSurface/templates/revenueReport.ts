import type { A2UIMessage, A2UIComponent } from '../../../hooks/useA2UI';
import { registerTemplate } from '../registry';

// --- Pattern matching ---

const REVENUE_KEYWORDS = ['revenue', 'income', 'earnings', 'sales', 'turnover', 'financial'];
const PERIOD_KEYWORDS = ['monthly', 'quarterly', 'annual', 'yearly', 'ytd', 'year-to-date', 'q1', 'q2', 'q3', 'q4'];
const REVENUE_LINE = /(?:^|\n)\s*[•\-*]?\s*((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*|q[1-4]|week\s*\d+|\d{4})\s*[-–—:]\s*(?:[A-Z]{3}\s*)?[R$€£]?\s*([\d,]+(?:\.\d{1,2})?)/gim;
const TOTAL_REVENUE = /(?:total|overall|combined)\s*(?:revenue|income|sales|earnings)[:\s]*(?:[A-Z]{3}\s*)?[R$€£]?\s*([\d,]+(?:\.\d{1,2})?)/i;
const GROWTH_PATTERN = /(?:growth|increase|decrease|change)[:\s]*([+-]?\d+(?:\.\d+)?)\s*%/i;
const AVG_PATTERN = /(?:average|avg|mean)\s*(?:monthly|quarterly)?\s*(?:revenue|income|sales)?[:\s]*(?:[R$€£])?\s*([\d,]+(?:\.\d{1,2})?)/i;
const COMPARISON_PATTERN = /(?:compared|vs|versus|up|down)\s+(?:from|to)?\s*(?:last|previous|prior)/i;

registerTemplate({
  id: 'revenue-report',
  name: 'Revenue Report',

  match(text: string): number {
    const lower = text.toLowerCase();
    let score = 0;

    // Revenue keywords
    const revenueHits = REVENUE_KEYWORDS.filter(kw => lower.includes(kw));
    score += Math.min(revenueHits.length * 0.12, 0.35);

    // Period keywords
    const periodHits = PERIOD_KEYWORDS.filter(kw => lower.includes(kw));
    score += Math.min(periodHits.length * 0.1, 0.2);

    // Revenue lines (month/quarter → amount)
    REVENUE_LINE.lastIndex = 0;
    let lineCount = 0;
    while (REVENUE_LINE.exec(text) !== null) lineCount++;
    if (lineCount >= 2) score += 0.25;
    else if (lineCount === 1) score += 0.1;

    // Total revenue
    if (TOTAL_REVENUE.test(text)) score += 0.1;

    // Growth/comparison
    if (GROWTH_PATTERN.test(text) || COMPARISON_PATTERN.test(text)) score += 0.1;

    return score;
  },

  extract(text: string): Record<string, unknown> {
    // Currency
    let currency = 'USD';
    if (/\bR\s*[\d,]/.test(text) || /\bZAR\b/i.test(text)) currency = 'ZAR';
    else if (/€/.test(text) || /\bEUR\b/i.test(text)) currency = 'EUR';
    else if (/£/.test(text) || /\bGBP\b/i.test(text)) currency = 'GBP';

    // Revenue lines
    const periods: { category: string; amount: number }[] = [];
    REVENUE_LINE.lastIndex = 0;
    let rm: RegExpExecArray | null;
    while ((rm = REVENUE_LINE.exec(text)) !== null) {
      const period = rm[1].trim();
      const amount = parseFloat(rm[2].replace(/,/g, ''));
      periods.push({ category: period, amount });
    }

    // Calculate changes between periods
    const rows = periods.map((p, i) => {
      const change = i > 0 && periods[i - 1].amount > 0
        ? ((p.amount - periods[i - 1].amount) / periods[i - 1].amount) * 100
        : 0;
      return { category: p.category, amount: p.amount, change: Math.round(change * 100) / 100 };
    });

    // Summary stats
    const totalMatch = text.match(TOTAL_REVENUE);
    const growthMatch = text.match(GROWTH_PATTERN);
    const avgMatch = text.match(AVG_PATTERN);

    const totalRevenue = totalMatch ? parseFloat(totalMatch[1].replace(/,/g, ''))
      : periods.reduce((sum, p) => sum + p.amount, 0);
    const growth = growthMatch ? parseFloat(growthMatch[1]) : null;
    const avgRevenue = avgMatch ? parseFloat(avgMatch[1].replace(/,/g, ''))
      : periods.length > 0 ? Math.round(totalRevenue / periods.length) : null;

    return {
      currency,
      totalRevenue,
      growth,
      avgRevenue,
      periodCount: periods.length,
      rows,
    };
  },

  generate(data: Record<string, unknown>, surfaceId: string): A2UIMessage[] {
    const components: A2UIComponent[] = [
      { id: 'root', type: 'Column', children: ['main-card'] },
      { id: 'main-card', type: 'Card', props: { title: 'Revenue Report' }, children: ['kpis'] },
    ];

    const cardChildren = ['kpis'];

    // KPI row
    const kpiItems = [
      { label: 'Total Revenue', value: String(data.totalRevenue), tone: 'success' },
    ];
    if (data.growth != null) {
      const growthVal = data.growth as number;
      kpiItems.push({
        label: 'Growth',
        value: `${growthVal >= 0 ? '+' : ''}${growthVal}%`,
        tone: growthVal >= 0 ? 'success' : 'danger',
      });
    }
    if (data.avgRevenue != null) {
      kpiItems.push({ label: 'Average', value: String(data.avgRevenue), tone: 'info' });
    }
    kpiItems.push({ label: 'Periods', value: String(data.periodCount), tone: 'neutral' });

    components.push({
      id: 'kpis', type: 'KpiGrid', props: {
        items: '{{revenueKpis}}',
        columns: Math.min(kpiItems.length, 4),
      },
    });

    // Finance table for period breakdown
    const rows = data.rows as { category: string; amount: number; change: number }[];
    if (rows && rows.length > 0) {
      components.push({
        id: 'revenue-table', type: 'FinanceTable', props: {
          rows: '{{rows}}',
          currency: '{{currency}}',
        },
      });
      cardChildren.push('revenue-table');
    }

    const mainCard = components.find(c => c.id === 'main-card')!;
    mainCard.children = cardChildren;
    (data as Record<string, unknown>).revenueKpis = kpiItems;

    return [
      { type: 'dataModelUpdate', surfaceId, data },
      { type: 'surfaceUpdate', surfaceId, components },
      { type: 'beginRendering', surfaceId, rootId: 'root', catalog: 'auto-revenue-report' },
    ];
  },
});
