import { useState } from 'react';
import { useEmailStore } from '../../stores/email';
import { useEmail } from '../../hooks/useEmail';
import { EmailList } from './EmailList';
import { EmailThread } from './EmailThread';
import { EmailComposer } from './EmailComposer';
import { EmailTemplateList } from './EmailTemplateList';
import { EmailTemplateEditor } from './EmailTemplateEditor';
import { EmailAccountSetup } from './EmailAccountSetup';

const SUB_TABS = [
  { key: 'inbox' as const, label: 'Inbox' },
  { key: 'sent' as const, label: 'Sent' },
  { key: 'drafts' as const, label: 'Drafts' },
  { key: 'templates' as const, label: 'Templates' },
] as const;

export function EmailTab() {
  useEmail(); // Initialize data + realtime

  const activeSubTab = useEmailStore((s) => s.activeSubTab);
  const setActiveSubTab = useEmailStore((s) => s.setActiveSubTab);
  const composeOpen = useEmailStore((s) => s.composeOpen);
  const setComposeOpen = useEmailStore((s) => s.setComposeOpen);
  const searchQuery = useEmailStore((s) => s.searchQuery);
  const setSearchQuery = useEmailStore((s) => s.setSearchQuery);
  const selectedEmailId = useEmailStore((s) => s.selectedEmailId);

  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [showAccountSetup, setShowAccountSetup] = useState(false);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-zinc-200">Email</h2>
          <div className="flex gap-1">
            {SUB_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveSubTab(tab.key)}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  activeSubTab === tab.key
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAccountSetup(!showAccountSetup)}
            className="px-3 py-1.5 text-xs bg-zinc-800 border border-zinc-700 text-zinc-400 rounded-lg hover:border-zinc-500 hover:text-zinc-200 transition-colors"
          >
            Accounts
          </button>
          {activeSubTab === 'templates' && (
            <button
              onClick={() => setShowTemplateEditor(true)}
              className="px-3 py-1.5 text-xs bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors"
            >
              + Template
            </button>
          )}
          <button
            onClick={() => setComposeOpen(true)}
            className="px-3 py-1.5 text-xs bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors font-medium"
          >
            + Compose
          </button>
        </div>
      </div>

      {/* Search */}
      {activeSubTab !== 'templates' && !showAccountSetup && (
        <div className="px-4 py-2 border-b border-zinc-800">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search emails..."
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none transition-colors"
          />
        </div>
      )}

      {/* Main Content */}
      {showAccountSetup ? (
        <EmailAccountSetup />
      ) : activeSubTab === 'templates' ? (
        <EmailTemplateList />
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Email List */}
          <div className="w-80 border-r border-zinc-800 flex flex-col">
            <EmailList />
          </div>
          {/* Email Detail / Thread */}
          <div className="flex-1 flex flex-col">
            <EmailThread />
          </div>
        </div>
      )}

      {/* Compose Modal */}
      {composeOpen && <EmailComposer />}

      {/* Template Editor Modal */}
      <EmailTemplateEditor
        isOpen={showTemplateEditor}
        onClose={() => setShowTemplateEditor(false)}
      />
    </div>
  );
}
