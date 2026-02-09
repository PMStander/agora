import type { Task } from '../types/supabase';

function dependencyIds(task: Task): string[] {
  return Array.isArray(task.dependency_task_ids) ? task.dependency_task_ids : [];
}

/**
 * Determines if a task status is terminal (complete or permanently stopped).
 * 
 * Terminal states unblock dependencies because the task will not progress further:
 * - 'done': Successfully completed ✅
 * - 'failed': Failed but terminal - dependents should proceed to handle failure ✅
 * 
 * Non-terminal states keep dependencies blocked (task is still in flight):
 * - 'todo': Not yet started
 * - 'blocked': Blocked by its own dependencies
 * - 'in_progress': Currently being worked on
 * - 'review': Awaiting review (could return to in_progress or complete)
 * 
 * Critical reasoning for 'failed' as terminal:
 * Failed dependencies MUST unblock dependents to avoid cascading permanent deadlocks.
 * Dependents can then handle the upstream failure appropriately (e.g., alternative
 * execution paths, cleanup tasks, or propagate their own failure).
 * 
 * Without this, a single failed task permanently blocks all downstream work forever.
 */
function isTerminalState(status: Task['status']): boolean {
  return status === 'done' || status === 'failed';
}

export function getIncompleteDependencyIds(task: Task, tasks: Task[]): string[] {
  const taskMap = new Map(tasks.map((entry) => [entry.id, entry]));
  return dependencyIds(task).filter((dependencyId) => {
    const dependency = taskMap.get(dependencyId);
    // Missing dependencies block (shouldn't happen but defensive)
    if (!dependency) return true;
    // Only terminal states unblock dependencies
    return !isTerminalState(dependency.status);
  });
}

export function getIncompleteDependencyTitles(task: Task, tasks: Task[]): string[] {
  const taskMap = new Map(tasks.map((entry) => [entry.id, entry]));
  return getIncompleteDependencyIds(task, tasks).map((dependencyId) => {
    return taskMap.get(dependencyId)?.title || dependencyId;
  });
}

export function canStartTask(task: Task, tasks: Task[]): boolean {
  return getIncompleteDependencyIds(task, tasks).length === 0;
}

export function isRootMissionPlaceholder(task: Task, tasks: Task[]): boolean {
  const missionRootId = task.root_task_id || task.id;
  if (task.id !== missionRootId) return false;
  return tasks.some((entry) => (entry.root_task_id || entry.id) === missionRootId && entry.id !== task.id);
}
