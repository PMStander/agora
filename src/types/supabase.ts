export type TaskStatus = 'inbox' | 'assigned' | 'in_progress' | 'review' | 'done' | 'blocked';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type AgentStatus = 'idle' | 'active' | 'blocked';
export type TeamType = 'personal' | 'business';

export interface Agent {
  id: string;
  name: string;
  role: string;
  team: TeamType;
  session_key: string;
  status: AgentStatus;
  current_task_id: string | null;
  avatar_url: string | null;
  domains: string[];
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  team: TeamType | null;
  domains: string[];
  created_by: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  assignees?: Agent[];
  comment_count?: number;
}

export interface TaskAssignee {
  task_id: string;
  agent_id: string;
  assigned_at: string;
}

export interface Comment {
  id: string;
  task_id: string;
  agent_id: string | null;
  from_user: boolean;
  content: string;
  mentions: string[];
  attachments: string[];
  created_at: string;
  // Joined data
  agent?: Agent;
}

export interface Activity {
  id: string;
  type: string;
  agent_id: string | null;
  task_id: string | null;
  message: string;
  metadata: Record<string, any> | null;
  created_at: string;
  // Joined data
  agent?: Agent;
  task?: Task;
}

export interface Document {
  id: string;
  title: string;
  content: string | null;
  type: 'deliverable' | 'research' | 'protocol' | 'note';
  task_id: string | null;
  agent_id: string | null;
  file_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  agent_id: string;
  task_id: string | null;
  content: string;
  type: 'mention' | 'assignment' | 'status_change';
  delivered: boolean;
  delivered_at: string | null;
  created_at: string;
}

// Database schema for Supabase client
export interface Database {
  public: {
    Tables: {
      agents: {
        Row: Agent;
        Insert: Omit<Agent, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Agent, 'id' | 'created_at'>>;
      };
      tasks: {
        Row: Task;
        Insert: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'assignees' | 'comment_count'>;
        Update: Partial<Omit<Task, 'id' | 'created_at' | 'assignees' | 'comment_count'>>;
      };
      task_assignees: {
        Row: TaskAssignee;
        Insert: Omit<TaskAssignee, 'assigned_at'>;
        Update: never;
      };
      comments: {
        Row: Comment;
        Insert: Omit<Comment, 'id' | 'created_at' | 'agent'>;
        Update: Partial<Omit<Comment, 'id' | 'created_at' | 'agent'>>;
      };
      activities: {
        Row: Activity;
        Insert: Omit<Activity, 'id' | 'created_at' | 'agent' | 'task'>;
        Update: never;
      };
      documents: {
        Row: Document;
        Insert: Omit<Document, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Document, 'id' | 'created_at'>>;
      };
      notifications: {
        Row: Notification;
        Insert: Omit<Notification, 'id' | 'created_at'>;
        Update: Partial<Omit<Notification, 'id' | 'created_at'>>;
      };
    };
  };
}

// Domain to agent mapping for auto-routing
export const DOMAIN_TO_AGENTS: Record<string, string[]> = {
  // Personal domains
  'orchestration': ['marcus'],
  'life-coaching': ['marcus'],
  'decision-making': ['marcus'],
  'health': ['hippocrates'],
  'fitness': ['hippocrates'],
  'wellness': ['hippocrates'],
  'family': ['confucius'],
  'relationships': ['confucius'],
  'wisdom': ['confucius'],
  'personal-finance': ['seneca'],
  'investing': ['seneca'],
  'budgeting': ['seneca'],
  'tech': ['archimedes'],
  'gadgets': ['archimedes'],
  'home-automation': ['archimedes'],
  
  // Business domains
  'strategy': ['leonidas'],
  'leadership': ['leonidas'],
  'business-decisions': ['leonidas'],
  'business-finance': ['odysseus'],
  'accounting': ['odysseus'],
  'forecasting': ['odysseus'],
  'hiring': ['spartacus'],
  'hr': ['spartacus'],
  'team-management': ['spartacus'],
  'code': ['achilles'],
  'architecture': ['achilles'],
  'devops': ['achilles'],
  'engineering': ['achilles'],
  'marketing': ['alexander'],
  'seo': ['alexander'],
  'content': ['alexander'],
  'social-media': ['alexander'],
};

// Default routes when no domain matches
export const DEFAULT_ROUTES: Record<TeamType, string> = {
  'personal': 'marcus',
  'business': 'leonidas',
};

// All available domains for the picker
export const ALL_DOMAINS = Object.keys(DOMAIN_TO_AGENTS);

// Task status columns for kanban
export const TASK_COLUMNS: { id: TaskStatus; title: string; color: string }[] = [
  { id: 'inbox', title: 'Inbox', color: 'gray' },
  { id: 'assigned', title: 'Assigned', color: 'blue' },
  { id: 'in_progress', title: 'In Progress', color: 'yellow' },
  { id: 'review', title: 'Review', color: 'purple' },
  { id: 'done', title: 'Done', color: 'green' },
];
