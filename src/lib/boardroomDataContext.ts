// ─── Boardroom Data Context ─────────────────────────────────────────────────
// Hydrates entity references with real CRM/product/project data from Zustand
// stores for injection into agent prompts. Uses getState() since this runs
// outside React component lifecycle.
// ────────────────────────────────────────────────────────────────────────────

import type { EntityReference } from '../types/boardroom';
import { useCrmStore } from '../stores/crm';
import { useProductsStore } from '../stores/products';
import { useProjectsStore } from '../stores/projects';

// ─── Constants ──────────────────────────────────────────────────────────────

const MAX_ENTITIES = 10;
const MAX_RELATED_CONTACTS = 5;
const MAX_RELATED_DEALS = 5;

// ─── Currency Formatter ─────────────────────────────────────────────────────

function fmtCurrency(amount: number | null | undefined, currency = 'ZAR'): string {
  if (amount == null) return 'N/A';
  const prefix = currency === 'ZAR' ? 'R' : currency === 'USD' ? '$' : `${currency} `;
  if (amount >= 1_000_000) return `${prefix}${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${prefix}${(amount / 1_000).toFixed(0)}K`;
  return `${prefix}${amount.toLocaleString()}`;
}

function fmtDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function capitalize(s: string | null | undefined): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
}

// ─── Entity Hydrators ───────────────────────────────────────────────────────

function hydrateCompany(ref: EntityReference): string | null {
  const { companies, contacts, deals } = useCrmStore.getState();
  const { pipelines } = useCrmStore.getState();
  const company = companies.find((c) => c.id === ref.id);
  if (!company) return `  [Company "${ref.label}" not found in CRM]`;

  const lines: string[] = [];
  lines.push(`Company: ${company.name}`);

  // Summary line
  const parts: string[] = [];
  if (company.industry) parts.push(`Industry: ${company.industry}`);
  if (company.annual_revenue != null) parts.push(`Revenue: ${fmtCurrency(company.annual_revenue)}`);
  if (company.domain) parts.push(`Domain: ${company.domain}`);
  if (company.size_category) parts.push(`Size: ${capitalize(company.size_category)}`);
  if (parts.length > 0) lines.push(`  ${parts.join(' | ')}`);

  // Related contacts
  const companyContacts = contacts.filter((c) => c.company_id === company.id);
  if (companyContacts.length > 0) {
    const shown = companyContacts.slice(0, MAX_RELATED_CONTACTS);
    const contactStr = shown
      .map((c) => {
        const name = `${c.first_name} ${c.last_name}`.trim();
        return c.job_title ? `${name} - ${c.job_title}` : name;
      })
      .join(', ');
    const suffix = companyContacts.length > MAX_RELATED_CONTACTS
      ? `, +${companyContacts.length - MAX_RELATED_CONTACTS} more`
      : '';
    lines.push(`  Contacts: ${companyContacts.length} (${contactStr}${suffix})`);
  }

  // Related open deals
  const companyDeals = deals.filter((d) => d.company_id === company.id && d.status === 'open');
  if (companyDeals.length > 0) {
    const shown = companyDeals.slice(0, MAX_RELATED_DEALS);
    const dealStr = shown
      .map((d) => {
        const stageName = findStageName(pipelines, d.pipeline_id, d.stage_id);
        return `${d.title} ${fmtCurrency(d.amount, d.currency)}${stageName ? ` in ${stageName}` : ''}`;
      })
      .join(', ');
    const suffix = companyDeals.length > MAX_RELATED_DEALS
      ? `, +${companyDeals.length - MAX_RELATED_DEALS} more`
      : '';
    lines.push(`  Open Deals: ${companyDeals.length} (${dealStr}${suffix})`);
  }

  return lines.join('\n');
}

function hydrateContact(ref: EntityReference): string | null {
  const { contacts, companies } = useCrmStore.getState();
  const contact = contacts.find((c) => c.id === ref.id);
  if (!contact) return `  [Contact "${ref.label}" not found in CRM]`;

  const lines: string[] = [];
  const fullName = `${contact.first_name} ${contact.last_name}`.trim();
  lines.push(`Contact: ${fullName}`);

  // Role & company line
  const roleParts: string[] = [];
  const companyName = contact.company_id
    ? companies.find((c) => c.id === contact.company_id)?.name
    : null;
  if (contact.job_title && companyName) {
    roleParts.push(`${contact.job_title} at ${companyName}`);
  } else if (contact.job_title) {
    roleParts.push(contact.job_title);
  } else if (companyName) {
    roleParts.push(`at ${companyName}`);
  }
  if (contact.lead_score != null) {
    roleParts.push(`Lead Score: ${contact.lead_score} (${capitalize(contact.lead_score_label)})`);
  }
  if (contact.lifecycle_status && contact.lifecycle_status !== 'other') {
    roleParts.push(`Status: ${capitalize(contact.lifecycle_status)}`);
  }
  if (roleParts.length > 0) lines.push(`  ${roleParts.join(' | ')}`);

  // Contact details
  const detailParts: string[] = [];
  if (contact.email) detailParts.push(`Email: ${contact.email}`);
  if (contact.phone) detailParts.push(`Phone: ${contact.phone}`);
  if (detailParts.length > 0) lines.push(`  ${detailParts.join(' | ')}`);

  return lines.join('\n');
}

function hydrateDeal(ref: EntityReference): string | null {
  const { deals, companies, contacts, pipelines } = useCrmStore.getState();
  const deal = deals.find((d) => d.id === ref.id);
  if (!deal) return `  [Deal "${ref.label}" not found in CRM]`;

  const lines: string[] = [];
  lines.push(`Deal: ${deal.title}`);

  // Amount & stage line
  const stageName = findStageName(pipelines, deal.pipeline_id, deal.stage_id);
  const probability = findStageProbability(pipelines, deal.pipeline_id, deal.stage_id);
  const amountParts: string[] = [];
  amountParts.push(`Amount: ${fmtCurrency(deal.amount, deal.currency)}`);
  if (stageName) {
    amountParts.push(`Stage: ${stageName}${probability != null ? ` (${probability}%)` : ''}`);
  }
  amountParts.push(`Status: ${capitalize(deal.status)}`);
  lines.push(`  ${amountParts.join(' | ')}`);

  // Related entities
  const relParts: string[] = [];
  const companyName = deal.company_id
    ? companies.find((c) => c.id === deal.company_id)?.name
    : null;
  if (companyName) relParts.push(`Company: ${companyName}`);

  const contact = deal.contact_id ? contacts.find((c) => c.id === deal.contact_id) : null;
  if (contact) relParts.push(`Contact: ${contact.first_name} ${contact.last_name}`.trim());

  if (deal.close_date) relParts.push(`Close: ${fmtDate(deal.close_date)}`);
  if (relParts.length > 0) lines.push(`  ${relParts.join(' | ')}`);

  return lines.join('\n');
}

function hydrateProduct(ref: EntityReference): string | null {
  const { products } = useProductsStore.getState();
  const product = products.find((p) => p.id === ref.id);
  if (!product) return `  [Product "${ref.label}" not found in catalog]`;

  const lines: string[] = [];
  lines.push(`Product: ${product.name}`);

  const parts: string[] = [];
  if (product.sku) parts.push(`SKU: ${product.sku}`);
  const price = product.sale_price ?? product.regular_price;
  if (price != null) parts.push(`Price: ${fmtCurrency(price, product.currency)}`);
  if (product.stock_quantity != null) parts.push(`Stock: ${product.stock_quantity}`);
  parts.push(`Status: ${capitalize(product.status)}`);
  if (parts.length > 0) lines.push(`  ${parts.join(' | ')}`);

  return lines.join('\n');
}

function hydrateProject(ref: EntityReference): string | null {
  const { projects } = useProjectsStore.getState();
  const project = projects.find((p) => p.id === ref.id);
  if (!project) return `  [Project "${ref.label}" not found]`;

  const lines: string[] = [];
  lines.push(`Project: ${project.name}`);

  const parts: string[] = [];
  parts.push(`Status: ${capitalize(project.status)}`);
  if (project.budget != null) parts.push(`Budget: ${fmtCurrency(project.budget, project.currency)}`);
  if (project.start_date) parts.push(`Start: ${fmtDate(project.start_date)}`);
  if (project.target_end_date) parts.push(`Target: ${fmtDate(project.target_end_date)}`);
  if (parts.length > 0) lines.push(`  ${parts.join(' | ')}`);

  if (project.description) {
    const desc = project.description.length > 120
      ? project.description.slice(0, 117) + '...'
      : project.description;
    lines.push(`  ${desc}`);
  }

  return lines.join('\n');
}

// ─── Pipeline Helpers ───────────────────────────────────────────────────────

function findStageName(
  pipelines: ReturnType<typeof useCrmStore.getState>['pipelines'],
  pipelineId: string,
  stageId: string
): string | null {
  const pipeline = pipelines.find((p) => p.id === pipelineId);
  if (!pipeline) return null;
  const stage = pipeline.stages.find((s) => s.id === stageId);
  return stage?.name ?? null;
}

function findStageProbability(
  pipelines: ReturnType<typeof useCrmStore.getState>['pipelines'],
  pipelineId: string,
  stageId: string
): number | null {
  const pipeline = pipelines.find((p) => p.id === pipelineId);
  if (!pipeline) return null;
  const stage = pipeline.stages.find((s) => s.id === stageId);
  return stage?.probability ?? null;
}

// ─── Hydrator Map ───────────────────────────────────────────────────────────

const EMOJI_MAP: Record<EntityReference['type'], string> = {
  company: '\uD83C\uDFE2',  // office building
  contact: '\uD83D\uDC64',  // bust in silhouette
  deal: '\uD83D\uDCBC',     // briefcase
  product: '\uD83D\uDCE6',  // package
  project: '\uD83D\uDCC1',  // file folder
};

const HYDRATOR_MAP: Record<EntityReference['type'], (ref: EntityReference) => string | null> = {
  company: hydrateCompany,
  contact: hydrateContact,
  deal: hydrateDeal,
  product: hydrateProduct,
  project: hydrateProject,
};

// ─── Main Export ────────────────────────────────────────────────────────────

/**
 * Hydrates an array of EntityReference objects with live business data from
 * Zustand stores (CRM, Products, Projects). Returns a formatted string
 * suitable for injection into agent system prompts.
 *
 * Caps output at MAX_ENTITIES to avoid prompt bloat.
 * Returns empty string if no references are provided.
 */
export function hydrateEntityReferences(entityRefs: EntityReference[]): string {
  if (!entityRefs || entityRefs.length === 0) return '';

  const capped = entityRefs.slice(0, MAX_ENTITIES);
  const sections: string[] = [];

  for (const ref of capped) {
    const hydrator = HYDRATOR_MAP[ref.type];
    if (!hydrator) continue;

    const emoji = ref.emoji || EMOJI_MAP[ref.type] || '';
    const result = hydrator(ref);
    if (result) {
      // Prepend emoji to the first line
      const firstNewline = result.indexOf('\n');
      if (firstNewline === -1) {
        sections.push(`${emoji} ${result}`);
      } else {
        sections.push(`${emoji} ${result.slice(0, firstNewline)}${result.slice(firstNewline)}`);
      }
    }
  }

  if (sections.length === 0) return '';

  return `=== LIVE BUSINESS DATA ===\n${sections.join('\n\n')}`;
}
