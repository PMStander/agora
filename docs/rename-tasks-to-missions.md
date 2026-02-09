# Rename Tasks → Missions: Touchpoints & Migration Steps

This repo currently uses **tasks** as the execution unit underneath Mission Control (with a separate `missions` table for lifecycle). To rename **tasks → missions** across the system, the following touchpoints and migration steps must be addressed.

## Touchpoints

### Database / Supabase
- **Tables**: `tasks`, `task_assignees`, `task_dependencies`, `comments.task_id`, `activities.task_id`, `documents.task_id`, `notifications.task_id`
- **Foreign keys / constraints**: `fk_agents_current_task`, `task_dependencies` FK pairs, comment/notification/task links
- **Indexes**: `idx_tasks_*`, `idx_comments_task_id`
- **Realtime publication**: `ALTER PUBLICATION supabase_realtime ADD TABLE tasks`
- **RLS policies**: `Allow all on tasks`, `Allow all on task_assignees`, `Allow all on task_dependencies`
- **Seed data / migrations**: `supabase/schema.sql`, `supabase/migrations/*`

### Server-side / Scripts
- **Mission dispatcher prompts**: `scripts/mission-dispatcher.mjs`
- **Mission requeue / lifecycle**: `scripts/requeue-suspicious-missions.mjs`

### Client Types & Mapping
- **Supabase types**: `src/types/supabase.ts` (`Task`, `TaskStatus`, `TaskPriority`, `TaskDependency`, `TASK_COLUMNS`)
- **Mapping logic**: `src/lib/missionTaskMapping.ts`, `src/lib/taskDependencies.ts`, `src/lib/missionPlan.ts`

### State / Hooks
- **Store**: `src/stores/missionControl.ts` (`tasks`, `selectedTaskId`, task CRUD)
- **Schedulers**: `src/hooks/useMissionScheduler.ts` (task execution lifecycle)
- **Mission control**: `src/hooks/useMissionControl.ts` (task creation, plan -> tasks)

### UI / UX
- **Mission Control components**: `CreateTaskModal`, `TaskDetail`, `TaskCard`, `DependencyDag`, `MissionLifecyclePanel`, `PlanningCenterModal`
- **Navigation**: `src/components/layout/ContextPanel.tsx`
- **Settings**: `src/components/settings/SettingsPanel.tsx`

### Analytics / Logs
- **Activity feed types**: `task_created`, `task_moved`, `task_completed`, `task_failed`, etc.
- **Mission logs metadata**: `metadata.task_id` / `metadata.taskId`

---

## Migration Steps (Recommended)

### 1) Database: create new “missions” execution tables
- **New tables** (example naming): `mission_items`, `mission_assignees`, `mission_dependencies`
- Create new FKs (replace `task_id` with `mission_id`)
- Add indexes / RLS policies / realtime publication for new tables

### 2) Backfill data
- Copy rows from `tasks` → `mission_items`
- Copy assignees, dependencies, comments, activities, documents, notifications
- Migrate `agents.current_task_id` → `agents.current_mission_id`

### 3) Update API + queries
- Update Supabase client queries to use the new tables
- Update subscription channels / realtime listeners
- Update any analytics/event names if they embed “task”

### 4) Update client code
- Rename types (`Task` → `MissionItem` or `MissionTask`)
- Update stores, hooks, and mapping utilities
- Update UI labels and copy (see changes applied below)

### 5) Compatibility layer (optional but recommended)
- Create views or RPCs mapping legacy names to new tables
- Keep `tasks` as a view during a transition period

### 6) Cleanup
- Drop old tables and columns after traffic is fully migrated
- Remove legacy views and compatibility code

---

## Implementation updates in this repo (partial rename: user-facing text)

- Updated prompt text to say **mission** instead of **mission task**.
- Updated Mission Control UI labels, placeholders, and messages to show **missions** instead of **tasks**.

These changes are intentionally limited to user-facing copy and prompt language, while deeper table/type renames should follow the migration plan above.
