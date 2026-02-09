import type { ReactNode } from 'react';
import { type A2UISurface, type A2UIComponent } from '../../hooks/useA2UI';
import { cn } from '../../lib/utils';

export interface A2UIActionEvent {
  surfaceId: string;
  componentId: string;
  action: string;
  payload?: unknown;
}

interface A2UIRendererProps {
  surface: A2UISurface;
  onAction?: (event: A2UIActionEvent) => void;
}

interface ComponentProps {
  component: A2UIComponent;
  surface: A2UISurface;
  children?: ReactNode;
  onAction?: (event: A2UIActionEvent) => void;
}

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' ? value as JsonRecord : {};
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function formatMoney(value: unknown, currency = 'USD'): string {
  const numberValue = toNumber(value, 0);
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(numberValue);
}

function resolveToneClasses(tone: string): string {
  if (tone === 'success') return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
  if (tone === 'warning') return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  if (tone === 'danger') return 'bg-red-500/15 text-red-300 border-red-500/30';
  if (tone === 'info') return 'bg-sky-500/15 text-sky-300 border-sky-500/30';
  return 'bg-zinc-700/30 text-zinc-300 border-zinc-600';
}

// Resolve data bindings like {{path.to.data}}
function resolveBinding(value: unknown, dataModel: Record<string, unknown>): unknown {
  if (typeof value !== 'string') return value;

  const bindingMatch = value.match(/^\{\{(.+?)\}\}$/);
  if (!bindingMatch) return value;

  const path = bindingMatch[1].split('.');
  let result: unknown = dataModel;

  for (const key of path) {
    if (result && typeof result === 'object' && key in result) {
      result = (result as Record<string, unknown>)[key];
    } else {
      return value;
    }
  }

  return result;
}

function emitAction(
  onAction: ((event: A2UIActionEvent) => void) | undefined,
  surface: A2UISurface,
  component: A2UIComponent,
  action: string,
  payload?: unknown,
) {
  if (!onAction) {
    console.log('[A2UI] Action:', action, payload);
    return;
  }
  onAction({
    surfaceId: surface.id,
    componentId: component.id,
    action,
    payload,
  });
}

// Component catalog - maps A2UI types to React components
const ComponentCatalog: Record<string, React.FC<ComponentProps>> = {
  Column: ({ children, component }: ComponentProps) => (
    <div className={cn('flex flex-col gap-2', component.props?.className as string)}>
      {children}
    </div>
  ),

  Row: ({ children, component }: ComponentProps) => (
    <div className={cn('flex flex-row gap-2 items-center', component.props?.className as string)}>
      {children}
    </div>
  ),

  Card: ({ children, component }: ComponentProps) => (
    <div className={cn('p-4 rounded-lg bg-muted/50 border border-border', component.props?.className as string)}>
      {component.props?.title ? (
        <h3 className="font-semibold mb-2">{String(component.props.title)}</h3>
      ) : null}
      {children}
    </div>
  ),

  Text: ({ component, surface }: ComponentProps) => {
    const content = resolveBinding(component.props?.text, surface.dataModel);
    return (
      <p className={cn('text-sm', component.props?.className as string)}>
        {String(content ?? '')}
      </p>
    );
  },

  Heading: ({ component, surface }: ComponentProps) => {
    const content = resolveBinding(component.props?.text, surface.dataModel);
    const level = toNumber(component.props?.level, 2);
    const className = cn('font-bold', level === 1 ? 'text-2xl' : level === 2 ? 'text-xl' : 'text-lg');

    if (level === 1) return <h1 className={className}>{String(content ?? '')}</h1>;
    if (level === 2) return <h2 className={className}>{String(content ?? '')}</h2>;
    if (level === 3) return <h3 className={className}>{String(content ?? '')}</h3>;
    return <h4 className={className}>{String(content ?? '')}</h4>;
  },

  Badge: ({ component, surface }: ComponentProps) => {
    const label = resolveBinding(component.props?.label ?? component.props?.text, surface.dataModel);
    const tone = String(resolveBinding(component.props?.tone, surface.dataModel) ?? 'neutral');
    return (
      <span className={cn('inline-flex items-center px-2 py-1 rounded-full border text-xs font-medium', resolveToneClasses(tone))}>
        {String(label ?? '')}
      </span>
    );
  },

  Stat: ({ component, surface }: ComponentProps) => {
    const value = resolveBinding(component.props?.value, surface.dataModel);
    const label = component.props?.label as string | undefined;
    const valueTone = String(component.props?.tone ?? 'text-primary');
    return (
      <div className="p-3 rounded-lg bg-primary/10 text-center">
        <div className={cn('text-2xl font-bold', valueTone)}>
          {String(value ?? '')}
        </div>
        {label ? <div className="text-xs text-muted-foreground">{label}</div> : null}
      </div>
    );
  },

  KpiGrid: ({ component, surface }: ComponentProps) => {
    const items = toArray(resolveBinding(component.props?.items, surface.dataModel));
    const columns = Math.max(1, toNumber(resolveBinding(component.props?.columns, surface.dataModel), 2));
    return (
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {items.map((entry, i) => {
          const item = asRecord(entry);
          const label = String(item.label ?? item.name ?? `Item ${i + 1}`);
          const value = item.value ?? item.amount ?? item.count ?? '-';
          const delta = item.delta ?? item.change;
          const tone = String(item.tone ?? (toNumber(delta, 0) >= 0 ? 'success' : 'danger'));
          return (
            <div key={`${label}-${i}`} className={cn('rounded-lg border p-3', resolveToneClasses(tone))}>
              <div className="text-xs opacity-80 mb-1">{label}</div>
              <div className="text-lg font-semibold">{String(value)}</div>
              {delta != null ? <div className="text-xs opacity-80 mt-1">{String(delta)}</div> : null}
            </div>
          );
        })}
      </div>
    );
  },

  List: ({ component, surface }: ComponentProps) => {
    const items = toArray(resolveBinding(component.props?.items, surface.dataModel));
    return (
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            {String(item)}
          </li>
        ))}
      </ul>
    );
  },

  Checklist: ({ component, surface }: ComponentProps) => {
    const items = toArray(resolveBinding(component.props?.items, surface.dataModel));
    return (
      <div className="space-y-1.5">
        {items.map((entry, i) => {
          const item = typeof entry === 'string' ? { label: entry } : asRecord(entry);
          const label = String(item.label ?? item.task ?? item.title ?? `Item ${i + 1}`);
          const done = Boolean(item.done ?? item.completed ?? item.checked);
          const owner = item.owner ? String(item.owner) : '';
          const due = item.due ? String(item.due) : '';
          return (
            <div key={`${label}-${i}`} className="flex items-start gap-2 text-sm">
              <span className={cn('mt-0.5 text-xs', done ? 'text-emerald-400' : 'text-zinc-500')}>
                {done ? '✓' : '○'}
              </span>
              <div className="min-w-0">
                <div className={cn(done ? 'line-through text-muted-foreground' : 'text-foreground')}>{label}</div>
                {(owner || due) && (
                  <div className="text-xs text-muted-foreground">
                    {[owner, due].filter(Boolean).join(' • ')}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  },

  Agenda: ({ component, surface }: ComponentProps) => {
    const items = toArray(resolveBinding(component.props?.items, surface.dataModel));
    return (
      <div className="space-y-2">
        {items.map((entry, i) => {
          const item = asRecord(entry);
          const time = String(item.time ?? item.start ?? '--:--');
          const title = String(item.title ?? item.label ?? `Event ${i + 1}`);
          const subtitle = item.subtitle ? String(item.subtitle) : (item.location ? String(item.location) : '');
          const status = item.status ? String(item.status) : '';
          return (
            <div key={`${title}-${i}`} className="rounded-lg border border-zinc-700 bg-zinc-900/60 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-amber-300 font-medium">{time}</div>
                {status ? <span className="text-xs text-zinc-400">{status}</span> : null}
              </div>
              <div className="text-sm text-zinc-100 mt-1">{title}</div>
              {subtitle ? <div className="text-xs text-zinc-400 mt-0.5">{subtitle}</div> : null}
            </div>
          );
        })}
      </div>
    );
  },

  FinanceTable: ({ component, surface }: ComponentProps) => {
    const rows = toArray(resolveBinding(component.props?.rows, surface.dataModel));
    const currency = String(resolveBinding(component.props?.currency, surface.dataModel) ?? 'USD');
    return (
      <div className="rounded-lg border border-zinc-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-800/70 text-zinc-400">
            <tr>
              <th className="text-left font-medium px-3 py-2">Category</th>
              <th className="text-right font-medium px-3 py-2">Amount</th>
              <th className="text-right font-medium px-3 py-2">Change</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((entry, i) => {
              const row = asRecord(entry);
              const category = String(row.category ?? row.label ?? `Row ${i + 1}`);
              const amount = row.amount ?? row.value ?? 0;
              const change = row.change ?? row.delta ?? 0;
              const changeNumber = toNumber(change, 0);
              const changeClass = changeNumber >= 0 ? 'text-emerald-300' : 'text-red-300';
              return (
                <tr key={`${category}-${i}`} className="border-t border-zinc-800">
                  <td className="px-3 py-2 text-zinc-200">{category}</td>
                  <td className="px-3 py-2 text-right text-zinc-100">{formatMoney(amount, currency)}</td>
                  <td className={cn('px-3 py-2 text-right', changeClass)}>
                    {changeNumber >= 0 ? '+' : ''}{toNumber(change, 0).toFixed(2)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  },

  TagList: ({ component, surface }: ComponentProps) => {
    const items = toArray(resolveBinding(component.props?.items, surface.dataModel));
    return (
      <div className="flex flex-wrap gap-1.5">
        {items.map((entry, i) => (
          <span key={i} className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-xs text-zinc-300">
            {String(entry)}
          </span>
        ))}
      </div>
    );
  },

  Button: ({ component, surface, onAction }: ComponentProps) => (
    <button
      className={cn(
        'px-4 py-2 rounded-lg font-medium transition-colors',
        component.props?.variant === 'primary'
          ? 'bg-primary text-primary-foreground hover:bg-primary/90'
          : component.props?.variant === 'danger'
          ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30'
          : 'bg-muted hover:bg-muted/80'
      )}
      onClick={() => emitAction(onAction, surface, component, String(component.props?.action ?? 'click'), component.props?.payload)}
    >
      {String(component.props?.label ?? '')}
    </button>
  ),

  ActionBar: ({ component, surface, onAction }: ComponentProps) => {
    const actions = toArray(resolveBinding(component.props?.actions, surface.dataModel));
    return (
      <div className="flex flex-wrap gap-2">
        {actions.map((entry, i) => {
          const action = asRecord(entry);
          const label = String(action.label ?? action.text ?? `Action ${i + 1}`);
          const actionName = String(action.action ?? action.id ?? label.toLowerCase().replace(/\s+/g, '_'));
          const variant = String(action.variant ?? 'secondary');
          return (
            <button
              key={`${label}-${i}`}
              className={cn(
                'px-3 py-1.5 text-xs rounded-md transition-colors',
                variant === 'primary'
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : variant === 'danger'
                  ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              )}
              onClick={() => emitAction(onAction, surface, component, actionName, action.payload)}
            >
              {label}
            </button>
          );
        })}
      </div>
    );
  },

  Progress: ({ component, surface }: ComponentProps) => {
    const value = toNumber(resolveBinding(component.props?.value, surface.dataModel), 0);
    const max = Math.max(1, toNumber(resolveBinding(component.props?.max, surface.dataModel), 100));
    const percent = Math.min(100, Math.max(0, (value / max) * 100));
    const label = resolveBinding(component.props?.label, surface.dataModel) as string | undefined;
    return (
      <div className="w-full">
        {label ? (
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>{label}</span>
            <span>{Math.round(percent)}%</span>
          </div>
        ) : null}
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    );
  },

  Image: ({ component }: ComponentProps) => (
    <img
      src={component.props?.src as string}
      alt={(component.props?.alt as string) || ''}
      className={cn('rounded-lg max-w-full', component.props?.className as string)}
    />
  ),

  Divider: () => <hr className="border-border my-2" />,

  Spacer: ({ component }: ComponentProps) => (
    <div style={{ height: toNumber(component.props?.size, 16) }} />
  ),

  // ─── CRM A2UI Components ──────────────────────────────────────────────────

  ContactCard: ({ component, surface, onAction }: ComponentProps) => {
    const p = component.props ?? {};
    const name = String(resolveBinding(p.name, surface.dataModel) ?? '');
    const email = resolveBinding(p.email, surface.dataModel) as string | undefined;
    const company = resolveBinding(p.company, surface.dataModel) as string | undefined;
    const jobTitle = resolveBinding(p.jobTitle, surface.dataModel) as string | undefined;
    const lifecycle = String(resolveBinding(p.lifecycle, surface.dataModel) ?? '');
    const agent = resolveBinding(p.agent, surface.dataModel) as string | undefined;
    const avatarUrl = resolveBinding(p.avatarUrl, surface.dataModel) as string | undefined;

    const lifecycleTone: Record<string, string> = {
      subscriber: 'bg-zinc-500/20 text-zinc-300',
      lead: 'bg-blue-500/20 text-blue-300',
      marketing_qualified: 'bg-cyan-500/20 text-cyan-300',
      sales_qualified: 'bg-indigo-500/20 text-indigo-300',
      opportunity: 'bg-amber-500/20 text-amber-300',
      customer: 'bg-emerald-500/20 text-emerald-300',
      evangelist: 'bg-purple-500/20 text-purple-300',
      churned: 'bg-red-500/20 text-red-300',
    };

    const initials = name
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('');

    return (
      <div
        className="flex items-start gap-3 rounded-lg border border-zinc-700 bg-zinc-900/60 p-3 cursor-pointer hover:border-zinc-600 transition-colors"
        onClick={() => emitAction(onAction, surface, component, 'select_contact', { name })}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} className="w-9 h-9 rounded-full object-cover" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center text-xs font-semibold">
            {initials}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-zinc-100 truncate">{name}</div>
          {jobTitle && <div className="text-xs text-zinc-400 truncate">{jobTitle}{company ? ` at ${company}` : ''}</div>}
          {!jobTitle && company && <div className="text-xs text-zinc-400 truncate">{company}</div>}
          {email && <div className="text-xs text-zinc-500 truncate">{email}</div>}
          <div className="flex items-center gap-1.5 mt-1.5">
            {lifecycle && (
              <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', lifecycleTone[lifecycle] ?? 'bg-zinc-700 text-zinc-300')}>
                {lifecycle.replace(/_/g, ' ')}
              </span>
            )}
            {agent && (
              <span className="text-[10px] text-zinc-500">{agent}</span>
            )}
          </div>
        </div>
      </div>
    );
  },

  DealCard: ({ component, surface, onAction }: ComponentProps) => {
    const p = component.props ?? {};
    const title = String(resolveBinding(p.title, surface.dataModel) ?? 'Untitled Deal');
    const amount = resolveBinding(p.amount, surface.dataModel);
    const currency = String(resolveBinding(p.currency, surface.dataModel) ?? 'USD');
    const stage = String(resolveBinding(p.stage, surface.dataModel) ?? '');
    const probability = toNumber(resolveBinding(p.probability, surface.dataModel), -1);
    const status = String(resolveBinding(p.status, surface.dataModel) ?? 'open');
    const contact = resolveBinding(p.contact, surface.dataModel) as string | undefined;
    const agent = resolveBinding(p.agent, surface.dataModel) as string | undefined;

    const statusTone: Record<string, string> = {
      open: 'bg-blue-500/20 text-blue-300',
      won: 'bg-emerald-500/20 text-emerald-300',
      lost: 'bg-red-500/20 text-red-300',
      abandoned: 'bg-zinc-500/20 text-zinc-400',
    };

    return (
      <div
        className="rounded-lg border border-zinc-700 bg-zinc-900/60 p-3 cursor-pointer hover:border-zinc-600 transition-colors"
        onClick={() => emitAction(onAction, surface, component, 'select_deal', { title })}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="text-sm font-medium text-zinc-100 truncate">{title}</div>
          {amount != null && (
            <div className="text-sm font-semibold text-amber-300 shrink-0">{formatMoney(amount, currency)}</div>
          )}
        </div>
        {contact && <div className="text-xs text-zinc-400 mt-1 truncate">{contact}</div>}
        <div className="flex items-center gap-1.5 mt-2">
          {stage && (
            <span className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[10px] text-zinc-300">{stage}</span>
          )}
          {probability >= 0 && (
            <span className="text-[10px] text-zinc-500">{probability}%</span>
          )}
          <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', statusTone[status] ?? statusTone.open)}>
            {status}
          </span>
          {agent && <span className="text-[10px] text-zinc-500 ml-auto">{agent}</span>}
        </div>
      </div>
    );
  },

  InteractionTimeline: ({ component, surface }: ComponentProps) => {
    const items = toArray(resolveBinding(component.props?.items, surface.dataModel));

    const typeEmoji: Record<string, string> = {
      call: '📞', email: '📧', meeting: '🤝', note: '📝', task: '✅', sms: '💬', chat: '🗨️', other: '📌',
    };

    return (
      <div className="space-y-1">
        {items.map((entry, i) => {
          const item = asRecord(entry);
          const type = String(item.type ?? item.interaction_type ?? 'other');
          const subject = String(item.subject ?? item.title ?? '');
          const body = item.body ? String(item.body) : '';
          const agent = item.agent ? String(item.agent) : '';
          const contact = item.contact ? String(item.contact) : '';
          const direction = item.direction ? String(item.direction) : '';
          const time = item.time ?? item.created_at ?? item.date ?? '';
          const emoji = typeEmoji[type] ?? '📌';

          return (
            <div key={`${subject}-${i}`} className="flex gap-2.5 py-2 border-b border-zinc-800/50 last:border-0">
              <div className="text-base mt-0.5 shrink-0">{emoji}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-zinc-200 font-medium truncate">{subject || type}</span>
                  {direction && (
                    <span className={cn(
                      'px-1 py-0.5 rounded text-[10px]',
                      direction === 'inbound' ? 'bg-sky-500/15 text-sky-300' : 'bg-amber-500/15 text-amber-300'
                    )}>
                      {direction}
                    </span>
                  )}
                </div>
                {body && <div className="text-xs text-zinc-400 mt-0.5 line-clamp-2">{body}</div>}
                <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-500">
                  {contact && <span>{contact}</span>}
                  {agent && <span>{agent}</span>}
                  {time && <span>{String(time)}</span>}
                </div>
              </div>
            </div>
          );
        })}
        {items.length === 0 && <div className="text-xs text-zinc-500 py-2">No interactions</div>}
      </div>
    );
  },

  DataTable: ({ component, surface, onAction }: ComponentProps) => {
    const columns = toArray(resolveBinding(component.props?.columns, surface.dataModel));
    const rows = toArray(resolveBinding(component.props?.rows, surface.dataModel));
    const clickAction = component.props?.clickAction as string | undefined;

    return (
      <div className="rounded-lg border border-zinc-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-800/70 text-zinc-400">
            <tr>
              {columns.map((col, i) => {
                const c = asRecord(col);
                const label = String(c.label ?? c.header ?? c.key ?? `Col ${i + 1}`);
                const align = String(c.align ?? 'left');
                return (
                  <th key={`${label}-${i}`} className={cn('font-medium px-3 py-2', align === 'right' ? 'text-right' : 'text-left')}>
                    {label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((entry, ri) => {
              const row = asRecord(entry);
              return (
                <tr
                  key={ri}
                  className={cn('border-t border-zinc-800', clickAction && 'cursor-pointer hover:bg-zinc-800/50')}
                  onClick={clickAction ? () => emitAction(onAction, surface, component, clickAction, row) : undefined}
                >
                  {columns.map((col, ci) => {
                    const c = asRecord(col);
                    const key = String(c.key ?? c.field ?? `col_${ci}`);
                    const align = String(c.align ?? 'left');
                    const format = String(c.format ?? 'text');
                    let cellValue = row[key] ?? '';
                    if (format === 'money') cellValue = formatMoney(cellValue, String(c.currency ?? 'USD'));
                    else cellValue = String(cellValue);
                    return (
                      <td key={`${key}-${ci}`} className={cn('px-3 py-2', align === 'right' ? 'text-right text-zinc-100' : 'text-zinc-200')}>
                        {String(cellValue)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <div className="text-xs text-zinc-500 text-center py-4">No data</div>}
      </div>
    );
  },

  // ─── Product A2UI Components ──────────────────────────────────────────────

  ProductCard: ({ component, surface, onAction }: ComponentProps) => {
    const p = component.props ?? {};
    const name = String(resolveBinding(p.name, surface.dataModel) ?? 'Untitled');
    const price = resolveBinding(p.price, surface.dataModel);
    const salePrice = resolveBinding(p.salePrice, surface.dataModel);
    const currency = String(resolveBinding(p.currency, surface.dataModel) ?? 'USD');
    const imageUrl = resolveBinding(p.imageUrl, surface.dataModel) as string | undefined;
    const productType = String(resolveBinding(p.productType, surface.dataModel) ?? 'simple');
    const stockStatus = String(resolveBinding(p.stockStatus, surface.dataModel) ?? 'instock');
    const priceRange = resolveBinding(p.priceRange, surface.dataModel) as string | undefined;

    const typeBadge: Record<string, string> = {
      simple: 'bg-blue-500/20 text-blue-300',
      variable: 'bg-purple-500/20 text-purple-300',
      grouped: 'bg-cyan-500/20 text-cyan-300',
      external: 'bg-amber-500/20 text-amber-300',
    };
    const stockBadge: Record<string, string> = {
      instock: 'bg-emerald-500/20 text-emerald-300',
      outofstock: 'bg-red-500/20 text-red-300',
      onbackorder: 'bg-amber-500/20 text-amber-300',
    };

    return (
      <div
        className="rounded-lg border border-zinc-700 bg-zinc-900/60 overflow-hidden cursor-pointer hover:border-zinc-600 transition-colors"
        onClick={() => emitAction(onAction, surface, component, 'select_product', { name })}
      >
        <div className="aspect-[4/3] bg-zinc-800 flex items-center justify-center">
          {imageUrl ? (
            <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl text-zinc-600">📦</span>
          )}
        </div>
        <div className="p-2.5 space-y-1.5">
          <div className="text-sm font-medium text-zinc-100 truncate">{name}</div>
          <div className="text-sm">
            {priceRange ? (
              <span className="text-zinc-200">{priceRange}</span>
            ) : salePrice != null ? (
              <span className="flex items-center gap-1.5">
                <span className="text-amber-400 font-medium">{formatMoney(salePrice, currency)}</span>
                <span className="text-zinc-500 line-through text-xs">{formatMoney(price, currency)}</span>
              </span>
            ) : (
              <span className="text-zinc-200">{formatMoney(price, currency)}</span>
            )}
          </div>
          <div className="flex gap-1">
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded', typeBadge[productType] ?? typeBadge.simple)}>
              {productType}
            </span>
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded', stockBadge[stockStatus] ?? stockBadge.instock)}>
              {stockStatus.replace('onbackorder', 'backorder')}
            </span>
          </div>
        </div>
      </div>
    );
  },

  ProductGrid: ({ component, surface, onAction }: ComponentProps) => {
    const items = toArray(resolveBinding(component.props?.items, surface.dataModel));
    const columns = Math.max(1, toNumber(resolveBinding(component.props?.columns, surface.dataModel), 2));

    return (
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {items.map((entry, i) => {
          const item = asRecord(entry);
          const name = String(item.name ?? `Product ${i + 1}`);
          const price = item.price ?? item.regular_price;
          const salePrice = item.sale_price ?? item.salePrice;
          const currency = String(item.currency ?? 'USD');
          const imageUrl = item.imageUrl ?? item.featured_image_url ?? item.image;
          const productType = String(item.product_type ?? item.type ?? 'simple');
          const stockStatus = String(item.stock_status ?? 'instock');

          return (
            <div
              key={`${name}-${i}`}
              className="rounded-lg border border-zinc-700 bg-zinc-900/60 overflow-hidden cursor-pointer hover:border-zinc-600 transition-colors"
              onClick={() => emitAction(onAction, surface, component, 'select_product', item)}
            >
              <div className="aspect-[4/3] bg-zinc-800 flex items-center justify-center">
                {imageUrl ? (
                  <img src={String(imageUrl)} alt={name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl text-zinc-600">📦</span>
                )}
              </div>
              <div className="p-2 space-y-1">
                <div className="text-sm font-medium text-zinc-100 truncate">{name}</div>
                <div className="text-sm">
                  {salePrice != null ? (
                    <span className="flex items-center gap-1">
                      <span className="text-amber-400">{formatMoney(salePrice, currency)}</span>
                      <span className="text-zinc-500 line-through text-xs">{formatMoney(price, currency)}</span>
                    </span>
                  ) : (
                    <span className="text-zinc-200">{formatMoney(price, currency)}</span>
                  )}
                </div>
                <div className="flex gap-1">
                  <span className="text-[10px] px-1 py-0.5 rounded bg-zinc-800 text-zinc-400">{productType}</span>
                  <span className={cn(
                    'text-[10px] px-1 py-0.5 rounded',
                    stockStatus === 'instock' ? 'bg-emerald-500/20 text-emerald-300'
                    : stockStatus === 'outofstock' ? 'bg-red-500/20 text-red-300'
                    : 'bg-amber-500/20 text-amber-300'
                  )}>
                    {stockStatus === 'onbackorder' ? 'backorder' : stockStatus.replace('out', 'out ')}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        {items.length === 0 && <div className="text-xs text-zinc-500 col-span-full text-center py-4">No products</div>}
      </div>
    );
  },

  OrderSummary: ({ component, surface }: ComponentProps) => {
    const items = toArray(resolveBinding(component.props?.items ?? component.props?.lineItems, surface.dataModel));
    const currency = String(resolveBinding(component.props?.currency, surface.dataModel) ?? 'USD');
    const subtotal = resolveBinding(component.props?.subtotal, surface.dataModel);
    const tax = resolveBinding(component.props?.tax, surface.dataModel);
    const shipping = resolveBinding(component.props?.shipping, surface.dataModel);
    const discount = resolveBinding(component.props?.discount, surface.dataModel);
    const total = resolveBinding(component.props?.total, surface.dataModel);

    return (
      <div className="rounded-lg border border-zinc-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-800/70 text-zinc-400">
            <tr>
              <th className="text-left font-medium px-3 py-2">Item</th>
              <th className="text-right font-medium px-3 py-2">Qty</th>
              <th className="text-right font-medium px-3 py-2">Price</th>
              <th className="text-right font-medium px-3 py-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((entry, i) => {
              const item = asRecord(entry);
              const name = String(item.name ?? item.product ?? `Item ${i + 1}`);
              const qty = toNumber(item.quantity ?? item.qty, 1);
              const price = item.unit_price ?? item.price ?? 0;
              const lineTotal = item.total ?? toNumber(price, 0) * qty;
              return (
                <tr key={`${name}-${i}`} className="border-t border-zinc-800">
                  <td className="px-3 py-2 text-zinc-200">{name}</td>
                  <td className="px-3 py-2 text-right text-zinc-400">{qty}</td>
                  <td className="px-3 py-2 text-right text-zinc-300">{formatMoney(price, currency)}</td>
                  <td className="px-3 py-2 text-right text-zinc-100">{formatMoney(lineTotal, currency)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t border-zinc-700 bg-zinc-800/30">
            {subtotal != null && (
              <tr>
                <td colSpan={3} className="px-3 py-1.5 text-right text-xs text-zinc-400">Subtotal</td>
                <td className="px-3 py-1.5 text-right text-sm text-zinc-200">{formatMoney(subtotal, currency)}</td>
              </tr>
            )}
            {tax != null && toNumber(tax, 0) > 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-1.5 text-right text-xs text-zinc-400">Tax</td>
                <td className="px-3 py-1.5 text-right text-sm text-zinc-200">{formatMoney(tax, currency)}</td>
              </tr>
            )}
            {shipping != null && toNumber(shipping, 0) > 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-1.5 text-right text-xs text-zinc-400">Shipping</td>
                <td className="px-3 py-1.5 text-right text-sm text-zinc-200">{formatMoney(shipping, currency)}</td>
              </tr>
            )}
            {discount != null && toNumber(discount, 0) > 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-1.5 text-right text-xs text-zinc-400">Discount</td>
                <td className="px-3 py-1.5 text-right text-sm text-red-300">-{formatMoney(discount, currency)}</td>
              </tr>
            )}
            {total != null && (
              <tr className="border-t border-zinc-700">
                <td colSpan={3} className="px-3 py-2 text-right text-sm font-medium text-zinc-300">Total</td>
                <td className="px-3 py-2 text-right text-sm font-semibold text-amber-300">{formatMoney(total, currency)}</td>
              </tr>
            )}
          </tfoot>
        </table>
        {items.length === 0 && <div className="text-xs text-zinc-500 text-center py-4">No line items</div>}
      </div>
    );
  },

  // ─── Project A2UI Components ──────────────────────────────────────────────

  ProjectProgress: ({ component, surface }: ComponentProps) => {
    const p = component.props ?? {};
    const name = String(resolveBinding(p.name, surface.dataModel) ?? 'Project');
    const status = String(resolveBinding(p.status, surface.dataModel) ?? 'active');
    const total = toNumber(resolveBinding(p.total, surface.dataModel), 0);
    const completed = toNumber(resolveBinding(p.completed, surface.dataModel), 0);
    const inProgress = toNumber(resolveBinding(p.inProgress, surface.dataModel), 0);
    const blocked = toNumber(resolveBinding(p.blocked, surface.dataModel), 0);
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    const statusColors: Record<string, string> = {
      planning: 'bg-zinc-500/20 text-zinc-300',
      active: 'bg-blue-500/20 text-blue-300',
      on_hold: 'bg-amber-500/20 text-amber-300',
      completed: 'bg-emerald-500/20 text-emerald-300',
      cancelled: 'bg-red-500/20 text-red-300',
    };

    return (
      <div className="rounded-lg border border-zinc-700 bg-zinc-900/60 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-100">{name}</span>
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', statusColors[status] ?? statusColors.active)}>
            {status.replace(/_/g, ' ')}
          </span>
        </div>
        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div className="h-full bg-amber-500 transition-all duration-300" style={{ width: `${percent}%` }} />
        </div>
        <div className="flex items-center gap-3 text-[10px] text-zinc-500">
          <span>{percent}% complete</span>
          {total > 0 && <span>{completed}/{total} missions</span>}
          {inProgress > 0 && <span className="text-blue-400">{inProgress} in progress</span>}
          {blocked > 0 && <span className="text-red-400">{blocked} blocked</span>}
        </div>
      </div>
    );
  },
};

function resolveRenderer(type: string): React.FC<ComponentProps> | undefined {
  if (ComponentCatalog[type]) return ComponentCatalog[type];
  const normalized = `${type.slice(0, 1).toUpperCase()}${type.slice(1)}`;
  return ComponentCatalog[normalized];
}

function RenderComponent({
  componentId,
  surface,
  onAction,
}: {
  componentId: string;
  surface: A2UISurface;
  onAction?: (event: A2UIActionEvent) => void;
}): ReactNode {
  const component = surface.components.get(componentId);
  if (!component) return null;

  const Renderer = resolveRenderer(component.type);
  if (!Renderer) {
    console.warn(`[A2UI] Unknown component type: ${component.type}`);
    return (
      <div className="p-2 bg-red-500/10 text-red-400 text-xs rounded">
        Unknown: {component.type}
      </div>
    );
  }

  const childIds = component.children || [];
  const renderedChildren: ReactNode = childIds.length > 0
    ? childIds.map((childId) => (
        <RenderComponent key={childId} componentId={childId} surface={surface} onAction={onAction} />
      ))
    : null;

  return (
    <Renderer component={component} surface={surface} onAction={onAction}>
      {renderedChildren}
    </Renderer>
  );
}

export function A2UIRenderer({ surface, onAction }: A2UIRendererProps) {
  if (!surface.rootId) {
    return (
      <div className="text-center text-muted-foreground py-4">
        <p className="text-sm">Waiting for render signal...</p>
      </div>
    );
  }

  return (
    <div className="a2ui-surface space-y-2">
      <RenderComponent componentId={surface.rootId} surface={surface} onAction={onAction} />
    </div>
  );
}
