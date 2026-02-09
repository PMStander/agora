// ─── File Size Formatting ───────────────────────────────────────────────────

/**
 * Format a byte count into a human-readable string.
 * Examples: "1.2 MB", "340 KB", "12 B"
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  // Show decimals only for MB and above, and only if not a round number
  if (i >= 2) {
    return `${value.toFixed(1).replace(/\.0$/, '')} ${units[i]}`;
  }
  return `${Math.round(value)} ${units[i]}`;
}

// ─── CSV Utilities ──────────────────────────────────────────────────────────
// Pure functions for parsing, generating, and downloading CSV files.

/**
 * Parse CSV text into an array of objects keyed by header names.
 * Handles: quoted fields, commas inside quotes, escaped quotes (""),
 * \r\n / \n / \r line endings, and trailing newlines.
 */
export function parseCSV(text: string): Record<string, string>[] {
  const rows = parseCSVRows(text);
  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => h.trim());
  const records: Record<string, string>[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    // Skip completely empty rows
    if (row.length === 1 && row[0].trim() === '') continue;

    const record: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      record[headers[j]] = (row[j] ?? '').trim();
    }
    records.push(record);
  }

  return records;
}

/**
 * Low-level CSV row parser. Returns an array of arrays of strings.
 * Implements RFC 4180 with tolerance for mixed line endings.
 */
function parseCSVRows(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        // Peek ahead: escaped quote ("") or end of quoted field
        if (i + 1 < text.length && text[i + 1] === '"') {
          currentField += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        currentField += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ',') {
        currentRow.push(currentField);
        currentField = '';
        i++;
      } else if (ch === '\r') {
        currentRow.push(currentField);
        currentField = '';
        rows.push(currentRow);
        currentRow = [];
        // Consume \r\n as a single line ending
        if (i + 1 < text.length && text[i + 1] === '\n') {
          i += 2;
        } else {
          i++;
        }
      } else if (ch === '\n') {
        currentRow.push(currentField);
        currentField = '';
        rows.push(currentRow);
        currentRow = [];
        i++;
      } else {
        currentField += ch;
        i++;
      }
    }
  }

  // Push last field / row
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Generate a CSV string from an array of objects.
 * @param data  Array of records to serialize
 * @param columns  Ordered list of keys to include as columns
 */
export function generateCSV(
  data: Record<string, unknown>[],
  columns: string[]
): string {
  const escapeField = (value: unknown): string => {
    const str = value == null ? '' : String(value);
    // Wrap in quotes if the value contains commas, quotes, or newlines
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerRow = columns.map(escapeField).join(',');
  const dataRows = data.map((row) =>
    columns.map((col) => escapeField(row[col])).join(',')
  );

  return [headerRow, ...dataRows].join('\n');
}

/**
 * Trigger a browser download of a CSV string.
 */
export function downloadCSV(csvString: string, filename: string): void {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─── Field Mapping ──────────────────────────────────────────────────────────

/** Canonical CRM contact field names */
export const CONTACT_FIELDS: { value: string; label: string }[] = [
  { value: '', label: '-- Skip --' },
  { value: 'first_name', label: 'First Name' },
  { value: 'last_name', label: 'Last Name' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'job_title', label: 'Job Title' },
  { value: 'company_name', label: 'Company Name' },
  { value: 'lifecycle_status', label: 'Lifecycle Status' },
  { value: 'lead_source', label: 'Lead Source' },
  { value: 'tags', label: 'Tags' },
  { value: 'notes', label: 'Notes' },
];

/** Canonical CRM company field names */
export const COMPANY_FIELDS: { value: string; label: string }[] = [
  { value: '', label: '-- Skip --' },
  { value: 'name', label: 'Name' },
  { value: 'domain', label: 'Domain' },
  { value: 'industry', label: 'Industry' },
  { value: 'size_category', label: 'Size Category' },
  { value: 'website', label: 'Website' },
  { value: 'phone', label: 'Phone' },
  { value: 'address_line1', label: 'Address' },
  { value: 'city', label: 'City' },
  { value: 'state', label: 'State' },
  { value: 'postal_code', label: 'Postal Code' },
  { value: 'country', label: 'Country' },
  { value: 'annual_revenue', label: 'Annual Revenue' },
  { value: 'tags', label: 'Tags' },
  { value: 'notes', label: 'Notes' },
];

/**
 * Auto-detect mapping from CSV header names to CRM field names.
 * Returns a map: csvHeader -> crmField (empty string means "skip").
 */
export function detectFieldMapping(
  headers: string[],
  targetFields: { value: string; label: string }[]
): Record<string, string> {
  const mapping: Record<string, string> = {};

  // Lookup table: normalized alias -> CRM field value
  const aliases: Record<string, string> = {
    // Contact fields
    'first name': 'first_name',
    'first_name': 'first_name',
    'firstname': 'first_name',
    'given name': 'first_name',
    'last name': 'last_name',
    'last_name': 'last_name',
    'lastname': 'last_name',
    'surname': 'last_name',
    'family name': 'last_name',
    'email': 'email',
    'email address': 'email',
    'e-mail': 'email',
    'email_address': 'email',
    'phone': 'phone',
    'phone number': 'phone',
    'telephone': 'phone',
    'mobile': 'phone',
    'cell': 'phone',
    'phone_number': 'phone',
    'job title': 'job_title',
    'job_title': 'job_title',
    'title': 'job_title',
    'position': 'job_title',
    'role': 'job_title',
    'company': 'company_name',
    'company name': 'company_name',
    'company_name': 'company_name',
    'organization': 'company_name',
    'organisation': 'company_name',
    'org': 'company_name',
    'lifecycle status': 'lifecycle_status',
    'lifecycle_status': 'lifecycle_status',
    'status': 'lifecycle_status',
    'lead source': 'lead_source',
    'lead_source': 'lead_source',
    'source': 'lead_source',
    'tags': 'tags',
    'tag': 'tags',
    'notes': 'notes',
    'note': 'notes',
    'description': 'notes',
    'comment': 'notes',
    'comments': 'notes',

    // Company fields
    'name': 'name',
    'company_domain': 'domain',
    'domain': 'domain',
    'website domain': 'domain',
    'industry': 'industry',
    'sector': 'industry',
    'size': 'size_category',
    'size category': 'size_category',
    'size_category': 'size_category',
    'company size': 'size_category',
    'employees': 'size_category',
    'website': 'website',
    'web': 'website',
    'url': 'website',
    'site': 'website',
    'address': 'address_line1',
    'address line 1': 'address_line1',
    'address_line1': 'address_line1',
    'street': 'address_line1',
    'city': 'city',
    'state': 'state',
    'province': 'state',
    'region': 'state',
    'postal code': 'postal_code',
    'postal_code': 'postal_code',
    'zip': 'postal_code',
    'zip code': 'postal_code',
    'zipcode': 'postal_code',
    'postcode': 'postal_code',
    'country': 'country',
    'annual revenue': 'annual_revenue',
    'annual_revenue': 'annual_revenue',
    'revenue': 'annual_revenue',
  };

  // Build set of valid target field values
  const validFields = new Set(targetFields.map((f) => f.value).filter(Boolean));

  for (const header of headers) {
    const normalized = header.toLowerCase().trim();
    const mapped = aliases[normalized];
    if (mapped && validFields.has(mapped)) {
      mapping[header] = mapped;
    } else {
      mapping[header] = '';
    }
  }

  return mapping;
}

// ─── Validation ─────────────────────────────────────────────────────────────

export interface ValidationError {
  row: number;
  field: string;
  message: string;
}

/**
 * Validate mapped contact rows. Returns errors for rows with missing required fields.
 */
export function validateContactRows(
  rows: Record<string, string>[],
  fieldMapping: Record<string, string>
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Invert mapping: crmField -> csvHeader
  const crmToHeader: Record<string, string> = {};
  for (const [csvHeader, crmField] of Object.entries(fieldMapping)) {
    if (crmField) crmToHeader[crmField] = csvHeader;
  }

  const hasFirstName = 'first_name' in crmToHeader;
  const hasLastName = 'last_name' in crmToHeader;

  rows.forEach((row, i) => {
    if (hasFirstName && !row[crmToHeader['first_name']]?.trim()) {
      errors.push({ row: i, field: 'first_name', message: 'First name is required' });
    }
    if (hasLastName && !row[crmToHeader['last_name']]?.trim()) {
      errors.push({ row: i, field: 'last_name', message: 'Last name is required' });
    }
    // If neither is mapped, flag at row level
    if (!hasFirstName) {
      errors.push({ row: i, field: 'first_name', message: 'First name column not mapped' });
    }
    if (!hasLastName) {
      errors.push({ row: i, field: 'last_name', message: 'Last name column not mapped' });
    }
  });

  return errors;
}

/**
 * Validate mapped company rows. Returns errors for rows with missing required name.
 */
export function validateCompanyRows(
  rows: Record<string, string>[],
  fieldMapping: Record<string, string>
): ValidationError[] {
  const errors: ValidationError[] = [];

  const crmToHeader: Record<string, string> = {};
  for (const [csvHeader, crmField] of Object.entries(fieldMapping)) {
    if (crmField) crmToHeader[crmField] = csvHeader;
  }

  const hasName = 'name' in crmToHeader;

  rows.forEach((row, i) => {
    if (hasName && !row[crmToHeader['name']]?.trim()) {
      errors.push({ row: i, field: 'name', message: 'Company name is required' });
    }
    if (!hasName) {
      errors.push({ row: i, field: 'name', message: 'Name column not mapped' });
    }
  });

  return errors;
}

/**
 * Apply field mapping to a CSV row, returning an object with CRM field keys.
 */
export function applyFieldMapping(
  row: Record<string, string>,
  fieldMapping: Record<string, string>
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [csvHeader, crmField] of Object.entries(fieldMapping)) {
    if (crmField && row[csvHeader] !== undefined) {
      result[crmField] = row[csvHeader].trim();
    }
  }
  return result;
}
