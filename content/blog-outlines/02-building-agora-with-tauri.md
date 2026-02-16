# Blog Post Outline #2: Building a Native AI Desktop App with Tauri + React

**Type:** Searchable (developer audience) + Shareable (technical deep-dive)
**Target keyword:** "Tauri desktop app" / "building AI desktop app"
**Funnel stage:** Middle — consideration (developer/builder audience)
**Estimated length:** 1,800–2,200 words

---

## Hook

We built a native desktop app for managing AI agents — and we didn't use Electron. Here's why we chose Tauri, what went well, and what we'd do differently.

## Outline

### 1. Why Native? Why Not Just a Web App?
- Global hotkeys (⌘⇧A to summon from anywhere)
- Native notifications that actually work
- Auto-start on login — agents should be running before you sit down
- Smaller footprint: Tauri apps are ~10MB vs Electron's 150MB+
- Privacy: local-first with WebSocket to your own gateway

### 2. The Stack
- Tauri 2.10 (Rust backend, system WebView)
- React 19 + TypeScript + Vite
- Zustand for state (why not Redux — simplicity wins)
- Supabase for persistence + realtime
- Tailwind CSS 4 for styling
- WebSocket RPC v3 for agent communication

### 3. Architecture Decisions That Paid Off
- Supabase-first stores: UI state persisted locally, data always from source
- Code splitting with React.lazy() — 10 tabs, loads fast
- Realtime upsert pattern for live updates
- Component barrel exports for clean imports

### 4. Challenges & Gotchas
- Tauri 2 migration quirks
- WebView rendering differences across macOS versions
- Managing WebSocket reconnection gracefully
- Balancing native feel with web-based UI

### 5. What We'd Do Differently
- Start with Tauri 2 from day one (migration cost)
- More aggressive code splitting earlier
- Better offline-first patterns

### 6. CTA
- Open source? Link to repo
- Try Agora — link to download
- Join the community (Discord)

---

## Brand Voice Notes
- Developer-to-developer tone — honest, practical
- Show real code snippets / architecture diagrams
- Acknowledge trade-offs openly (builds trust)
- "We built this" energy, not "you should use this"
