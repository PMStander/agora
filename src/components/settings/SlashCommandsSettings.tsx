import { useState } from 'react';
import { useSlashCommandsStore, type SlashCommand } from '../../stores/slashCommands';

export function SlashCommandsSettings() {
  const { commands, addCommand, updateCommand, deleteCommand } = useSlashCommandsStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<Partial<SlashCommand>>({
    trigger: '',
    description: '',
    promptTemplate: '',
  });

  const handleEdit = (command: SlashCommand) => {
    setEditingId(command.id);
    setFormData({
      trigger: command.trigger,
      description: command.description,
      promptTemplate: command.promptTemplate,
    });
    setIsCreating(false);
  };

  const handleCreate = () => {
    setIsCreating(true);
    setEditingId(null);
    setFormData({
      trigger: '/',
      description: '',
      promptTemplate: '',
    });
  };

  const handleSave = () => {
    if (!formData.trigger || !formData.description || !formData.promptTemplate) {
      alert('Please fill in all fields');
      return;
    }

    // Validate trigger format
    if (!formData.trigger.startsWith('/')) {
      alert('Trigger must start with /');
      return;
    }

    // Check for duplicate triggers (excluding current command when editing)
    const duplicate = commands.find(
      (cmd) => cmd.trigger === formData.trigger && cmd.id !== editingId
    );
    if (duplicate) {
      alert('A command with this trigger already exists');
      return;
    }

    if (isCreating) {
      addCommand({
        trigger: formData.trigger,
        description: formData.description,
        promptTemplate: formData.promptTemplate,
      });
    } else if (editingId) {
      updateCommand(editingId, {
        trigger: formData.trigger,
        description: formData.description,
        promptTemplate: formData.promptTemplate,
      });
    }

    handleCancel();
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingId(null);
    setFormData({
      trigger: '',
      description: '',
      promptTemplate: '',
    });
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this command?')) {
      deleteCommand(id);
      if (editingId === id) {
        handleCancel();
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-muted-foreground mb-4">
          Create custom slash commands to quickly trigger predefined prompts or actions.
          Use <code className="bg-muted px-1.5 py-0.5 rounded text-sm">{'{{content}}'}</code> as a placeholder
          for selected text or context.
        </p>
        <button
          onClick={handleCreate}
          disabled={isCreating || editingId !== null}
          className="px-4 py-2 bg-accent text-background rounded-lg hover:opacity-90 transition-opacity font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          + New Command
        </button>
      </div>

      {/* Create/Edit Form */}
      {(isCreating || editingId) && (
        <div className="bg-muted/30 border border-border rounded-lg p-6 space-y-4">
          <h4 className="text-lg font-medium text-foreground">
            {isCreating ? 'Create New Command' : 'Edit Command'}
          </h4>

          {/* Trigger */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Trigger
            </label>
            <input
              type="text"
              value={formData.trigger}
              onChange={(e) => setFormData({ ...formData, trigger: e.target.value })}
              placeholder="/mycommand"
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Must start with / (e.g., /summarize, /translate)
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Description
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of what this command does"
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          {/* Prompt Template */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Prompt Template
            </label>
            <textarea
              value={formData.promptTemplate}
              onChange={(e) => setFormData({ ...formData, promptTemplate: e.target.value })}
              placeholder="The prompt to execute when this command is triggered. Use {{content}} for dynamic content."
              rows={6}
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-accent font-mono text-sm resize-y"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Available placeholders: <code className="bg-muted px-1 rounded">{'{{content}}'}</code>,{' '}
              <code className="bg-muted px-1 rounded">{'{{language}}'}</code> (for translate), etc.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-accent text-background rounded-lg hover:opacity-90 transition-opacity font-medium"
            >
              {isCreating ? 'Create' : 'Save Changes'}
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Commands List */}
      <div className="space-y-3">
        <h4 className="text-lg font-medium text-foreground">Your Commands</h4>
        {commands.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No custom commands yet.</p>
            <p className="text-sm mt-1">Click "New Command" to create your first one!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {commands.map((command) => (
              <CommandCard
                key={command.id}
                command={command}
                isEditing={editingId === command.id}
                onEdit={() => handleEdit(command)}
                onDelete={() => handleDelete(command.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface CommandCardProps {
  command: SlashCommand;
  isEditing: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

function CommandCard({ command, isEditing, onEdit, onDelete }: CommandCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isDefault = command.id.startsWith('default-');

  return (
    <div
      className={`bg-surface border rounded-lg transition-all ${
        isEditing ? 'border-accent ring-2 ring-accent/20' : 'border-border hover:border-border/80'
      }`}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <code className="font-mono font-semibold text-accent text-base">
                {command.trigger}
              </code>
              {isDefault && (
                <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
                  Default
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{command.description}</p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 rounded hover:bg-muted transition-colors"
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              <svg
                className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <button
              onClick={onEdit}
              className="p-1.5 rounded hover:bg-muted transition-colors"
              aria-label="Edit command"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </button>
            {!isDefault && (
              <button
                onClick={onDelete}
                className="p-1.5 rounded hover:bg-red-500/10 text-red-500 transition-colors"
                aria-label="Delete command"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-border">
            <h5 className="text-sm font-medium text-foreground mb-2">Prompt Template:</h5>
            <pre className="bg-muted/50 rounded-lg p-3 text-sm text-foreground overflow-x-auto whitespace-pre-wrap break-words font-mono">
              {command.promptTemplate}
            </pre>
            <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
              <span>Created: {new Date(command.createdAt).toLocaleDateString()}</span>
              {command.updatedAt !== command.createdAt && (
                <span>Updated: {new Date(command.updatedAt).toLocaleDateString()}</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
