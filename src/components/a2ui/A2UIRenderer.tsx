import type { ReactNode } from 'react';
import { type A2UISurface, type A2UIComponent } from '../../hooks/useA2UI';
import { cn } from '../../lib/utils';

interface A2UIRendererProps {
  surface: A2UISurface;
}

interface ComponentProps {
  component: A2UIComponent;
  surface: A2UISurface;
  children?: ReactNode;
}

// Component catalog - maps A2UI types to React components
const ComponentCatalog: Record<string, React.FC<ComponentProps>> = {
  // Layout components
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

  // Text components
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
    const level = (component.props?.level as number) || 2;
    const className = cn('font-bold', level === 1 ? 'text-2xl' : level === 2 ? 'text-xl' : 'text-lg');
    
    if (level === 1) return <h1 className={className}>{String(content ?? '')}</h1>;
    if (level === 2) return <h2 className={className}>{String(content ?? '')}</h2>;
    if (level === 3) return <h3 className={className}>{String(content ?? '')}</h3>;
    return <h4 className={className}>{String(content ?? '')}</h4>;
  },

  // Data display
  Stat: ({ component, surface }: ComponentProps) => {
    const value = resolveBinding(component.props?.value, surface.dataModel);
    const label = component.props?.label as string | undefined;
    return (
      <div className="p-3 rounded-lg bg-primary/10 text-center">
        <div className="text-2xl font-bold text-primary">{String(value ?? '')}</div>
        {label ? <div className="text-xs text-muted-foreground">{label}</div> : null}
      </div>
    );
  },

  // List
  List: ({ component, surface }: ComponentProps) => {
    const items = resolveBinding(component.props?.items, surface.dataModel) as unknown[];
    return (
      <ul className="space-y-1">
        {items?.map((item, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            {String(item)}
          </li>
        ))}
      </ul>
    );
  },

  // Interactive
  Button: ({ component }: ComponentProps) => (
    <button
      className={cn(
        'px-4 py-2 rounded-lg font-medium transition-colors',
        component.props?.variant === 'primary' 
          ? 'bg-primary text-primary-foreground hover:bg-primary/90'
          : 'bg-muted hover:bg-muted/80'
      )}
      onClick={() => {
        // TODO: Send action back to agent
        console.log('[A2UI] Button clicked:', component.props?.action);
      }}
    >
      {String(component.props?.label ?? '')}
    </button>
  ),

  // Progress
  Progress: ({ component, surface }: ComponentProps) => {
    const value = resolveBinding(component.props?.value, surface.dataModel) as number;
    const max = (component.props?.max as number) || 100;
    const percent = Math.min(100, (value / max) * 100);
    const label = component.props?.label as string | undefined;
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

  // Image
  Image: ({ component }: ComponentProps) => (
    <img
      src={component.props?.src as string}
      alt={(component.props?.alt as string) || ''}
      className={cn('rounded-lg max-w-full', component.props?.className as string)}
    />
  ),

  // Divider
  Divider: () => <hr className="border-border my-2" />,

  // Spacer
  Spacer: ({ component }: ComponentProps) => (
    <div style={{ height: (component.props?.size as number) || 16 }} />
  ),
};

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
      return value; // Return original if path not found
    }
  }
  
  return result;
}

// Recursive component renderer
function RenderComponent({ 
  componentId, 
  surface 
}: { 
  componentId: string; 
  surface: A2UISurface;
}): ReactNode {
  const component = surface.components.get(componentId);
  if (!component) return null;

  const Renderer = ComponentCatalog[component.type];
  if (!Renderer) {
    console.warn(`[A2UI] Unknown component type: ${component.type}`);
    return (
      <div className="p-2 bg-red-500/10 text-red-400 text-xs rounded">
        Unknown: {component.type}
      </div>
    );
  }

  // Render children
  const childIds = component.children || [];
  const renderedChildren: ReactNode = childIds.length > 0 
    ? childIds.map(childId => (
        <RenderComponent key={childId} componentId={childId} surface={surface} />
      ))
    : null;

  return (
    <Renderer component={component} surface={surface}>
      {renderedChildren}
    </Renderer>
  );
}

export function A2UIRenderer({ surface }: A2UIRendererProps) {
  if (!surface.rootId) {
    return (
      <div className="text-center text-muted-foreground py-4">
        <p className="text-sm">Waiting for render signal...</p>
      </div>
    );
  }

  return (
    <div className="a2ui-surface space-y-2">
      <RenderComponent componentId={surface.rootId} surface={surface} />
    </div>
  );
}
