import type { Contact } from '../types/crm';

// ─── Types ──────────────────────────────────────────────────────────────────

export type MatchType = 'email' | 'name' | 'phone';
export type MatchConfidence = 'high' | 'medium' | 'low';

export interface DuplicateGroup {
  contacts: Contact[];
  matchType: MatchType;
  confidence: MatchConfidence;
}

// ─── String Normalization ───────────────────────────────────────────────────

/**
 * Normalize a phone number by stripping all non-digit characters.
 * Returns empty string for null/undefined input.
 */
export function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return '';
  return phone.replace(/[^0-9]/g, '');
}

/**
 * Normalize an email address: lowercase and trim whitespace.
 * Returns empty string for null/undefined input.
 */
export function normalizeEmail(email: string | null | undefined): string {
  if (!email) return '';
  return email.toLowerCase().trim();
}

/**
 * Normalize a name for fuzzy comparison: lowercase, trim, collapse whitespace.
 */
function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

// ─── Levenshtein Distance ───────────────────────────────────────────────────

/**
 * Compute the Levenshtein (edit) distance between two strings.
 * Uses a standard dynamic-programming matrix approach.
 */
export function levenshteinDistance(a: string, b: string): number {
  const la = a.length;
  const lb = b.length;

  if (la === 0) return lb;
  if (lb === 0) return la;

  // Use two rows instead of full matrix for memory efficiency
  let prev = Array.from({ length: lb + 1 }, (_, i) => i);
  let curr = new Array<number>(lb + 1);

  for (let i = 1; i <= la; i++) {
    curr[0] = i;
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,       // deletion
        curr[j - 1] + 1,   // insertion
        prev[j - 1] + cost  // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[lb];
}

// ─── Duplicate Detection ────────────────────────────────────────────────────

/**
 * Find groups of duplicate contacts based on email, name, and phone matches.
 *
 * Detection rules:
 * - Exact email match: confidence "high"
 * - Fuzzy name match (Levenshtein distance <= 2 on normalized full name): confidence "medium"
 * - Same phone number (normalized, stripped of formatting): confidence "medium"
 *
 * Each contact appears in at most one group. Priority: email > phone > name.
 */
export function findDuplicateContacts(contacts: Contact[]): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const assignedIds = new Set<string>();

  // ── Pass 1: Exact email matches (highest confidence) ──
  const emailMap = new Map<string, Contact[]>();
  for (const contact of contacts) {
    const email = normalizeEmail(contact.email);
    if (!email) continue;
    const existing = emailMap.get(email);
    if (existing) {
      existing.push(contact);
    } else {
      emailMap.set(email, [contact]);
    }
  }

  for (const [, group] of emailMap) {
    if (group.length < 2) continue;
    groups.push({
      contacts: group,
      matchType: 'email',
      confidence: 'high',
    });
    for (const c of group) assignedIds.add(c.id);
  }

  // ── Pass 2: Same phone number ──
  const phoneMap = new Map<string, Contact[]>();
  for (const contact of contacts) {
    if (assignedIds.has(contact.id)) continue;
    const phone = normalizePhone(contact.phone);
    if (!phone || phone.length < 7) continue; // ignore very short numbers
    const existing = phoneMap.get(phone);
    if (existing) {
      existing.push(contact);
    } else {
      phoneMap.set(phone, [contact]);
    }
  }

  for (const [, group] of phoneMap) {
    if (group.length < 2) continue;
    groups.push({
      contacts: group,
      matchType: 'phone',
      confidence: 'medium',
    });
    for (const c of group) assignedIds.add(c.id);
  }

  // ── Pass 3: Fuzzy name matches (Levenshtein distance <= 2) ──
  const remaining = contacts.filter((c) => !assignedIds.has(c.id));
  const nameProcessed = remaining.map((c) => ({
    contact: c,
    fullName: normalizeName(`${c.first_name} ${c.last_name}`),
  }));

  const nameAssigned = new Set<string>();

  for (let i = 0; i < nameProcessed.length; i++) {
    if (nameAssigned.has(nameProcessed[i].contact.id)) continue;
    const cluster: Contact[] = [nameProcessed[i].contact];

    for (let j = i + 1; j < nameProcessed.length; j++) {
      if (nameAssigned.has(nameProcessed[j].contact.id)) continue;

      const nameA = nameProcessed[i].fullName;
      const nameB = nameProcessed[j].fullName;

      // Skip very short names to avoid false positives
      if (nameA.length < 3 || nameB.length < 3) continue;

      const dist = levenshteinDistance(nameA, nameB);
      if (dist <= 2 && dist < Math.min(nameA.length, nameB.length)) {
        cluster.push(nameProcessed[j].contact);
        nameAssigned.add(nameProcessed[j].contact.id);
      }
    }

    if (cluster.length >= 2) {
      nameAssigned.add(nameProcessed[i].contact.id);
      groups.push({
        contacts: cluster,
        matchType: 'name',
        confidence: 'low',
      });
    }
  }

  return groups;
}

// ─── Merge Field Resolution ─────────────────────────────────────────────────

/**
 * Given a primary contact and one or more duplicates, produce the merged
 * field updates for the primary contact. For each nullable/optional field,
 * if the primary's value is null/empty, copy from the first duplicate that
 * has a non-null value. Tags and custom_fields are merged (union).
 */
export function computeMergedFields(
  primary: Contact,
  duplicates: Contact[]
): Partial<Contact> {
  const updates: Partial<Contact> = {};

  const fillableFields: (keyof Contact)[] = [
    'email',
    'phone',
    'avatar_url',
    'company_id',
    'job_title',
    'lead_source',
    'owner_agent_id',
    'notes',
    'last_contacted_at',
  ];

  for (const field of fillableFields) {
    if (!primary[field]) {
      for (const dup of duplicates) {
        if (dup[field]) {
          (updates as any)[field] = dup[field];
          break;
        }
      }
    }
  }

  // Merge tags: union of all tags
  const allTags = new Set(primary.tags);
  for (const dup of duplicates) {
    for (const tag of dup.tags) allTags.add(tag);
  }
  const mergedTags = Array.from(allTags);
  if (mergedTags.length > primary.tags.length) {
    updates.tags = mergedTags;
  }

  // Merge custom_fields: primary wins on conflicts
  const mergedCustom = { ...primary.custom_fields };
  for (const dup of duplicates) {
    for (const [key, value] of Object.entries(dup.custom_fields)) {
      if (!(key in mergedCustom)) {
        mergedCustom[key] = value;
      }
    }
  }
  if (Object.keys(mergedCustom).length > Object.keys(primary.custom_fields).length) {
    updates.custom_fields = mergedCustom;
  }

  // Use the highest lead_score among all contacts
  const maxScore = Math.max(primary.lead_score, ...duplicates.map((d) => d.lead_score));
  if (maxScore > primary.lead_score) {
    updates.lead_score = maxScore;
    // Find the contact with the max score and use its label
    const maxContact = duplicates.find((d) => d.lead_score === maxScore);
    if (maxContact) {
      updates.lead_score_label = maxContact.lead_score_label;
    }
  }

  return updates;
}
