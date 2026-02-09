#!/usr/bin/env bash
set -euo pipefail

PLIST_PATH="$HOME/Library/LaunchAgents/ai.agora.mission-dispatcher.plist"
LABEL="ai.agora.mission-dispatcher"

launchctl bootout "gui/${UID}/${LABEL}" >/dev/null 2>&1 || true
rm -f "$PLIST_PATH"

echo "Uninstalled ${LABEL}"
