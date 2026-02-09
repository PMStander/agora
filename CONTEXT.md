# Project: Agora

The Tauri + React frontend for the OpenClaw multi-agent system.

## Stack

- **Runtime:** Tauri 2.10 (Rust backend, WebView frontend)
- **Frontend:** React 19 + TypeScript
- **State:** Zustand 5 (with persist middleware)
- **Database:** Supabase (Postgres + Realtime)
- **Styling:** Tailwind CSS 4
- **Build:** Vite
- **Charts:** Recharts
- **Agent Comms:** WebSocket RPC v3 to OpenClaw Gateway

## Repository

- **Path:** `/Users/peetstander/Developer/agora`
- **Branch strategy:** Feature branches → main
- **Key directories:**
  - `src/components/` — React components by domain
  - `src/stores/` — Zustand stores
  - `src/hooks/` — Custom hooks (data fetching, business logic)
  - `src/types/` — TypeScript type definitions
  - `src/lib/` — Utility libraries
  - `supabase/` — Migrations and schema

## Architecture Patterns

- **Supabase-first stores:** Zustand stores use `persist` with `partialize` that only saves UI state — entity data always from Supabase
- **Realtime upsert:** Shared `handleRealtimePayload<T>()` in `src/lib/realtimeHelpers.ts`
- **Code splitting:** All tabs use `React.lazy()` + `Suspense`
- **Hooks pattern:** `useRef(false)` for `initializedRef` to prevent double-init in StrictMode
- **Navigation:** 10 tabs via `activeTab` in missionControl store, shortcuts Cmd+1-9

## Key Features

- Chat (multi-agent with A2UI sidebar)
- Mission Control (Kanban board + table view)
- CRM (companies, contacts, deals, pipelines)
- Products catalog
- Projects
- Reports (5 SQL views + Recharts)
- Workflows (automation builder)
- Email (Gmail OAuth)
- Calendar (Google Calendar sync)
- Invoicing & Payments (PayPal)

## Conventions

- All UUIDs use `gen_random_uuid()`
- All tables have RLS (currently permissive)
- Components use `cn()` utility from `src/lib/utils.ts` for conditional classes
- Barrel `index.ts` exports in each component directory
- Notifications via `createNotificationDirect()` standalone function

## Current Status

Active development. ~250 source files. Main areas of focus: mission control improvements, agent sub-teams, project context system.

---

*Update this file as the project evolves. This is the single source of truth for any agent working on Agora.*
