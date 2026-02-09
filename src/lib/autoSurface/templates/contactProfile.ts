import type { A2UIMessage, A2UIComponent } from '../../../hooks/useA2UI';
import { registerTemplate } from '../registry';

// --- Pattern matching ---

const NAME_PATTERN = /(?:contact|name)[:\s]+([A-Z][a-zA-Z\-']+(?:\s+[A-Z][a-zA-Z\-']+){0,3})/i;
const EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const PHONE_PATTERN = /(?:phone|tel|mobile|cell)[:\s]*([+\d][\d\s\-().]{6,18})/i;
const COMPANY_PATTERN = /(?:company|works?\s+(?:at|for)|organization|employer)[:\s]+([A-Z][a-zA-Z\s&\-'.]+?)(?:[.,;\n]|$)/im;
const JOB_TITLE_PATTERN = /(?:title|role|position|job)[:\s]+(.+?)(?:[.,;\n]|$)/im;
const LIFECYCLE_PATTERN = /(?:lifecycle|status|stage)[:\s]*(subscriber|lead|marketing[_\s]qualified|sales[_\s]qualified|opportunity|customer|evangelist|churned)/i;
const LEAD_SCORE_PATTERN = /lead\s*score[:\s]*(\d+)/i;
const LEAD_LABEL_PATTERN = /lead\s*(?:label|status|rating)[:\s]*(cold|warm|hot)/i;

const CONTACT_KEYWORDS = [
  'contact', 'name', 'email', 'phone', 'company', 'lead',
  'lifecycle', 'customer', 'subscriber', 'prospect',
];

registerTemplate({
  id: 'contact-profile',
  name: 'Contact Profile',

  match(text: string): number {
    const lower = text.toLowerCase();
    let score = 0;

    // Contact-related keywords
    const hits = CONTACT_KEYWORDS.filter(kw => lower.includes(kw));
    score += Math.min(hits.length * 0.1, 0.3);

    // Name pattern
    if (NAME_PATTERN.test(text)) score += 0.15;

    // Email is a strong signal
    if (EMAIL_PATTERN.test(text)) score += 0.2;

    // Phone
    if (PHONE_PATTERN.test(text)) score += 0.1;

    // Company
    if (COMPANY_PATTERN.test(text)) score += 0.1;

    // Lead score or lifecycle
    if (LEAD_SCORE_PATTERN.test(text) || LIFECYCLE_PATTERN.test(text)) score += 0.15;

    return score;
  },

  extract(text: string): Record<string, unknown> {
    const nameMatch = text.match(NAME_PATTERN);
    const emailMatch = text.match(EMAIL_PATTERN);
    const phoneMatch = text.match(PHONE_PATTERN);
    const companyMatch = text.match(COMPANY_PATTERN);
    const jobTitleMatch = text.match(JOB_TITLE_PATTERN);
    const lifecycleMatch = text.match(LIFECYCLE_PATTERN);
    const leadScoreMatch = text.match(LEAD_SCORE_PATTERN);
    const leadLabelMatch = text.match(LEAD_LABEL_PATTERN);

    return {
      name: nameMatch ? nameMatch[1].trim() : 'Unknown Contact',
      email: emailMatch ? emailMatch[0] : null,
      phone: phoneMatch ? phoneMatch[1].trim() : null,
      company: companyMatch ? companyMatch[1].trim() : null,
      jobTitle: jobTitleMatch ? jobTitleMatch[1].trim() : null,
      lifecycle: lifecycleMatch ? lifecycleMatch[1].toLowerCase().replace(/\s+/g, '_') : null,
      leadScore: leadScoreMatch ? parseInt(leadScoreMatch[1], 10) : null,
      leadLabel: leadLabelMatch ? leadLabelMatch[1].toLowerCase() : null,
    };
  },

  generate(data: Record<string, unknown>, surfaceId: string): A2UIMessage[] {
    const components: A2UIComponent[] = [
      { id: 'root', type: 'Column', children: ['contact-card'] },
      {
        id: 'contact-card', type: 'ContactCard', props: {
          name: '{{name}}',
          email: '{{email}}',
          company: '{{company}}',
          jobTitle: '{{jobTitle}}',
          lifecycle: '{{lifecycle}}',
        },
      },
    ];

    const rootChildren = ['contact-card'];

    // Add KPI row for lead score
    if (data.leadScore != null || data.leadLabel) {
      const kpiItems = [];
      if (data.leadScore != null) {
        kpiItems.push({ label: 'Lead Score', value: String(data.leadScore), tone: 'info' });
      }
      if (data.leadLabel) {
        const toneMap: Record<string, string> = { cold: 'neutral', warm: 'warning', hot: 'danger' };
        kpiItems.push({ label: 'Lead Rating', value: String(data.leadLabel), tone: toneMap[data.leadLabel as string] ?? 'neutral' });
      }
      if (data.phone) {
        kpiItems.push({ label: 'Phone', value: String(data.phone), tone: 'neutral' });
      }
      components.push({
        id: 'lead-kpis', type: 'KpiGrid', props: {
          items: '{{leadKpis}}',
          columns: kpiItems.length,
        },
      });
      rootChildren.push('lead-kpis');
      (data as Record<string, unknown>).leadKpis = kpiItems;
    }

    const root = components.find(c => c.id === 'root')!;
    root.children = rootChildren;

    return [
      { type: 'dataModelUpdate', surfaceId, data },
      { type: 'surfaceUpdate', surfaceId, components },
      { type: 'beginRendering', surfaceId, rootId: 'root', catalog: 'auto-contact-profile' },
    ];
  },
});
