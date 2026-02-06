import { useEffect, useCallback } from 'react';
import { supabase, subscribeToTasks, subscribeToActivities, logActivity, isSupabaseConfigured } from '../lib/supabase';
import { useMissionControlStore } from '../stores/missionControl';
import type { Task, Agent, TaskStatus, TaskPriority, TeamType } from '../types/supabase';
import { DOMAIN_TO_AGENTS, DEFAULT_ROUTES } from '../types/supabase';

// Auto-route task based on domains
function autoRouteTask(task: Partial<Task>, agents: Agent[]): string[] {
  const matchedAgentKeys = new Set<string>();
  
  for (const domain of task.domains || []) {
    const agentKeys = DOMAIN_TO_AGENTS[domain] || [];
    agentKeys.forEach((key) => matchedAgentKeys.add(key));
  }
  
  // If no matches, use default for team
  if (matchedAgentKeys.size === 0) {
    const defaultKey = task.team === 'business' 
      ? DEFAULT_ROUTES.business 
      : DEFAULT_ROUTES.personal;
    matchedAgentKeys.add(defaultKey);
  }
  
  // Convert session keys to agent IDs
  const agentIds: string[] = [];
  for (const key of matchedAgentKeys) {
    const agent = agents.find((a) => a.session_key.includes(key));
    if (agent) agentIds.push(agent.id);
  }
  
  return agentIds;
}

export function useMissionControl() {
  const {
    tasks,
    agents,
    activities,
    setTasks,
    setAgents,
    setActivities,
    addTask,
    updateTask,
    addActivity,
  } = useMissionControlStore();

  // Initial data fetch
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      console.warn('[MissionControl] Supabase not configured');
      return;
    }

    // Fetch agents
    supabase
      .from('agents')
      .select('*')
      .order('team')
      .order('name')
      .then(({ data, error }) => {
        if (error) console.error('[MissionControl] Error fetching agents:', error);
        else if (data) setAgents(data);
      });

    // Fetch tasks with assignees
    supabase
      .from('tasks')
      .select(`
        *,
        task_assignees (
          agent_id,
          agents (*)
        )
      `)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error('[MissionControl] Error fetching tasks:', error);
        else if (data) {
          // Transform to include assignees array
          const tasksWithAssignees = data.map((task: any) => ({
            ...task,
            assignees: task.task_assignees?.map((ta: any) => ta.agents).filter(Boolean) || [],
          }));
          setTasks(tasksWithAssignees);
        }
      });

    // Fetch recent activities
    supabase
      .from('activities')
      .select(`
        *,
        agents (*),
        tasks (id, title)
      `)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (error) console.error('[MissionControl] Error fetching activities:', error);
        else if (data) {
          const activitiesWithRelations = data.map((a: any) => ({
            ...a,
            agent: a.agents,
            task: a.tasks,
          }));
          setActivities(activitiesWithRelations);
        }
      });

    // Real-time subscriptions
    const tasksSubscription = subscribeToTasks((payload) => {
      console.log('[MissionControl] Task change:', payload);
      if (payload.eventType === 'INSERT') {
        addTask(payload.new as Task);
      } else if (payload.eventType === 'UPDATE') {
        updateTask(payload.new.id, payload.new);
      }
    });

    const activitiesSubscription = subscribeToActivities((payload) => {
      console.log('[MissionControl] Activity:', payload);
      if (payload.eventType === 'INSERT') {
        addActivity(payload.new);
      }
    });

    return () => {
      tasksSubscription.unsubscribe();
      activitiesSubscription.unsubscribe();
    };
  }, []);

  // Create task
  const createTask = useCallback(async (
    title: string,
    description: string,
    options: {
      priority?: TaskPriority;
      team?: TeamType;
      domains?: string[];
      assigneeIds?: string[];
      dueDate?: string;
    } = {}
  ) => {
    if (!isSupabaseConfigured()) {
      console.error('[MissionControl] Supabase not configured');
      return null;
    }

    const { priority = 'medium', team, domains = [], assigneeIds, dueDate } = options;
    
    // Auto-route if no assignees specified
    const finalAssigneeIds = assigneeIds?.length 
      ? assigneeIds 
      : autoRouteTask({ team, domains }, agents);
    
    const status: TaskStatus = finalAssigneeIds.length > 0 ? 'assigned' : 'inbox';

    // Insert task
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .insert({
        title,
        description,
        status,
        priority,
        team,
        domains,
        created_by: 'user',
        due_date: dueDate,
      })
      .select()
      .single();

    if (taskError) {
      console.error('[MissionControl] Error creating task:', taskError);
      return null;
    }

    // Insert assignees
    if (finalAssigneeIds.length > 0) {
      const { error: assignError } = await supabase
        .from('task_assignees')
        .insert(finalAssigneeIds.map((agentId) => ({
          task_id: task.id,
          agent_id: agentId,
        })));

      if (assignError) {
        console.error('[MissionControl] Error assigning task:', assignError);
      }
    }

    // Log activity
    await logActivity(
      'task_created',
      task.id,
      `Task "${title}" created${finalAssigneeIds.length > 0 ? ' and assigned' : ''}`
    );

    return task;
  }, [agents]);

  // Move task (change status)
  const moveTask = useCallback(async (taskId: string, newStatus: TaskStatus) => {
    if (!isSupabaseConfigured()) return;

    const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', taskId);

    if (error) {
      console.error('[MissionControl] Error moving task:', error);
      return;
    }

    const task = tasks.find((t) => t.id === taskId);
    await logActivity(
      'task_moved',
      taskId,
      `Task "${task?.title || 'Unknown'}" moved to ${newStatus}`
    );
  }, [tasks]);

  // Assign task to agents
  const assignTask = useCallback(async (taskId: string, agentIds: string[]) => {
    if (!isSupabaseConfigured()) return;

    // Remove existing assignees
    await supabase
      .from('task_assignees')
      .delete()
      .eq('task_id', taskId);

    // Add new assignees
    if (agentIds.length > 0) {
      await supabase
        .from('task_assignees')
        .insert(agentIds.map((agentId) => ({
          task_id: taskId,
          agent_id: agentId,
        })));
    }

    // Update status if needed
    const task = tasks.find((t) => t.id === taskId);
    if (task?.status === 'inbox' && agentIds.length > 0) {
      await supabase
        .from('tasks')
        .update({ status: 'assigned' })
        .eq('id', taskId);
    }

    const agentNames = agentIds
      .map((id) => agents.find((a) => a.id === id)?.name)
      .filter(Boolean)
      .join(', ');

    await logActivity(
      'agent_assigned',
      taskId,
      `Task assigned to ${agentNames || 'no one'}`
    );
  }, [tasks, agents]);

  // Update task
  const updateTaskDetails = useCallback(async (
    taskId: string,
    updates: Partial<Pick<Task, 'title' | 'description' | 'priority' | 'domains' | 'due_date'>>
  ) => {
    if (!isSupabaseConfigured()) return;

    const { error } = await supabase
      .from('tasks')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', taskId);

    if (error) {
      console.error('[MissionControl] Error updating task:', error);
    }
  }, []);

  // Add comment
  const addComment = useCallback(async (
    taskId: string,
    content: string,
    mentions: string[] = []
  ) => {
    if (!isSupabaseConfigured()) return null;

    const { data, error } = await supabase
      .from('comments')
      .insert({
        task_id: taskId,
        content,
        mentions,
        from_user: true,
        agent_id: null,
        attachments: [],
      })
      .select()
      .single();

    if (error) {
      console.error('[MissionControl] Error adding comment:', error);
      return null;
    }

    await logActivity(
      'comment_added',
      taskId,
      `New comment added`
    );

    // Create notifications for mentions
    if (mentions.length > 0) {
      await supabase
        .from('notifications')
        .insert(mentions.map((agentId) => ({
          agent_id: agentId,
          task_id: taskId,
          content: `You were mentioned in a comment`,
          type: 'mention' as const,
        })));
    }

    return data;
  }, []);

  return {
    tasks,
    agents,
    activities,
    createTask,
    moveTask,
    assignTask,
    updateTaskDetails,
    addComment,
    isConfigured: isSupabaseConfigured(),
  };
}
