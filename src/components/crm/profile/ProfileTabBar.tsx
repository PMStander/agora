export interface ProfileTab {
  id: string;
  label: string;
  icon: string;
  count?: number;
}

interface ProfileTabBarProps {
  tabs: ProfileTab[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function ProfileTabBar({ tabs, activeTab, onTabChange }: ProfileTabBarProps) {
  return (
    <div className="flex items-center gap-1 px-5 border-b border-zinc-800 bg-zinc-900/30 overflow-x-auto">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`
            flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
            ${activeTab === tab.id
              ? 'border-amber-400 text-amber-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }
          `}
        >
          <span className="text-xs">{tab.icon}</span>
          {tab.label}
          {tab.count !== undefined && tab.count > 0 && (
            <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
