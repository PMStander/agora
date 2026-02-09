import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SlashCommand {
  id: string;
  trigger: string; // e.g., "/summarize"
  description: string;
  promptTemplate: string; // The prompt to execute when triggered
  createdAt: number;
  updatedAt: number;
}

interface SlashCommandsState {
  commands: SlashCommand[];
  
  // Actions
  addCommand: (command: Omit<SlashCommand, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateCommand: (id: string, updates: Partial<Omit<SlashCommand, 'id' | 'createdAt'>>) => void;
  deleteCommand: (id: string) => void;
  getCommandByTrigger: (trigger: string) => SlashCommand | undefined;
}

export const useSlashCommandsStore = create<SlashCommandsState>()(
  persist(
    (set, get) => ({
      commands: [
        // Default commands
        {
          id: 'default-summarize',
          trigger: '/summarize',
          description: 'Summarize the selected text or conversation',
          promptTemplate: 'Please provide a concise summary of the following:\n\n{{content}}',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'default-translate',
          trigger: '/translate',
          description: 'Translate text to another language',
          promptTemplate: 'Please translate the following to {{language}}:\n\n{{content}}',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'default-explain',
          trigger: '/explain',
          description: 'Explain a concept in simple terms',
          promptTemplate: 'Please explain this concept in simple, easy-to-understand terms:\n\n{{content}}',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      
      addCommand: (command) => {
        const newCommand: SlashCommand = {
          ...command,
          id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((state) => ({
          commands: [...state.commands, newCommand],
        }));
      },
      
      updateCommand: (id, updates) => {
        set((state) => ({
          commands: state.commands.map((cmd) =>
            cmd.id === id
              ? { ...cmd, ...updates, updatedAt: Date.now() }
              : cmd
          ),
        }));
      },
      
      deleteCommand: (id) => {
        set((state) => ({
          commands: state.commands.filter((cmd) => cmd.id !== id),
        }));
      },
      
      getCommandByTrigger: (trigger) => {
        return get().commands.find((cmd) => cmd.trigger === trigger);
      },
    }),
    {
      name: 'agora-slash-commands',
    }
  )
);
