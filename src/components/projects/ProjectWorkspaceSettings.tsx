import { useState } from 'react';
import { useProjects } from '../../hooks/useProjects';
import { useProjectsStore } from '../../stores/projects';
import { useCrmStore } from '../../stores/crm';
import { getAgent } from '../../types/supabase';
import { ProjectTeamSection } from './ProjectTeamSection';
import type { Project } from '../../stores/projects';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCurrency(amount: number | null, currency = 'USD'): string {
  if (amount == null) return '--';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

// ─── Component ──────────────────────────────────────────────────────────────

interface Props {
  project: Project;
}

export function ProjectWorkspaceSettings({ project }: Props) {
  const { updateProjectDetails, deleteProject } = useProjects();
  const selectProject = useProjectsStore((s) => s.selectProject);

  const contacts = useCrmStore((s) => s.contacts);
  const companies = useCrmStore((s) => s.companies);
  const deals = useCrmStore((s) => s.deals);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [editBudget, setEditBudget] = useState('');
  const [editCurrency, setEditCurrency] = useState('');
  const [isEditingDates, setIsEditingDates] = useState(false);
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editTag, setEditTag] = useState('');

  const agent = project.owner_agent_id ? getAgent(project.owner_agent_id) : null;
  const contact = project.contact_id ? contacts.find((c) => c.id === project.contact_id) : null;
  const company = project.company_id ? companies.find((c) => c.id === project.company_id) : null;
  const deal = project.deal_id ? deals.find((d) => d.id === project.deal_id) : null;

  const handleDelete = async () => {
    await deleteProject(project.id);
    selectProject(null);
  };

  const handleSaveName = async () => {
    if (editName.trim()) {
      await updateProjectDetails(project.id, { name: editName.trim() });
    }
    setIsEditingName(false);
  };

  const handleSaveBudget = async () => {
    const budget = editBudget ? Number(editBudget) : null;
    await updateProjectDetails(project.id, {
      budget,
      currency: editCurrency || project.currency,
    });
    setIsEditingBudget(false);
  };

  const handleSaveDates = async () => {
    await updateProjectDetails(project.id, {
      start_date: editStartDate || null,
      target_end_date: editEndDate || null,
    });
    setIsEditingDates(false);
  };

  const handleAddTag = async () => {
    if (!editTag.trim()) return;
    const tags = [...(project.tags || []), editTag.trim()];
    await updateProjectDetails(project.id, { tags });
    setEditTag('');
  };

  const handleRemoveTag = async (tag: string) => {
    const tags = (project.tags || []).filter((t) => t !== tag);
    await updateProjectDetails(project.id, { tags });
  };

  return (
    <div className="space-y-5">
      {/* Client Information */}
      <div className="border border-zinc-800 rounded-lg p-3 space-y-2">
        <label className="block text-xs text-zinc-500">Client Information</label>
        <div className="space-y-1.5">
          {agent && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-zinc-500 w-20 shrink-0">Owner</span>
              <span className="text-zinc-300">
                {agent.emoji} {agent.name} - {agent.role}
              </span>
            </div>
          )}
          {contact && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-zinc-500 w-20 shrink-0">Contact</span>
              <span className="text-zinc-300">
                {contact.first_name} {contact.last_name}
                {contact.email && (
                  <span className="text-zinc-500 ml-1">({contact.email})</span>
                )}
              </span>
            </div>
          )}
          {company && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-zinc-500 w-20 shrink-0">Company</span>
              <span className="text-zinc-300">{company.name}</span>
            </div>
          )}
          {deal && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-zinc-500 w-20 shrink-0">Deal</span>
              <span className="text-zinc-300">
                {deal.title}
                {deal.amount != null && (
                  <span className="text-zinc-500 ml-1">
                    ({formatCurrency(deal.amount, deal.currency)})
                  </span>
                )}
              </span>
            </div>
          )}
          {!agent && !contact && !company && !deal && (
            <p className="text-xs text-zinc-600">No client information linked.</p>
          )}
        </div>
      </div>

      {/* Project Team */}
      <ProjectTeamSection projectId={project.id} />

      {/* Budget & Timeline */}
      <div className="border border-zinc-800 rounded-lg p-3 space-y-3">
        <label className="block text-xs text-zinc-500">Budget & Timeline</label>

        {/* Budget */}
        {isEditingBudget ? (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="number"
                value={editBudget}
                onChange={(e) => setEditBudget(e.target.value)}
                placeholder="Budget amount"
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
              />
              <select
                value={editCurrency}
                onChange={(e) => setEditCurrency(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-300"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="ZAR">ZAR</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={handleSaveBudget} className="px-3 py-1 text-xs bg-amber-500 text-black rounded">Save</button>
              <button onClick={() => setIsEditingBudget(false)} className="px-3 py-1 text-xs text-zinc-400">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs text-zinc-500">Budget: </span>
              <span className="text-sm text-zinc-300">{formatCurrency(project.budget, project.currency)}</span>
            </div>
            <button
              onClick={() => {
                setEditBudget(project.budget?.toString() || '');
                setEditCurrency(project.currency || 'USD');
                setIsEditingBudget(true);
              }}
              className="text-[10px] text-zinc-600 hover:text-zinc-400"
            >
              Edit
            </button>
          </div>
        )}

        {/* Dates */}
        {isEditingDates ? (
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-[10px] text-zinc-500 mb-0.5">Start Date</label>
                <input
                  type="date"
                  value={editStartDate}
                  onChange={(e) => setEditStartDate(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] text-zinc-500 mb-0.5">Target End</label>
                <input
                  type="date"
                  value={editEndDate}
                  onChange={(e) => setEditEndDate(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleSaveDates} className="px-3 py-1 text-xs bg-amber-500 text-black rounded">Save</button>
              <button onClick={() => setIsEditingDates(false)} className="px-3 py-1 text-xs text-zinc-400">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="text-sm text-zinc-300">
              {project.start_date
                ? new Date(project.start_date).toLocaleDateString()
                : 'No start'}
              {' - '}
              {project.target_end_date
                ? new Date(project.target_end_date).toLocaleDateString()
                : 'No end'}
            </div>
            <button
              onClick={() => {
                setEditStartDate(project.start_date?.split('T')[0] || '');
                setEditEndDate(project.target_end_date?.split('T')[0] || '');
                setIsEditingDates(true);
              }}
              className="text-[10px] text-zinc-600 hover:text-zinc-400"
            >
              Edit
            </button>
          </div>
        )}
      </div>

      {/* Tags */}
      <div className="border border-zinc-800 rounded-lg p-3 space-y-2">
        <label className="block text-xs text-zinc-500">Tags</label>
        <div className="flex flex-wrap gap-1">
          {(project.tags || []).map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 text-xs bg-zinc-800 text-zinc-400 rounded border border-zinc-700 flex items-center gap-1"
            >
              {tag}
              <button
                onClick={() => handleRemoveTag(tag)}
                className="text-zinc-600 hover:text-red-400"
              >
                {'\u00D7'}
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={editTag}
            onChange={(e) => setEditTag(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
            placeholder="Add tag..."
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
          />
          <button
            onClick={handleAddTag}
            className="px-2 py-1 text-xs text-amber-400 hover:text-amber-300"
          >
            + Add
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="border border-red-500/20 rounded-lg p-3 space-y-3">
        <label className="block text-xs text-red-400">Danger Zone</label>

        {/* Edit name */}
        {isEditingName ? (
          <div className="space-y-2">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
            />
            <div className="flex gap-2">
              <button onClick={handleSaveName} className="px-3 py-1 text-xs bg-amber-500 text-black rounded">Save</button>
              <button onClick={() => setIsEditingName(false)} className="px-3 py-1 text-xs text-zinc-400">Cancel</button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => {
              setEditName(project.name);
              setIsEditingName(true);
            }}
            className="px-3 py-1.5 text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 rounded hover:border-zinc-500 transition-colors"
          >
            Rename Project
          </button>
        )}

        {/* Delete */}
        {confirmDelete ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-red-400">Delete this project?</span>
            <button
              onClick={handleDelete}
              className="px-3 py-1.5 text-xs bg-red-500/20 border border-red-500/50 text-red-400 rounded hover:bg-red-500/30 transition-colors"
            >
              Confirm
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="px-3 py-1.5 text-xs bg-zinc-800 border border-zinc-700 text-red-400 rounded hover:border-red-500/50 transition-colors"
          >
            Delete Project
          </button>
        )}
      </div>
    </div>
  );
}
