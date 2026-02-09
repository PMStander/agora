import type { A2UIMessage, A2UIComponent } from '../../../hooks/useA2UI';
import { registerTemplate } from '../registry';

// --- Pattern matching ---

const PIPELINE_KEYWORDS = ['pipeline', 'funnel', 'sales pipeline', 'deal pipeline'];
const STAGE_LINE = /(?:^|\n)\s*[•\-*\d.]+\s*(.+?)\s*[-–—:]\s*(\d+)\s*(?:deals?|opportunities?)?(?:\s*[-–—]\s*(?:[R$€£])?\s*([\d,]+(?:\.\d{1,2})?))?/gm;
const TOTAL_DEALS = /(\d+)\s*(?:total\s*)?(?:deals?|opportunities?)/i;
const TOTAL_VALUE = /(?:total|pipeline)\s*value[:\s]*(?:[A-Z]{3}\s*)?[R$€£]?\s*([\d,]+(?:\.\d{1,2})?)/i;
const CONVERSION_RATE = /(?:conversion|win)\s*rate[:\s]*(\d+(?:\.\d+)?)\s*%/i;
const AVG_DEAL_SIZE = /(?:average|avg|mean)\s*(?:deal\s*)?(?:size|value)[:\s]*(?:[R$€£])?\s*([\d,]+(?:\.\d{1,2})?)/i;

registerTemplate({
  id: 'pipeline-overview',
  name: 'Pipeline Overview',

  match(text: string): number {
    const lower = text.toLowerCase();
    let score = 0;

    // Pipeline keywords (strong signal)
    const hits = PIPELINE_KEYWORDS.filter(kw => lower.includes(kw));
    if (hits.length > 0) score += 0.35;

    // Stage lines (deal counts per stage)
    STAGE_LINE.lastIndex = 0;
    let stageCount = 0;
    while (STAGE_LINE.exec(text) !== null) stageCount++;
    if (stageCount >= 2) score += 0.3;
    else if (stageCount === 1) score += 0.1;

    // Total deals
    if (TOTAL_DEALS.test(text)) score += 0.1;

    // Total value
    if (TOTAL_VALUE.test(text)) score += 0.1;

    // Conversion rate
    if (CONVERSION_RATE.test(text)) score += 0.1;

    return score;
  },

  extract(text: string): Record<string, unknown> {
    // Stage lines
    const stages: { name: string; deals: number; value: number | null }[] = [];
    STAGE_LINE.lastIndex = 0;
    let sm: RegExpExecArray | null;
    while ((sm = STAGE_LINE.exec(text)) !== null) {
      const name = sm[1].trim();
      const deals = parseInt(sm[2], 10);
      const value = sm[3] ? parseFloat(sm[3].replace(/,/g, '')) : null;
      stages.push({ name, deals, value });
    }

    // Currency
    let currency = 'USD';
    if (/\bR\s*[\d,]/.test(text) || /\bZAR\b/i.test(text)) currency = 'ZAR';
    else if (/€/.test(text) || /\bEUR\b/i.test(text)) currency = 'EUR';
    else if (/£/.test(text) || /\bGBP\b/i.test(text)) currency = 'GBP';

    // Summary stats
    const totalDealsMatch = text.match(TOTAL_DEALS);
    const totalValueMatch = text.match(TOTAL_VALUE);
    const conversionMatch = text.match(CONVERSION_RATE);
    const avgDealMatch = text.match(AVG_DEAL_SIZE);

    const totalDeals = totalDealsMatch ? parseInt(totalDealsMatch[1], 10)
      : stages.reduce((sum, s) => sum + s.deals, 0);
    const totalValue = totalValueMatch ? parseFloat(totalValueMatch[1].replace(/,/g, '')) : null;
    const conversionRate = conversionMatch ? parseFloat(conversionMatch[1]) : null;
    const avgDealSize = avgDealMatch ? parseFloat(avgDealMatch[1].replace(/,/g, '')) : null;

    // Build table rows from stages
    const tableRows = stages.map(s => ({
      stage: s.name,
      deals: s.deals,
      value: s.value,
    }));

    return {
      totalDeals,
      totalValue,
      conversionRate,
      avgDealSize,
      currency,
      stages: tableRows,
    };
  },

  generate(data: Record<string, unknown>, surfaceId: string): A2UIMessage[] {
    const components: A2UIComponent[] = [
      { id: 'root', type: 'Column', children: ['main-card'] },
      { id: 'main-card', type: 'Card', props: { title: 'Pipeline Overview' }, children: ['kpis'] },
    ];

    const cardChildren = ['kpis'];

    // KPI row
    const kpiItems = [
      { label: 'Total Deals', value: String(data.totalDeals), tone: 'info' },
    ];
    if (data.totalValue != null) {
      kpiItems.push({ label: 'Pipeline Value', value: String(data.totalValue), tone: 'success' });
    }
    if (data.conversionRate != null) {
      kpiItems.push({ label: 'Win Rate', value: `${data.conversionRate}%`, tone: 'info' });
    }
    if (data.avgDealSize != null) {
      kpiItems.push({ label: 'Avg Deal', value: String(data.avgDealSize), tone: 'neutral' });
    }

    components.push({
      id: 'kpis', type: 'KpiGrid', props: {
        items: '{{pipelineKpis}}',
        columns: Math.min(kpiItems.length, 4),
      },
    });

    // Stage table
    const stages = data.stages as { stage: string; deals: number; value: number | null }[];
    if (stages && stages.length > 0) {
      const columns = [
        { key: 'stage', label: 'Stage' },
        { key: 'deals', label: 'Deals', align: 'right' },
      ];
      if (stages.some(s => s.value != null)) {
        columns.push({ key: 'value', label: 'Value', align: 'right' });
      }
      components.push({
        id: 'stage-table', type: 'DataTable', props: {
          columns: '{{tableColumns}}',
          rows: '{{stages}}',
        },
      });
      cardChildren.push('stage-table');
      (data as Record<string, unknown>).tableColumns = columns;
    }

    const mainCard = components.find(c => c.id === 'main-card')!;
    mainCard.children = cardChildren;
    (data as Record<string, unknown>).pipelineKpis = kpiItems;

    return [
      { type: 'dataModelUpdate', surfaceId, data },
      { type: 'surfaceUpdate', surfaceId, components },
      { type: 'beginRendering', surfaceId, rootId: 'root', catalog: 'auto-pipeline-overview' },
    ];
  },
});
