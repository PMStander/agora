import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const MAX_TEXT_LENGTH = 8000;

/**
 * Builds a text representation of a database entity for embedding.
 * Fetches the row from Supabase, concatenates relevant fields,
 * and returns structured text suitable for vector embedding.
 */
export async function buildEntityText(
  entityType: string,
  entityId: string,
  supabase: SupabaseClient
): Promise<string> {
  try {
    const builder = BUILDERS[entityType];
    if (!builder) {
      return `[${entityType}] Unknown entity type`;
    }
    const text = await builder(entityId, supabase);
    return text.slice(0, MAX_TEXT_LENGTH);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return `[${entityType}] Error building text: ${message}`;
  }
}

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

/** Append a field line only if the value is non-empty. */
function addField(lines: string[], label: string, value: string | null | undefined) {
  if (value && value.trim()) {
    lines.push(`${label}: ${value.trim()}`);
  }
}

/** Format a header line like `[company] Acme Corp` */
function header(entityType: string, name: string | null | undefined): string {
  return `[${entityType}] ${name?.trim() || 'Untitled'}`;
}

// ---------------------------------------------------------------------------
// Per-entity builder functions
// ---------------------------------------------------------------------------

type BuilderFn = (id: string, sb: SupabaseClient) => Promise<string>;

async function buildCompany(id: string, sb: SupabaseClient): Promise<string> {
  const { data } = await sb.from('companies').select('*').eq('id', id).single();
  if (!data) return '';
  const lines: string[] = [header('company', data.name)];
  addField(lines, 'Domain', data.domain);
  addField(lines, 'Industry', data.industry);
  addField(lines, 'Website', data.website);
  addField(lines, 'Notes', data.notes);
  return lines.join('\n');
}

async function buildContact(id: string, sb: SupabaseClient): Promise<string> {
  const { data } = await sb
    .from('contacts')
    .select('*, company:companies(name)')
    .eq('id', id)
    .single();
  if (!data) return '';
  const fullName = [data.first_name, data.last_name].filter(Boolean).join(' ');
  const lines: string[] = [header('contact', fullName)];
  addField(lines, 'Email', data.email);
  addField(lines, 'Job Title', data.job_title);
  addField(lines, 'Company', data.company?.name);
  addField(lines, 'Notes', data.notes);
  return lines.join('\n');
}

async function buildDeal(id: string, sb: SupabaseClient): Promise<string> {
  const { data } = await sb
    .from('deals')
    .select('*, company:companies(name), stage:pipeline_stages(name)')
    .eq('id', id)
    .single();
  if (!data) return '';
  const lines: string[] = [header('deal', data.title)];
  addField(lines, 'Description', data.description);
  addField(lines, 'Company', data.company?.name);
  addField(lines, 'Stage', data.stage?.name);
  addField(lines, 'Lost Reason', data.lost_reason);
  return lines.join('\n');
}

async function buildInteraction(id: string, sb: SupabaseClient): Promise<string> {
  const { data } = await sb
    .from('crm_interactions')
    .select('*, contact:contacts(first_name, last_name)')
    .eq('id', id)
    .single();
  if (!data) return '';
  const contactName = data.contact
    ? [data.contact.first_name, data.contact.last_name].filter(Boolean).join(' ')
    : null;
  const lines: string[] = [header('interaction', data.subject)];
  addField(lines, 'Contact', contactName);
  addField(lines, 'Body', data.body);
  return lines.join('\n');
}

async function buildProduct(id: string, sb: SupabaseClient): Promise<string> {
  const { data } = await sb.from('products').select('*').eq('id', id).single();
  if (!data) return '';
  const lines: string[] = [header('product', data.name)];
  addField(lines, 'Description', data.description);
  addField(lines, 'Short Description', data.short_description);
  addField(lines, 'SKU', data.sku);
  addField(lines, 'Purchase Note', data.purchase_note);
  return lines.join('\n');
}

async function buildProductCategory(id: string, sb: SupabaseClient): Promise<string> {
  const { data } = await sb.from('product_categories').select('*').eq('id', id).single();
  if (!data) return '';
  const lines: string[] = [header('product_category', data.name)];
  addField(lines, 'Description', data.description);
  return lines.join('\n');
}

async function buildOrder(id: string, sb: SupabaseClient): Promise<string> {
  const { data } = await sb
    .from('orders')
    .select('*, order_line_items(product:products(name))')
    .eq('id', id)
    .single();
  if (!data) return '';
  const lines: string[] = [header('order', `Order ${data.order_number || id}`)];
  addField(lines, 'Customer Note', data.customer_note);
  addField(lines, 'Internal Note', data.internal_note);
  if (data.order_line_items?.length) {
    const productNames = data.order_line_items
      .map((li: { product?: { name?: string } }) => li.product?.name)
      .filter(Boolean)
      .join(', ');
    addField(lines, 'Products', productNames);
  }
  return lines.join('\n');
}

async function buildQuote(id: string, sb: SupabaseClient): Promise<string> {
  const { data } = await sb.from('quotes').select('*').eq('id', id).single();
  if (!data) return '';
  const lines: string[] = [header('quote', data.title)];
  addField(lines, 'Introduction', data.introduction);
  addField(lines, 'Terms and Conditions', data.terms_and_conditions);
  addField(lines, 'Customer Note', data.customer_note);
  addField(lines, 'Internal Note', data.internal_note);
  return lines.join('\n');
}

async function buildInvoice(id: string, sb: SupabaseClient): Promise<string> {
  const { data } = await sb.from('invoices').select('*').eq('id', id).single();
  if (!data) return '';
  const lines: string[] = [header('invoice', `Invoice ${data.invoice_number || id}`)];
  addField(lines, 'Terms and Conditions', data.terms_and_conditions);
  addField(lines, 'Customer Note', data.customer_note);
  addField(lines, 'Internal Note', data.internal_note);
  return lines.join('\n');
}

async function buildProject(id: string, sb: SupabaseClient): Promise<string> {
  const { data } = await sb.from('projects').select('*').eq('id', id).single();
  if (!data) return '';
  const lines: string[] = [header('project', data.name)];
  addField(lines, 'Description', data.description);
  return lines.join('\n');
}

async function buildMission(id: string, sb: SupabaseClient): Promise<string> {
  const { data } = await sb.from('missions').select('*').eq('id', id).single();
  if (!data) return '';
  const lines: string[] = [header('mission', data.title)];
  addField(lines, 'Description', data.description);
  addField(lines, 'Mission Statement', data.mission_statement);
  addField(lines, 'Mission Plan', data.mission_plan);
  addField(lines, 'Input', data.input_text);
  addField(lines, 'Output', data.output_text);
  addField(lines, 'Review Notes', data.review_notes);
  return lines.join('\n');
}

async function buildTask(id: string, sb: SupabaseClient): Promise<string> {
  const { data } = await sb.from('tasks').select('*').eq('id', id).single();
  if (!data) return '';
  const lines: string[] = [header('task', data.title)];
  addField(lines, 'Description', data.description);
  return lines.join('\n');
}

async function buildEmail(id: string, sb: SupabaseClient): Promise<string> {
  const { data } = await sb.from('emails').select('*').eq('id', id).single();
  if (!data) return '';
  const lines: string[] = [header('email', data.subject)];
  addField(lines, 'From', data.from_address);
  addField(lines, 'Body', data.body_text);
  return lines.join('\n');
}

async function buildEmailTemplate(id: string, sb: SupabaseClient): Promise<string> {
  const { data } = await sb.from('email_templates').select('*').eq('id', id).single();
  if (!data) return '';
  const lines: string[] = [header('email_template', data.name)];
  addField(lines, 'Subject', data.subject);
  addField(lines, 'Body', data.body_text);
  return lines.join('\n');
}

async function buildCalendarEvent(id: string, sb: SupabaseClient): Promise<string> {
  const { data } = await sb.from('calendar_events').select('*').eq('id', id).single();
  if (!data) return '';
  const lines: string[] = [header('calendar_event', data.title)];
  addField(lines, 'Description', data.description);
  addField(lines, 'Location', data.location);
  return lines.join('\n');
}

async function buildWorkflow(id: string, sb: SupabaseClient): Promise<string> {
  const { data } = await sb.from('workflows').select('*').eq('id', id).single();
  if (!data) return '';
  const lines: string[] = [header('workflow', data.name)];
  addField(lines, 'Description', data.description);
  return lines.join('\n');
}

async function buildWorkflowSequence(id: string, sb: SupabaseClient): Promise<string> {
  const { data } = await sb.from('workflow_sequences').select('*').eq('id', id).single();
  if (!data) return '';
  const lines: string[] = [header('workflow_sequence', data.name)];
  addField(lines, 'Description', data.description);
  return lines.join('\n');
}

async function buildDocument(id: string, sb: SupabaseClient): Promise<string> {
  const { data } = await sb.from('documents').select('*').eq('id', id).single();
  if (!data) return '';
  const lines: string[] = [header('document', data.title)];
  addField(lines, 'Content', data.content);
  return lines.join('\n');
}

async function buildCrmDocument(id: string, sb: SupabaseClient): Promise<string> {
  const { data } = await sb.from('crm_documents').select('*').eq('id', id).single();
  if (!data) return '';
  const lines: string[] = [header('crm_document', data.title)];
  addField(lines, 'Description', data.description);
  return lines.join('\n');
}

async function buildAgent(id: string, sb: SupabaseClient): Promise<string> {
  const { data } = await sb.from('agents').select('*').eq('id', id).single();
  if (!data) return '';
  const lines: string[] = [header('agent', data.name)];
  addField(lines, 'Role', data.role);
  addField(lines, 'Persona', data.persona);
  // Serialize key fields from soul JSONB
  if (data.soul && typeof data.soul === 'object') {
    const soul = data.soul as Record<string, unknown>;
    if (soul.origin) addField(lines, 'Origin', String(soul.origin));
    if (soul.philosophy) addField(lines, 'Philosophy', String(soul.philosophy));
    if (soul.communication_style) {
      addField(lines, 'Communication Style', String(soul.communication_style));
    }
  }
  return lines.join('\n');
}

async function buildBoardroomMessage(id: string, sb: SupabaseClient): Promise<string> {
  const { data } = await sb
    .from('boardroom_messages')
    .select('*, agent:agents(name), session:boardroom_sessions(title)')
    .eq('id', id)
    .single();
  if (!data) return '';
  const lines: string[] = [header('boardroom_message', data.agent?.name || 'Unknown Agent')];
  addField(lines, 'Session', data.session?.title);
  addField(lines, 'Content', data.content);
  addField(lines, 'Reasoning', data.reasoning);
  return lines.join('\n');
}

async function buildNotification(id: string, sb: SupabaseClient): Promise<string> {
  const { data } = await sb.from('app_notifications').select('*').eq('id', id).single();
  if (!data) return '';
  const lines: string[] = [header('notification', data.title)];
  addField(lines, 'Body', data.body);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Builder registry
// ---------------------------------------------------------------------------

const BUILDERS: Record<string, BuilderFn> = {
  company: buildCompany,
  contact: buildContact,
  deal: buildDeal,
  interaction: buildInteraction,
  product: buildProduct,
  product_category: buildProductCategory,
  order: buildOrder,
  quote: buildQuote,
  invoice: buildInvoice,
  project: buildProject,
  mission: buildMission,
  task: buildTask,
  email: buildEmail,
  email_template: buildEmailTemplate,
  calendar_event: buildCalendarEvent,
  workflow: buildWorkflow,
  workflow_sequence: buildWorkflowSequence,
  document: buildDocument,
  crm_document: buildCrmDocument,
  agent: buildAgent,
  boardroom_message: buildBoardroomMessage,
  notification: buildNotification,
};
