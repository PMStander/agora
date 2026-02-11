import { useCrmStore } from '../../../stores/crm';

const ENTITY_ICONS: Record<string, string> = {
  contact: '👤',
  company: '🏢',
  deal: '💰',
  quote: '📋',
  invoice: '🧾',
  project: '📂',
};

export function ProfileBreadcrumb() {
  const navStack = useCrmStore((s) => s.profileNavStack);
  const currentType = useCrmStore((s) => s.profileWorkspaceEntityType);
  const currentId = useCrmStore((s) => s.profileWorkspaceEntityId);
  const navigateBack = useCrmStore((s) => s.navigateBack);
  const close = useCrmStore((s) => s.closeProfileWorkspace);

  // Derive current entity label from stores
  const contacts = useCrmStore((s) => s.contacts);
  const companies = useCrmStore((s) => s.companies);
  const deals = useCrmStore((s) => s.deals);

  const getCurrentLabel = (): string => {
    if (!currentType || !currentId) return '';
    switch (currentType) {
      case 'contact': {
        const c = contacts.find((x) => x.id === currentId);
        return c ? `${c.first_name} ${c.last_name}` : 'Contact';
      }
      case 'company': {
        const c = companies.find((x) => x.id === currentId);
        return c?.name ?? 'Company';
      }
      case 'deal': {
        const d = deals.find((x) => x.id === currentId);
        return d?.title ?? 'Deal';
      }
      default:
        return currentType.charAt(0).toUpperCase() + currentType.slice(1);
    }
  };

  return (
    <div className="flex items-center gap-2 px-5 py-2 border-b border-zinc-800 bg-zinc-900/60 text-sm">
      {/* Close button */}
      <button
        onClick={close}
        className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors"
        title="Close profile"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Back button */}
      {navStack.length > 0 && (
        <button
          onClick={navigateBack}
          className="flex items-center gap-1 px-2 py-0.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
      )}

      {/* Breadcrumb trail */}
      {navStack.map((entry, i) => (
        <span key={i} className="flex items-center gap-1">
          <span className="text-zinc-600">/</span>
          <span className="text-zinc-500">
            {ENTITY_ICONS[entry.entityType] ?? ''} {entry.label}
          </span>
        </span>
      ))}

      {/* Current entity */}
      <span className="flex items-center gap-1">
        <span className="text-zinc-600">/</span>
        <span className="text-zinc-200 font-medium">
          {ENTITY_ICONS[currentType ?? ''] ?? ''} {getCurrentLabel()}
        </span>
      </span>
    </div>
  );
}
