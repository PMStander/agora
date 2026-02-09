# Settings Components

## Overview

The Settings module provides a comprehensive settings experience for Agora, including:
- General settings (appearance, notifications, behavior, etc.)
- Slash commands management
- Extensible architecture for future settings categories

## Architecture

### Components

1. **SettingsPage** - Main settings component with navigation sidebar
   - Full-page modal with tabbed navigation
   - Supports multiple settings categories
   - Clean, extensible design for future additions

2. **GeneralSettings** - General application settings
   - Theme and appearance
   - Notifications
   - Behavior settings
   - Keyboard shortcuts
   - Voice settings (coming soon)
   - PayPal integration
   - Auto-updates

3. **SlashCommandsSettings** - Custom slash commands management
   - Create, edit, and delete custom commands
   - Each command has a trigger, description, and prompt template
   - Default commands provided (summarize, translate, explain)
   - Support for dynamic placeholders in prompts

4. **SettingsPanel** (Legacy) - Original modal-based settings
   - Kept for backward compatibility
   - Will be deprecated in favor of SettingsPage

## Slash Commands

### What are Slash Commands?

Slash commands allow users to define custom shortcuts that trigger predefined prompts or actions. For example:
- `/summarize` - Summarize selected text
- `/translate` - Translate text to another language
- `/explain` - Explain a concept in simple terms

### Features

- **Custom Triggers**: Define any trigger starting with `/`
- **Prompt Templates**: Use placeholders like `{{content}}` for dynamic content
- **CRUD Operations**: Full create, read, update, delete support
- **Persistent Storage**: Commands stored in localStorage via Zustand
- **Default Commands**: Ships with useful default commands
- **Validation**: Prevents duplicate triggers and invalid formats

### Command Structure

```typescript
interface SlashCommand {
  id: string;                // Unique identifier
  trigger: string;           // e.g., "/summarize"
  description: string;       // Brief description
  promptTemplate: string;    // Prompt to execute
  createdAt: number;         // Timestamp
  updatedAt: number;         // Timestamp
}
```

### Prompt Template Placeholders

Available placeholders for use in prompt templates:
- `{{content}}` - Selected text or context
- `{{language}}` - Target language (for translate commands)
- Custom placeholders can be added as needed

### Usage Example

1. Open Settings (⌘,)
2. Navigate to "Slash Commands"
3. Click "New Command"
4. Fill in:
   - **Trigger**: `/code-review`
   - **Description**: Review code for best practices
   - **Prompt Template**: 
     ```
     Please review the following code for:
     - Best practices
     - Potential bugs
     - Performance issues
     - Security concerns
     
     {{content}}
     ```
5. Click "Create"

Now you can use `/code-review` in chat to trigger this prompt!

## Store Integration

### Settings Store (`stores/settings.ts`)

Manages general application settings:
- Theme preferences
- Notification settings
- Behavior options
- Voice settings

### Slash Commands Store (`stores/slashCommands.ts`)

Manages custom slash commands:
- CRUD operations for commands
- Persistent localStorage via Zustand
- Default commands initialization

```typescript
import { useSlashCommandsStore } from '../stores/slashCommands';

function MyComponent() {
  const { commands, addCommand, getCommandByTrigger } = useSlashCommandsStore();
  
  // Get a command by trigger
  const summarizeCmd = getCommandByTrigger('/summarize');
  
  // Add a new command
  addCommand({
    trigger: '/custom',
    description: 'My custom command',
    promptTemplate: 'Do something with: {{content}}'
  });
}
```

## Migration Guide

### From SettingsPanel to SettingsPage

```tsx
// Old way (SettingsPanel)
import { SettingsPanel } from './components/settings/SettingsPanel';

<SettingsPanel isOpen={open} onClose={() => setOpen(false)} />

// New way (SettingsPage)
import { SettingsPage } from './components/settings';

<SettingsPage 
  isOpen={open} 
  onClose={() => setOpen(false)}
  initialTab="general" // or "slash-commands"
/>
```

## Future Enhancements

Planned settings categories:
- **Integrations** - Third-party service connections
- **Appearance** - Advanced theme customization
- **Privacy** - Data and privacy controls
- **Advanced** - Developer settings and debug tools
- **Keyboard** - Custom keyboard shortcut mapping
- **Extensions** - Plugin/extension management

## Development

### Adding a New Settings Category

1. Create a new component: `src/components/settings/MyNewSettings.tsx`
2. Add the tab to `SettingsPage.tsx`:
   ```tsx
   <TabButton
     icon="🔧"
     label="My Category"
     isActive={activeTab === 'my-category'}
     onClick={() => setActiveTab('my-category')}
   />
   ```
3. Add the content section:
   ```tsx
   {activeTab === 'my-category' && <MyNewSettings />}
   ```
4. Export from `index.ts`
5. Update `SettingsTab` type if needed

### Testing Slash Commands

```typescript
// In browser console or dev tools
const store = useSlashCommandsStore.getState();

// List all commands
console.log(store.commands);

// Add a test command
store.addCommand({
  trigger: '/test',
  description: 'Test command',
  promptTemplate: 'This is a test: {{content}}'
});

// Get command by trigger
const cmd = store.getCommandByTrigger('/test');
console.log(cmd);

// Delete command
store.deleteCommand(cmd.id);
```

## Styling

The settings components use Tailwind CSS with the Agora design system:
- Accent colors: gold, cyan, purple, green
- Dark/light theme support
- Consistent spacing and typography
- Responsive design

## Accessibility

- Keyboard navigation support
- ARIA labels for screen readers
- Focus management
- Proper semantic HTML
- Color contrast compliance

## License

Part of the Agora project. See main project LICENSE for details.
