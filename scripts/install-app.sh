#!/bin/bash

# Build and Install Agora to /Applications
# This script copies the built .app bundle to /Applications
# Usage: ./scripts/install-app.sh [--rebuild]

set -e

APP_NAME="Agora"
BUILD_PATH="./src-tauri/target/release/bundle/macos/${APP_NAME}.app"
INSTALL_PATH="/Applications/${APP_NAME}.app"
SOURCE_DIR="./src"

# Check for --rebuild flag
if [[ "$1" == "--rebuild" ]]; then
  echo "🔨 Rebuilding ${APP_NAME}..."
  pnpm tauri build
fi

echo "📦 Installing ${APP_NAME} to /Applications..."

# Check if the build exists
if [ ! -d "$BUILD_PATH" ]; then
  echo "❌ Error: Build not found at $BUILD_PATH"
  echo "   Run 'pnpm build:app' or './scripts/install-app.sh --rebuild' first."
  exit 1
fi

# Warn if source files are newer than build
if [ -d "$SOURCE_DIR" ]; then
  NEWEST_SOURCE=$(find "$SOURCE_DIR" -type f -name "*.tsx" -o -name "*.ts" -o -name "*.rs" 2>/dev/null | xargs stat -f "%m %N" 2>/dev/null | sort -rn | head -1 | cut -d' ' -f1)
  BUILD_TIME=$(stat -f "%m" "$BUILD_PATH" 2>/dev/null)
  
  if [ -n "$NEWEST_SOURCE" ] && [ -n "$BUILD_TIME" ] && [ "$NEWEST_SOURCE" -gt "$BUILD_TIME" ]; then
    echo "⚠️  Warning: Source files have been modified since last build!"
    echo "   Build time: $(stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" "$BUILD_PATH")"
    echo "   Consider rebuilding with: pnpm build:app"
    echo ""
    read -p "   Continue with old build? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      exit 1
    fi
  fi
fi

# Remove existing installation if it exists
if [ -d "$INSTALL_PATH" ]; then
  echo "🗑️  Removing existing installation..."
  rm -rf "$INSTALL_PATH"
fi

# Copy the app to /Applications
echo "📋 Copying ${APP_NAME}.app to /Applications..."
cp -R "$BUILD_PATH" "$INSTALL_PATH"

echo "✅ ${APP_NAME} successfully installed to /Applications!"
echo "   You can now launch it from Spotlight or your Applications folder."
