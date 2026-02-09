import { useState, useCallback } from 'react';
import { generateCSV, downloadCSV } from '../../lib/csvUtils';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ExportColumn {
  key: string;
  label: string;
}

interface ExportButtonProps {
  data: Record<string, unknown>[];
  columns: ExportColumn[];
  filename: string;
  label?: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ExportButton({
  data,
  columns,
  filename,
  label = 'Export',
}: ExportButtonProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(() => {
    if (data.length === 0) return;

    setExporting(true);

    // Use requestAnimationFrame to let the UI show "Exporting..." before doing work
    requestAnimationFrame(() => {
      try {
        const columnKeys = columns.map((c) => c.key);
        // Use labels as CSV headers, but keyed data uses keys
        const headerRow = columns.map((c) => c.label);
        const csvRows = data.map((row) =>
          columnKeys.reduce<Record<string, unknown>>((acc, key, i) => {
            acc[headerRow[i]] = row[key];
            return acc;
          }, {})
        );

        const csv = generateCSV(csvRows, headerRow);
        downloadCSV(csv, filename);
      } catch (err) {
        console.error('[CSV Export] Error:', err);
      } finally {
        // Brief delay so the user sees the "Exporting..." state
        setTimeout(() => setExporting(false), 600);
      }
    });
  }, [data, columns, filename]);

  return (
    <button
      onClick={handleExport}
      disabled={exporting || data.length === 0}
      className="px-3 py-1.5 text-sm text-zinc-300 bg-zinc-800 border border-zinc-700 rounded-lg hover:bg-zinc-700 hover:text-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      title={data.length === 0 ? 'No data to export' : `Export ${data.length} rows as CSV`}
    >
      {exporting ? 'Exporting...' : label}
    </button>
  );
}
