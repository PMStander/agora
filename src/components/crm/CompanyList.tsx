import { useState, useMemo } from 'react';
import { useCrmStore } from '../../stores/crm';
import { useCRM } from '../../hooks/useCRM';
import { AGENTS, getAgent } from '../../types/supabase';
import { CreateCompanyModal } from './CreateCompanyModal';
import { ImportCompaniesModal } from './ImportCompaniesModal';
import { ExportButton } from './ExportButton';
import { SaveViewButton } from './SaveViewButton';
import type { Company } from '../../types/crm';

type CompanySortField = 'name' | 'industry' | 'size_category' | 'created_at';
type SortDirection = 'asc' | 'desc';

const SIZE_ORDER: Record<string, number> = {
  solo: 0,
  micro: 1,
  small: 2,
  medium: 3,
  large: 4,
  enterprise: 5,
};

function compareCompanies(a: Company, b: Company, field: CompanySortField, dir: SortDirection): number {
  let cmp = 0;
  switch (field) {
    case 'name':
      cmp = a.name.localeCompare(b.name);
      break;
    case 'industry':
      cmp = (a.industry ?? '').localeCompare(b.industry ?? '');
      break;
    case 'size_category':
      cmp = (SIZE_ORDER[a.size_category ?? ''] ?? -1) - (SIZE_ORDER[b.size_category ?? ''] ?? -1);
      break;
    case 'created_at':
      cmp = a.created_at.localeCompare(b.created_at);
      break;
  }
  return dir === 'asc' ? cmp : -cmp;
}

function formatCurrency(amount: number | null): string {
  if (amount == null) return '--';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

const SIZE_LABELS: Record<string, string> = {
  solo: 'Solo',
  micro: 'Micro (1-9)',
  small: 'Small (10-49)',
  medium: 'Medium (50-249)',
  large: 'Large (250-999)',
  enterprise: 'Enterprise (1000+)',
};

export function CompanyList() {
  const { isConfigured } = useCRM();
  const companies = useCrmStore((s) => s.companies);
  const selectedCompanyId = useCrmStore((s) => s.selectedCompanyId);
  const selectCompany = useCrmStore((s) => s.selectCompany);
  const searchQuery = useCrmStore((s) => s.searchQuery);
  const setSearchQuery = useCrmStore((s) => s.setSearchQuery);
  const filters = useCrmStore((s) => s.filters);
  const setFilters = useCrmStore((s) => s.setFilters);

  const [showCreateCompany, setShowCreateCompany] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [sortField, setSortField] = useState<CompanySortField>('name');
  const [sortDir, setSortDir] = useState<SortDirection>('asc');

  const handleSort = (field: CompanySortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sortIndicator = (field: CompanySortField) =>
    sortField === field ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';

  const filteredCompanies = useMemo(() => {
    const filtered = companies.filter((company) => {
      if (filters.ownerAgent && company.owner_agent_id !== filters.ownerAgent)
        return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          company.name.toLowerCase().includes(q) ||
          (company.domain?.toLowerCase().includes(q) ?? false) ||
          (company.industry?.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    });
    return [...filtered].sort((a, b) => compareCompanies(a, b, sortField, sortDir));
  }, [companies, searchQuery, filters.ownerAgent, sortField, sortDir]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-zinc-100">Companies</h2>
          <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
            {filteredCompanies.length}
          </span>
          {!isConfigured && (
            <span className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
              Local Mode
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search companies..."
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-300 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 w-64"
          />
          <button
            onClick={() => setShowImportModal(true)}
            className="px-3 py-1.5 text-sm text-zinc-300 bg-zinc-800 border border-zinc-700 rounded-lg hover:bg-zinc-700 hover:text-zinc-100 transition-colors"
          >
            Import
          </button>
          <ExportButton
            data={filteredCompanies.map((c) => ({
              name: c.name,
              domain: c.domain ?? '',
              industry: c.industry ?? '',
              size_category: c.size_category ?? '',
              website: c.website ?? '',
              phone: c.phone ?? '',
              city: c.city ?? '',
              state: c.state ?? '',
              country: c.country ?? '',
              annual_revenue: c.annual_revenue ?? '',
              tags: c.tags.join(', '),
              notes: c.notes ?? '',
            }))}
            columns={[
              { key: 'name', label: 'Name' },
              { key: 'domain', label: 'Domain' },
              { key: 'industry', label: 'Industry' },
              { key: 'size_category', label: 'Size Category' },
              { key: 'website', label: 'Website' },
              { key: 'phone', label: 'Phone' },
              { key: 'city', label: 'City' },
              { key: 'state', label: 'State' },
              { key: 'country', label: 'Country' },
              { key: 'annual_revenue', label: 'Annual Revenue' },
              { key: 'tags', label: 'Tags' },
              { key: 'notes', label: 'Notes' },
            ]}
            filename="companies-export"
            label="Export"
          />
          <button
            onClick={() => setShowCreateCompany(true)}
            className="px-4 py-1.5 bg-amber-500 text-black text-sm font-medium rounded-lg hover:bg-amber-400 transition-colors"
          >
            New Company
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800 bg-zinc-900/30">
        <select
          value={filters.ownerAgent ?? ''}
          onChange={(e) => setFilters({ ownerAgent: e.target.value || null })}
          className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-300"
        >
          <option value="">All Agents</option>
          {AGENTS.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.emoji} {agent.name}
            </option>
          ))}
        </select>
        <SaveViewButton entityType="companies" />
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {/* Table header */}
        <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_1fr] gap-2 px-4 py-2 border-b border-zinc-800 bg-zinc-900/50 text-xs text-zinc-500 font-medium sticky top-0">
          <button onClick={() => handleSort('name')} className="text-left hover:text-zinc-300 transition-colors">
            Name{sortIndicator('name')}
          </button>
          <span>Domain</span>
          <button onClick={() => handleSort('industry')} className="text-left hover:text-zinc-300 transition-colors">
            Industry{sortIndicator('industry')}
          </button>
          <button onClick={() => handleSort('size_category')} className="text-left hover:text-zinc-300 transition-colors">
            Size{sortIndicator('size_category')}
          </button>
          <span>Agent</span>
          <span>Revenue</span>
        </div>

        {/* Table rows */}
        {filteredCompanies.length === 0 ? (
          <div className="text-center text-zinc-600 py-12">
            <p className="text-sm">No companies found</p>
            <p className="text-xs mt-1">
              {searchQuery || filters.ownerAgent
                ? 'Try adjusting your filters'
                : 'Create a company to get started'}
            </p>
          </div>
        ) : (
          filteredCompanies.map((company) => {
            const agent = company.owner_agent_id
              ? getAgent(company.owner_agent_id)
              : null;

            return (
              <div
                key={company.id}
                onClick={() => selectCompany(company.id)}
                className={`
                  grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_1fr] gap-2 px-4 py-2.5 border-b border-zinc-800/50
                  cursor-pointer transition-colors
                  ${selectedCompanyId === company.id
                    ? 'bg-zinc-800'
                    : 'hover:bg-zinc-800/50'
                  }
                `}
              >
                {/* Name */}
                <span className="text-sm text-zinc-100 truncate">
                  {company.name}
                </span>

                {/* Domain */}
                <span className="text-sm text-zinc-400 truncate">
                  {company.domain ?? '--'}
                </span>

                {/* Industry */}
                <span className="text-sm text-zinc-400 truncate">
                  {company.industry ?? '--'}
                </span>

                {/* Size */}
                <span className="text-xs text-zinc-400">
                  {company.size_category
                    ? SIZE_LABELS[company.size_category] ?? company.size_category
                    : '--'}
                </span>

                {/* Agent */}
                <span className="text-sm text-zinc-400 truncate">
                  {agent ? (
                    <span title={`${agent.name} — ${agent.role}`}>
                      {agent.emoji} {agent.name}
                    </span>
                  ) : (
                    '--'
                  )}
                </span>

                {/* Revenue */}
                <span className="text-sm text-zinc-300">
                  {formatCurrency(company.annual_revenue)}
                </span>
              </div>
            );
          })
        )}
      </div>

      <CreateCompanyModal
        isOpen={showCreateCompany}
        onClose={() => setShowCreateCompany(false)}
      />

      <ImportCompaniesModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
      />
    </div>
  );
}
