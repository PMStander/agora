import { useState } from 'react';
import { ContextBrowser } from './ContextBrowser';
import { AgentDirectory } from './AgentDirectory';
import { MemoryViewer } from './MemoryViewer';

type ContextSubTab = 'contexts' | 'directory' | 'memory';

export function ContextTab() {
  const [subTab, setSubTab] = useState<ContextSubTab>('contexts');

  return (
    <div className="flex flex-col h-full">
      {/* Sub-tab switcher */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-zinc-800 bg-zinc-900/50">
        {([
          { key: 'contexts', label: 'Contexts', icon: '📄' },
          { key: 'directory', label: 'Agent Directory', icon: '👥' },
          { key: 'memory', label: 'Memory', icon: '🧠' },
        ] as const).map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setSubTab(key)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              subTab === key
                ? 'bg-amber-500/20 text-amber-400'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {subTab === 'contexts' && <ContextBrowser />}
        {subTab === 'directory' && <AgentDirectory />}
        {subTab === 'memory' && <MemoryViewer />}
      </div>
    </div>
  );
}
