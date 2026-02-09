# Slash Commands Integration Guide

This guide shows how to integrate slash commands into the chat interface.

## Step 1: Update App.tsx to use SettingsPage

Replace `SettingsPanel` with `SettingsPage` in your App.tsx:

```tsx
// Before
import { SettingsPanel } from './components/settings/SettingsPanel';

// After
import { SettingsPage } from './components/settings';

// In your component:
<SettingsPage
  isOpen={settingsOpen}
  onClose={() => setSettingsOpen(false)}
/>
```

## Step 2: Integrate Slash Commands in Chat Input

Update your chat input component to detect and handle slash commands:

```tsx
import { useState, useRef, useEffect } from 'react';
import { useSlashCommandsStore } from '../../stores/slashCommands';

export function ChatInput() {
  const [input, setInput] = useState('');
  const [showCommandSuggestions, setShowCommandSuggestions] = useState(false);
  const [filteredCommands, setFilteredCommands] = useState([]);
  const { commands, getCommandByTrigger } = useSlashCommandsStore();

  // Detect slash command typing
  useEffect(() => {
    if (input.startsWith('/')) {
      const trigger = input.split(' ')[0];
      const matches = commands.filter(cmd => 
        cmd.trigger.startsWith(trigger)
      );
      setFilteredCommands(matches);
      setShowCommandSuggestions(matches.length > 0);
    } else {
      setShowCommandSuggestions(false);
    }
  }, [input, commands]);

  const handleSubmit = () => {
    // Check if input starts with a slash command
    if (input.startsWith('/')) {
      const parts = input.split(' ');
      const trigger = parts[0];
      const command = getCommandByTrigger(trigger);
      
      if (command) {
        // Extract content (everything after the trigger)
        const content = parts.slice(1).join(' ');
        
        // Replace placeholders in the prompt template
        let prompt = command.promptTemplate;
        prompt = prompt.replace(/\{\{content\}\}/g, content);
        
        // Send the processed prompt instead of the raw command
        sendMessage(prompt);
        setInput('');
        return;
      }
    }
    
    // Regular message
    sendMessage(input);
    setInput('');
  };

  return (
    <div className="relative">
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        placeholder="Type a message or /command..."
      />
      
      {/* Command suggestions dropdown */}
      {showCommandSuggestions && (
        <div className="absolute bottom-full left-0 right-0 bg-surface border border-border rounded-lg shadow-xl mb-2 overflow-hidden">
          {filteredCommands.map(cmd => (
            <button
              key={cmd.id}
              onClick={() => setInput(cmd.trigger + ' ')}
              className="w-full px-4 py-2 text-left hover:bg-muted transition-colors"
            >
              <div className="font-mono text-accent">{cmd.trigger}</div>
              <div className="text-sm text-muted-foreground">{cmd.description}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

## Step 3: Add Command Palette (Optional)

Create a command palette for quick access to slash commands:

```tsx
import { useState, useEffect } from 'react';
import { useSlashCommandsStore } from '../../stores/slashCommands';

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { commands } = useSlashCommandsStore();

  // Open with Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!isOpen) return null;

  const filtered = commands.filter(cmd =>
    cmd.trigger.includes(search) || 
    cmd.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/50">
      <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-2xl">
        <input
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search commands..."
          className="w-full px-6 py-4 bg-transparent border-b border-border focus:outline-none"
        />
        <div className="max-h-96 overflow-y-auto">
          {filtered.map(cmd => (
            <button
              key={cmd.id}
              onClick={() => {
                // Execute command
                setIsOpen(false);
              }}
              className="w-full px-6 py-3 text-left hover:bg-muted transition-colors border-b border-border/50 last:border-0"
            >
              <div className="font-mono text-accent font-medium">{cmd.trigger}</div>
              <div className="text-sm text-muted-foreground mt-1">{cmd.description}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

## Step 4: Add Settings Button/Link

Make sure users can access the settings:

```tsx
// In your sidebar or header
<button
  onClick={() => setSettingsOpen(true)}
  className="px-4 py-2 rounded hover:bg-muted"
  title="Settings (⌘,)"
>
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
</button>
```

## Step 5: Context-Aware Commands

For advanced usage, make commands context-aware:

```tsx
export function ChatInput() {
  const [selectedText, setSelectedText] = useState('');
  
  // Track text selection
  useEffect(() => {
    const handleSelection = () => {
      const selection = window.getSelection();
      setSelectedText(selection?.toString() || '');
    };
    
    document.addEventListener('selectionchange', handleSelection);
    return () => document.removeEventListener('selectionchange', handleSelection);
  }, []);

  const handleCommand = (trigger: string) => {
    const command = getCommandByTrigger(trigger);
    if (!command) return;
    
    let prompt = command.promptTemplate;
    
    // Use selected text if available, otherwise use typed content
    const content = selectedText || input.split(' ').slice(1).join(' ');
    prompt = prompt.replace(/\{\{content\}\}/g, content);
    
    sendMessage(prompt);
  };
}
```

## Example: Multi-Language Translation

```tsx
// In your command template:
// "Please translate the following to {{language}}:\n\n{{content}}"

const handleTranslateCommand = () => {
  const parts = input.split(' ');
  // input: "/translate spanish Hello world"
  const language = parts[1]; // "spanish"
  const content = parts.slice(2).join(' '); // "Hello world"
  
  let prompt = command.promptTemplate;
  prompt = prompt.replace(/\{\{language\}\}/g, language);
  prompt = prompt.replace(/\{\{content\}\}/g, content);
  
  sendMessage(prompt);
};
```

## Best Practices

1. **Validate input**: Always check if a command exists before processing
2. **Provide feedback**: Show autocomplete suggestions as users type
3. **Handle errors**: Gracefully handle missing placeholders or invalid syntax
4. **Document commands**: Make it easy for users to discover available commands
5. **Keyboard shortcuts**: Support quick access (like ⌘K for command palette)
6. **Context awareness**: Use selected text when available
7. **Undo support**: Allow users to cancel/undo command execution
8. **Loading states**: Show when a command is processing

## Testing

```typescript
// Test command execution
const testCommand = {
  trigger: '/test',
  description: 'Test command',
  promptTemplate: 'Process this: {{content}}'
};

// Add to store
useSlashCommandsStore.getState().addCommand(testCommand);

// Execute
const result = processCommand('/test hello world');
// Expected: "Process this: hello world"
```

## Troubleshooting

**Commands not appearing?**
- Check that the store is properly initialized
- Verify localStorage contains 'agora-slash-commands'
- Clear storage and reload to reset to defaults

**Placeholders not replaced?**
- Ensure exact match: `{{content}}` (with double braces)
- Check for typos in placeholder names
- Verify content is being extracted correctly

**Performance issues?**
- Debounce command suggestions
- Limit number of visible suggestions
- Use React.memo for command list items

## Next Steps

1. Add command history tracking
2. Implement command arguments/parameters
3. Support command chaining (e.g., `/translate spanish | /summarize`)
4. Add command templates/snippets
5. Export/import command sets
6. Add command analytics/usage tracking
