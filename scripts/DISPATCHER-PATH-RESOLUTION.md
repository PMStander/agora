# Mission Dispatcher - OpenClaw Binary Path Resolution

## Problem

Tauri apps don't inherit the full shell PATH environment (including nvm paths). This caused the mission dispatcher to fail with `ENOENT` when spawning the `openclaw` CLI.

Previous workaround: Manual symlink at `/usr/local/bin/openclaw` → nvm path. This breaks when node versions change.

## Solution

The dispatcher now uses a robust path resolution strategy with multiple fallback options:

### Resolution Order

1. **OPENCLAW_HOME environment variable** (new in OpenClaw 2026.2.9)
   - Checks `$OPENCLAW_HOME/bin/openclaw`
   - Explicit configuration, highest priority

2. **PATH lookup** (via `which openclaw`)
   - Works when PATH is properly inherited
   - Fast and reliable when available

3. **Common installation paths search**
   - nvm installations (including version from NVM_BIN)
   - Homebrew installations
   - Global npm installations
   - Searched in order:
     - `~/.nvm/versions/node/{current}/bin/openclaw`
     - `~/.nvm/versions/node/v22.19.0/bin/openclaw`
     - `~/.nvm/versions/node/v20.18.1/bin/openclaw`
     - `~/.nvm/versions/node/v18.20.5/bin/openclaw`
     - `/opt/homebrew/bin/openclaw`
     - `/usr/local/bin/openclaw`
     - `/opt/homebrew/Cellar/node/{version}/bin/openclaw`
     - `~/.npm-global/bin/openclaw`

4. **Fallback to 'openclaw'**
   - Last resort, relies on PATH

## Configuration

### Recommended: Set OPENCLAW_HOME

Add to your shell profile or Tauri app environment:

```bash
export OPENCLAW_HOME=/Users/peetstander/.nvm/versions/node/v22.19.0
```

Or if using global npm installation:

```bash
export OPENCLAW_HOME=/opt/homebrew
```

### Alternative: Ensure PATH includes openclaw

The dispatcher will find openclaw if it's in PATH, but this may not work from Tauri apps.

## Testing

### Test path resolution:
```bash
node scripts/test-openclaw-path.mjs
```

### Test dispatcher with restricted PATH:
```bash
node scripts/test-dispatcher-path.mjs
```

### Test without /usr/local/bin symlink:
```bash
# Remove the symlink (requires sudo)
sudo rm /usr/local/bin/openclaw

# Run dispatcher dry-run
npm run mission-dispatcher:dry
```

## Implementation Details

- Resolution function: `resolveOpenClawBinary()` in `mission-dispatcher.mjs`
- Called once per agent execution
- Logs the resolved path when using search fallback
- No symlinks required

## Migration

The old `/usr/local/bin/openclaw` symlink is no longer needed and can be removed:

```bash
sudo rm /usr/local/bin/openclaw
```

The dispatcher will automatically find openclaw via the search paths or OPENCLAW_HOME.
