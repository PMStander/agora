import { create } from 'zustand';

export interface Agent {
  id: string;
  name: string;
  persona: string;
  role: string;
  avatar: string;
  teamId: string;
  emoji: string;
}

export interface Team {
  id: string;
  name: string;
  theme: string;
  emoji: string;
  agents: Agent[];
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  agentId?: string;
}

interface AgentState {
  // Teams and Agents
  teams: Team[];
  activeAgentId: string;
  
  // Messages per agent
  messagesByAgent: Record<string, Message[]>;
  
  // Connection state
  isConnected: boolean;
  isLoading: boolean;
  
  // Actions
  setActiveAgent: (agentId: string) => void;
  addMessage: (agentId: string, message: Omit<Message, 'id' | 'timestamp'>) => void;
  updateLastMessage: (agentId: string, content: string) => void;
  setConnected: (connected: boolean) => void;
  setLoading: (loading: boolean) => void;
}

// Our agent roster - 'main' maps to the default OpenClaw agent
// Other agents would need to be configured in OpenClaw's multi-agent setup
const initialTeams: Team[] = [
  {
    id: 'orchestrator',
    name: 'Orchestrator',
    theme: 'Stoic Emperor',
    emoji: '🏛️',
    agents: [
      {
        id: 'main', // This maps to OpenClaw's default agent
        name: 'Marcus Aurelius',
        persona: 'Stoic Emperor',
        role: 'Main Orchestrator',
        avatar: '/avatars/marcus-aurelius.png',
        teamId: 'orchestrator',
        emoji: '🏛️',
      },
    ],
  },
  {
    id: 'personal',
    name: 'Team Personal',
    theme: 'Philosophers',
    emoji: '📚',
    agents: [
      {
        id: 'hippocrates',
        name: 'Hippocrates',
        persona: 'Father of Medicine',
        role: 'Fitness & Health',
        avatar: '/avatars/hippocrates.png',
        teamId: 'personal',
        emoji: '⚕️',
      },
      {
        id: 'confucius',
        name: 'Confucius',
        persona: 'Sage',
        role: 'Family & Relationships',
        avatar: '/avatars/confucius.png',
        teamId: 'personal',
        emoji: '🧘',
      },
      {
        id: 'seneca',
        name: 'Seneca',
        persona: 'Wealthy Stoic',
        role: 'Personal Finance',
        avatar: '/avatars/seneca.png',
        teamId: 'personal',
        emoji: '💰',
      },
      {
        id: 'archimedes',
        name: 'Archimedes',
        persona: 'Inventor',
        role: 'Tech Enthusiast',
        avatar: '/avatars/archimedes.png',
        teamId: 'personal',
        emoji: '⚙️',
      },
    ],
  },
  {
    id: 'business',
    name: 'Partners in Biz',
    theme: 'Warriors',
    emoji: '⚔️',
    agents: [
      {
        id: 'leonidas',
        name: 'Leonidas',
        persona: 'Spartan King',
        role: 'CEO',
        avatar: '/avatars/leonidas.png',
        teamId: 'business',
        emoji: '🛡️',
      },
      {
        id: 'odysseus',
        name: 'Odysseus',
        persona: 'Cunning Strategist',
        role: 'CFO',
        avatar: '/avatars/odysseus.png',
        teamId: 'business',
        emoji: '🎯',
      },
      {
        id: 'spartacus',
        name: 'Spartacus',
        persona: 'Champion of People',
        role: 'HR',
        avatar: '/avatars/spartacus.png',
        teamId: 'business',
        emoji: '✊',
      },
      {
        id: 'achilles',
        name: 'Achilles',
        persona: 'Greatest Warrior',
        role: 'CTO',
        avatar: '/avatars/achilles.png',
        teamId: 'business',
        emoji: '⚡',
      },
      {
        id: 'alexander',
        name: 'Alexander',
        persona: 'The Conqueror',
        role: 'Marketing Head',
        avatar: '/avatars/alexander.png',
        teamId: 'business',
        emoji: '🌍',
      },
    ],
  },
];

export const useAgentStore = create<AgentState>((set) => ({
  teams: initialTeams,
  activeAgentId: 'main',
  messagesByAgent: {},
  isConnected: false,
  isLoading: false,

  setActiveAgent: (agentId) => set({ activeAgentId: agentId }),

  addMessage: (agentId, message) =>
    set((state) => ({
      messagesByAgent: {
        ...state.messagesByAgent,
        [agentId]: [
          ...(state.messagesByAgent[agentId] || []),
          {
            ...message,
            id: crypto.randomUUID(),
            timestamp: new Date(),
          },
        ],
      },
    })),

  updateLastMessage: (agentId, content) =>
    set((state) => {
      const messages = state.messagesByAgent[agentId] || [];
      if (messages.length === 0) return state;
      
      const lastMessage = messages[messages.length - 1];
      return {
        messagesByAgent: {
          ...state.messagesByAgent,
          [agentId]: [
            ...messages.slice(0, -1),
            { ...lastMessage, content },
          ],
        },
      };
    }),

  setConnected: (connected) => set({ isConnected: connected }),
  setLoading: (loading) => set({ isLoading: loading }),
}));

// Selector helpers
export const useActiveAgent = () => {
  const { teams, activeAgentId } = useAgentStore();
  for (const team of teams) {
    const agent = team.agents.find((a) => a.id === activeAgentId);
    if (agent) return agent;
  }
  return teams[0]?.agents[0];
};

export const useActiveMessages = () => {
  const { messagesByAgent, activeAgentId } = useAgentStore();
  return messagesByAgent[activeAgentId] || [];
};
