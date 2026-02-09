import type { TriggerType, TriggerEntity } from '../../types/workflows';
import {
  TRIGGER_TYPE_CONFIG,
  TRIGGER_ENTITY_OPTIONS,
} from '../../types/workflows';

interface TriggerConfigProps {
  triggerType: TriggerType;
  triggerEntity: TriggerEntity | null;
  triggerConditions: Record<string, unknown>;
  triggerSchedule: string | null;
  onChange: (updates: {
    trigger_type?: TriggerType;
    trigger_entity?: TriggerEntity | null;
    trigger_conditions?: Record<string, unknown>;
    trigger_schedule?: string | null;
  }) => void;
}

const TRIGGER_TYPES = Object.entries(TRIGGER_TYPE_CONFIG) as [
  TriggerType,
  { label: string; description: string }
][];

export function TriggerConfig({
  triggerType,
  triggerEntity,
  triggerConditions,
  triggerSchedule,
  onChange,
}: TriggerConfigProps) {
  const needsEntity = ![
    'schedule',
    'manual',
    'webhook',
  ].includes(triggerType);

  const isFieldChange = triggerType === 'field_changed';

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-zinc-300">Trigger</h3>

      {/* Trigger type */}
      <div>
        <label className="block text-xs text-zinc-500 mb-1">When</label>
        <select
          value={triggerType}
          onChange={(e) =>
            onChange({ trigger_type: e.target.value as TriggerType })
          }
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-amber-500/50"
        >
          {TRIGGER_TYPES.map(([key, config]) => (
            <option key={key} value={key}>
              {config.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-zinc-600 mt-1">
          {TRIGGER_TYPE_CONFIG[triggerType].description}
        </p>
      </div>

      {/* Entity selection */}
      {needsEntity && (
        <div>
          <label className="block text-xs text-zinc-500 mb-1">Entity</label>
          <select
            value={triggerEntity || ''}
            onChange={(e) =>
              onChange({
                trigger_entity: (e.target.value as TriggerEntity) || null,
              })
            }
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-amber-500/50"
          >
            <option value="">Select entity...</option>
            {TRIGGER_ENTITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Field changed conditions */}
      {isFieldChange && (
        <div className="space-y-2">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Field name</label>
            <input
              type="text"
              value={(triggerConditions.field as string) || ''}
              onChange={(e) =>
                onChange({
                  trigger_conditions: {
                    ...triggerConditions,
                    field: e.target.value,
                  },
                })
              }
              placeholder="e.g. lifecycle_status"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/50"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">
                From (optional)
              </label>
              <input
                type="text"
                value={(triggerConditions.from as string) || ''}
                onChange={(e) =>
                  onChange({
                    trigger_conditions: {
                      ...triggerConditions,
                      from: e.target.value || undefined,
                    },
                  })
                }
                placeholder="Any"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/50"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">
                To (optional)
              </label>
              <input
                type="text"
                value={(triggerConditions.to as string) || ''}
                onChange={(e) =>
                  onChange({
                    trigger_conditions: {
                      ...triggerConditions,
                      to: e.target.value || undefined,
                    },
                  })
                }
                placeholder="Any"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/50"
              />
            </div>
          </div>
        </div>
      )}

      {/* Schedule */}
      {triggerType === 'schedule' && (
        <div>
          <label className="block text-xs text-zinc-500 mb-1">
            Cron expression
          </label>
          <input
            type="text"
            value={triggerSchedule || ''}
            onChange={(e) =>
              onChange({ trigger_schedule: e.target.value || null })
            }
            placeholder="0 9 * * 1-5 (weekdays at 9am)"
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/50"
          />
        </div>
      )}
    </div>
  );
}
