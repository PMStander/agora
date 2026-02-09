import { useState, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useCrmStore } from '../../stores/crm';
import {
  parseCSV,
  detectFieldMapping,
  COMPANY_FIELDS,
  validateCompanyRows,
  applyFieldMapping,
  type ValidationError,
} from '../../lib/csvUtils';
import type { Company, CompanySizeCategory } from '../../types/crm';

// ─── Props ──────────────────────────────────────────────────────────────────

interface ImportCompaniesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const VALID_SIZE_CATEGORIES: Set<string> = new Set([
  'solo', 'micro', 'small', 'medium', 'large', 'enterprise',
]);

const STEPS = ['Upload', 'Map Fields', 'Preview', 'Import'] as const;
type Step = 0 | 1 | 2 | 3;

// ─── Component ──────────────────────────────────────────────────────────────

export function ImportCompaniesModal({ isOpen, onClose }: ImportCompaniesModalProps) {
  const addCompany = useCrmStore((s) => s.addCompany);

  // Step navigation
  const [step, setStep] = useState<Step>(0);

  // Step 1: File upload
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [fileError, setFileError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2: Field mapping
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});

  // Step 3: Preview / validation
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  // Step 4: Import
  const [duplicateMode, setDuplicateMode] = useState<'skip' | 'update'>('skip');
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<{
    created: number;
    updated: number;
    skipped: number;
    errors: number;
  } | null>(null);

  // Drag state
  const [isDragging, setIsDragging] = useState(false);

  if (!isOpen) return null;

  const reset = () => {
    setStep(0);
    setCsvRows([]);
    setCsvHeaders([]);
    setFileName('');
    setFileError('');
    setFieldMapping({});
    setValidationErrors([]);
    setDuplicateMode('skip');
    setIsImporting(false);
    setImportProgress(0);
    setImportResults(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  // ── Step 1: File handling ──

  const processFile = (file: File) => {
    setFileError('');
    if (!file.name.endsWith('.csv')) {
      setFileError('Please upload a .csv file');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setFileError('File too large (max 10MB)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = parseCSV(text);
      if (rows.length === 0) {
        setFileError('No data rows found in CSV');
        return;
      }
      const headers = Object.keys(rows[0]);
      setCsvRows(rows);
      setCsvHeaders(headers);
      setFileName(file.name);

      // Auto-detect field mapping
      const mapping = detectFieldMapping(headers, COMPANY_FIELDS);
      setFieldMapping(mapping);

      setStep(1);
    };
    reader.onerror = () => setFileError('Failed to read file');
    reader.readAsText(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  // ── Step 2: Mapping changes ──

  const updateMapping = (csvHeader: string, crmField: string) => {
    setFieldMapping((prev) => ({ ...prev, [csvHeader]: crmField }));
  };

  const goToPreview = () => {
    const rowErrors = validateCompanyRows(csvRows, fieldMapping).filter(
      (e) => !e.message.includes('not mapped')
    );
    setValidationErrors(rowErrors);
    setStep(2);
  };

  // ── Step 3: Preview data ──

  const previewRows = csvRows.slice(0, 5);
  const mappedPreview = previewRows.map((row) => applyFieldMapping(row, fieldMapping));

  const errorRowSet = new Set(validationErrors.map((e) => e.row));

  // Check if required fields are mapped
  const mappedCrmFields = new Set(Object.values(fieldMapping).filter(Boolean));
  const hasRequiredFields = mappedCrmFields.has('name');

  // ── Step 4: Import ──

  const runImport = async () => {
    setIsImporting(true);
    setImportProgress(0);
    setImportResults(null);

    const results = { created: 0, updated: 0, skipped: 0, errors: 0 };

    // Get existing companies for duplicate detection
    const { data: existingCompanies } = await supabase
      .from('companies')
      .select('id, name, domain');

    const existingByName = new Map<string, string>();
    const existingByDomain = new Map<string, string>();
    if (existingCompanies) {
      for (const c of existingCompanies) {
        existingByName.set(c.name.toLowerCase(), c.id);
        if (c.domain) existingByDomain.set(c.domain.toLowerCase(), c.id);
      }
    }

    // Process in batches of 50
    const BATCH_SIZE = 50;
    const totalRows = csvRows.length;

    for (let i = 0; i < totalRows; i += BATCH_SIZE) {
      const batch = csvRows.slice(i, i + BATCH_SIZE);
      const toInsert: Record<string, unknown>[] = [];
      const toUpdate: { id: string; data: Record<string, unknown> }[] = [];

      for (const row of batch) {
        const mapped = applyFieldMapping(row, fieldMapping);

        // Skip rows missing required fields
        if (!mapped.name?.trim()) {
          results.skipped++;
          continue;
        }

        // Build the company record
        const companyData: Record<string, unknown> = {
          name: mapped.name.trim(),
        };

        if (mapped.domain) companyData.domain = mapped.domain.trim() || null;
        if (mapped.industry) companyData.industry = mapped.industry.trim() || null;
        if (mapped.website) companyData.website = mapped.website.trim() || null;
        if (mapped.phone) companyData.phone = mapped.phone.trim() || null;
        if (mapped.address_line1) companyData.address_line1 = mapped.address_line1.trim() || null;
        if (mapped.city) companyData.city = mapped.city.trim() || null;
        if (mapped.state) companyData.state = mapped.state.trim() || null;
        if (mapped.postal_code) companyData.postal_code = mapped.postal_code.trim() || null;
        if (mapped.country) companyData.country = mapped.country.trim() || null;
        if (mapped.notes) companyData.notes = mapped.notes.trim() || null;

        // Size category validation
        if (mapped.size_category) {
          const normalized = mapped.size_category.toLowerCase().trim();
          if (VALID_SIZE_CATEGORIES.has(normalized)) {
            companyData.size_category = normalized as CompanySizeCategory;
          }
        }

        // Annual revenue (parse number)
        if (mapped.annual_revenue) {
          const cleaned = mapped.annual_revenue.replace(/[$,\s]/g, '');
          const num = parseFloat(cleaned);
          if (!isNaN(num)) companyData.annual_revenue = num;
        }

        // Tags (comma-separated in CSV)
        if (mapped.tags) {
          companyData.tags = mapped.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
        }

        // Duplicate detection by name or domain
        const name = (companyData.name as string).toLowerCase();
        const domain = (companyData.domain as string)?.toLowerCase();
        const existingId =
          existingByName.get(name) ||
          (domain ? existingByDomain.get(domain) : undefined);

        if (existingId) {
          if (duplicateMode === 'skip') {
            results.skipped++;
            continue;
          } else {
            toUpdate.push({ id: existingId, data: companyData });
          }
        } else {
          toInsert.push(companyData);
        }
      }

      // Batch insert
      if (toInsert.length > 0) {
        const { data, error } = await supabase
          .from('companies')
          .insert(toInsert)
          .select();

        if (error) {
          console.error('[CSV Import] Insert error:', error);
          results.errors += toInsert.length;
        } else if (data) {
          results.created += data.length;
          for (const company of data) {
            addCompany(company as Company);
          }
        }
      }

      // Batch updates (one at a time due to different IDs)
      for (const { id, data } of toUpdate) {
        const { data: updated, error } = await supabase
          .from('companies')
          .update({ ...data, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single();

        if (error) {
          console.error('[CSV Import] Update error:', error);
          results.errors++;
        } else if (updated) {
          results.updated++;
          addCompany(updated as Company);
        }
      }

      setImportProgress(Math.min(100, Math.round(((i + batch.length) / totalRows) * 100)));
    }

    setImportResults(results);
    setIsImporting(false);
    setImportProgress(100);
  };

  // ── Render ──

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">Import Companies</h2>
            {fileName && (
              <p className="text-xs text-zinc-500 mt-0.5">{fileName} -- {csvRows.length} rows</p>
            )}
          </div>
          <button
            onClick={handleClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1 px-6 py-3 border-b border-zinc-800 bg-zinc-900/50 shrink-0">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-1">
              <div
                className={`
                  flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium
                  ${i === step
                    ? 'bg-amber-500 text-black'
                    : i < step
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-zinc-800 text-zinc-500'
                  }
                `}
              >
                {i < step ? '\u2713' : i + 1}
              </div>
              <span
                className={`text-xs ${
                  i === step ? 'text-zinc-200' : 'text-zinc-500'
                }`}
              >
                {label}
              </span>
              {i < STEPS.length - 1 && (
                <div className={`w-8 h-px mx-1 ${i < step ? 'bg-amber-500/30' : 'bg-zinc-700'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Upload */}
          {step === 0 && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors
                  ${isDragging
                    ? 'border-amber-500 bg-amber-500/5'
                    : 'border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800/30'
                  }
                `}
              >
                <div className="text-3xl mb-3 text-zinc-500">&#x1F3E2;</div>
                <p className="text-sm text-zinc-300 mb-1">
                  Drop CSV here or click to browse
                </p>
                <p className="text-xs text-zinc-500">
                  Supports .csv files up to 10MB
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileInput}
                className="hidden"
              />
              {fileError && (
                <p className="text-sm text-red-400">{fileError}</p>
              )}
              <div className="text-xs text-zinc-600 space-y-1">
                <p>Expected columns: Name, Domain, Industry, Size, Website, Phone, City, Country, etc.</p>
                <p>The next step will let you map your CSV columns to CRM fields.</p>
              </div>
            </div>
          )}

          {/* Step 2: Field Mapping */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-400">
                Map your CSV columns to CRM company fields. Auto-detected mappings are pre-filled.
              </p>
              <div className="border border-zinc-800 rounded-lg overflow-hidden">
                <div className="grid grid-cols-2 gap-0 px-4 py-2 bg-zinc-800/50 text-xs text-zinc-400 font-medium border-b border-zinc-800">
                  <span>CSV Column</span>
                  <span>CRM Field</span>
                </div>
                {csvHeaders.map((header) => (
                  <div
                    key={header}
                    className="grid grid-cols-2 gap-0 px-4 py-2 border-b border-zinc-800/50 items-center"
                  >
                    <span className="text-sm text-zinc-300 truncate" title={header}>
                      {header}
                      <span className="text-xs text-zinc-600 ml-2">
                        e.g. "{csvRows[0]?.[header]?.slice(0, 30)}"
                      </span>
                    </span>
                    <select
                      value={fieldMapping[header] ?? ''}
                      onChange={(e) => updateMapping(header, e.target.value)}
                      className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-200 focus:border-amber-500/50 focus:outline-none transition-colors"
                    >
                      {COMPANY_FIELDS.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              {!hasRequiredFields && (
                <p className="text-sm text-amber-400">
                  Please map at least the Name field to proceed.
                </p>
              )}
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-zinc-400">
                  Preview of first {previewRows.length} rows ({csvRows.length} total)
                </p>
                {validationErrors.length > 0 && (
                  <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-1 rounded">
                    {new Set(validationErrors.map((e) => e.row)).size} rows with warnings
                  </span>
                )}
              </div>

              {/* Preview table */}
              <div className="border border-zinc-800 rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-zinc-800/50 border-b border-zinc-800">
                      <th className="text-left px-3 py-2 text-xs text-zinc-400 font-medium">#</th>
                      {Object.entries(fieldMapping)
                        .filter(([, v]) => v)
                        .map(([, crmField]) => (
                          <th
                            key={crmField}
                            className="text-left px-3 py-2 text-xs text-zinc-400 font-medium whitespace-nowrap"
                          >
                            {COMPANY_FIELDS.find((f) => f.value === crmField)?.label ?? crmField}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mappedPreview.map((row, i) => (
                      <tr
                        key={i}
                        className={`border-b border-zinc-800/50 ${
                          errorRowSet.has(i) ? 'bg-red-500/5' : ''
                        }`}
                      >
                        <td className="px-3 py-2 text-xs text-zinc-500">{i + 1}</td>
                        {Object.entries(fieldMapping)
                          .filter(([, v]) => v)
                          .map(([, crmField]) => (
                            <td
                              key={crmField}
                              className="px-3 py-2 text-zinc-300 truncate max-w-[200px]"
                            >
                              {row[crmField] || (
                                <span className="text-zinc-600">--</span>
                              )}
                            </td>
                          ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {csvRows.length > 5 && (
                <p className="text-xs text-zinc-600 text-center">
                  ... and {csvRows.length - 5} more rows
                </p>
              )}

              {/* Duplicate handling */}
              <div className="border border-zinc-800 rounded-lg p-4 space-y-2">
                <p className="text-sm text-zinc-300 font-medium">Duplicate Handling</p>
                <p className="text-xs text-zinc-500">
                  When a company with the same name or domain already exists:
                </p>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="duplicateMode"
                      value="skip"
                      checked={duplicateMode === 'skip'}
                      onChange={() => setDuplicateMode('skip')}
                      className="accent-amber-500"
                    />
                    <span className="text-sm text-zinc-300">Skip duplicates</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="duplicateMode"
                      value="update"
                      checked={duplicateMode === 'update'}
                      onChange={() => setDuplicateMode('update')}
                      className="accent-amber-500"
                    />
                    <span className="text-sm text-zinc-300">Update existing</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Import */}
          {step === 3 && (
            <div className="space-y-6">
              {!importResults ? (
                <>
                  <div className="text-center space-y-3">
                    <p className="text-sm text-zinc-300">
                      Ready to import {csvRows.length} companies
                    </p>
                    <p className="text-xs text-zinc-500">
                      Duplicate mode: {duplicateMode === 'skip' ? 'Skip' : 'Update existing'}
                    </p>
                  </div>

                  {/* Progress bar */}
                  {isImporting && (
                    <div className="space-y-2">
                      <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-amber-500 h-full rounded-full transition-all duration-300"
                          style={{ width: `${importProgress}%` }}
                        />
                      </div>
                      <p className="text-xs text-zinc-500 text-center">
                        Importing... {importProgress}%
                      </p>
                    </div>
                  )}

                  {!isImporting && (
                    <div className="flex justify-center">
                      <button
                        onClick={runImport}
                        className="px-6 py-2.5 text-sm bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-400 transition-colors"
                      >
                        Start Import
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-3xl mb-2">{importResults.errors > 0 ? '\u26A0' : '\u2713'}</div>
                    <p className="text-lg font-medium text-zinc-100">Import Complete</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-emerald-400">{importResults.created}</p>
                      <p className="text-xs text-zinc-400">Created</p>
                    </div>
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-blue-400">{importResults.updated}</p>
                      <p className="text-xs text-zinc-400">Updated</p>
                    </div>
                    <div className="bg-zinc-500/10 border border-zinc-600 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-zinc-400">{importResults.skipped}</p>
                      <p className="text-xs text-zinc-400">Skipped</p>
                    </div>
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-red-400">{importResults.errors}</p>
                      <p className="text-xs text-zinc-400">Errors</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800 bg-zinc-900/50 shrink-0">
          <div>
            {step > 0 && step < 3 && (
              <button
                onClick={() => setStep((s) => (s - 1) as Step)}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Back
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              {importResults ? 'Done' : 'Cancel'}
            </button>
            {step === 1 && (
              <button
                onClick={goToPreview}
                disabled={!hasRequiredFields}
                className="px-5 py-2 text-sm bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next: Preview
              </button>
            )}
            {step === 2 && (
              <button
                onClick={() => setStep(3)}
                className="px-5 py-2 text-sm bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-400 transition-colors"
              >
                Next: Import
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
