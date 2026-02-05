# Agora 🏛️

> *Where philosophers gather and ideas converge*

Agora is a native desktop application for interacting with AI agents through OpenClaw. Built with Tauri, React, and TypeScript for a lightweight, performant experience.

![Agora Screenshot](docs/screenshot.png)

## Features

- 🤖 **Multi-Agent Chat** - Switch between themed teams of AI agents
- 🎨 **A2UI Support** - Dynamic agent-generated interfaces
- 🌓 **Dark/Light/System Themes** - Automatic theme switching
- ⌨️ **Global Hotkeys** - `⌘⇧A` to toggle window from anywhere
- 🔔 **Native Notifications** - Desktop alerts for agent responses
- 🚀 **Auto-Start** - Launch on login
- 💾 **Persistent Settings** - Preferences saved locally
- 🔄 **Auto-Updates** - Stay up to date automatically

## Teams

### Personal (Philosophers) 🏛️
- **Marcus Aurelius** - Life Coach / Main Orchestrator
- **Hippocrates** - Fitness & Health
- **Confucius** - Family & Relationships
- **Seneca** - Personal Finance
- **Archimedes** - Tech Enthusiast

### Business (Warriors) ⚔️
- **Leonidas** - CEO
- **Odysseus** - CFO
- **Spartacus** - HR
- **Achilles** - CTO
- **Alexander** - Marketing Head

## Installation

### macOS
Download the latest `.dmg` from [Releases](https://github.com/YOUR_USERNAME/agora/releases).

### Prerequisites
- OpenClaw Gateway running on `ws://127.0.0.1:18789`

## Development

```bash
# Install dependencies
bun install

# Run in development mode
bun run tauri dev

# Build for production
bun run tauri build
```

## Tech Stack

- **Framework**: [Tauri 2.x](https://tauri.app/) (Rust + WebView)
- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS 4
- **State**: Zustand
- **Backend**: OpenClaw Gateway

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘⇧A` | Toggle Agora window (global) |
| `⌘,` | Open Settings |
| `⌘1-9` | Switch to agent 1-9 |
| `⌘[` / `⌘]` | Previous / Next agent |
| `⌘N` | New message |

## License

MIT

---

*"The Agora was where Socrates questioned, where ideas became movements, where citizens shaped their world. Now, it's where humans and AI converge."*
