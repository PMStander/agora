import type { Task } from '../types/supabase';

function dependencyIds(task: Task): string[] {
  return Array.isArray(task.dependency_task_ids) ? task.dependency_task_ids : [];
}

export function getIncompleteDependencyIds(task: Task, tasks: Task[]): string[] {
  const taskMap = new Map(tasks.map((entry) => [entry.id, entry]));
  return dependencyIds(task).filter((dependencyId) => {
    const dependency = taskMap.get(dependencyId);
    return !dependency || dependency.status !== 'done';
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
