import { SESSION_TYPE_PRESETS, type BoardroomSessionType } from '../../types/boardroom';

interface BoardroomPresetPickerProps {
  selected: BoardroomSessionType;
  onSelect: (type: BoardroomSessionType) => void;
}

export function BoardroomPresetPicker({ selected, onSelect }: BoardroomPresetPickerProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
      {SESSION_TYPE_PRESETS.filter((p) => p.type !== 'custom').map((preset) => (
        <button
          key={preset.type}
          onClick={() => onSelect(preset.type)}
          className={`
            text-left p-3 rounded-lg border transition-all
            ${selected === preset.type
              ? 'border-amber-500/50 bg-amber-500/10'
              : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-800/50'
            }
          `}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{preset.icon}</span>
            <span className={`text-sm font-medium ${selected === preset.type ? 'text-amber-400' : 'text-zinc-200'}`}>
              {preset.label}
            </span>
          </div>
          <p className="text-[11px] text-zinc-500 line-clamp-2">{preset.description}</p>
        </button>
      ))}
    </div>
  );
}
