#!/usr/bin/env bash
#
# build-dmg.sh - Create a DMG from a .app bundle
#
# Usage: build-dmg.sh <path-to-.app> <version> <arch>
# Example: build-dmg.sh "src-tauri/target/release/bundle/macos/Agent Mux.app" 0.1.0 aarch64

set -euo pipefail

APP_PATH="$1"
VERSION="${2:-0.0.0}"
ARCH="${3:-$(uname -m)}"

if [ ! -d "$APP_PATH" ]; then
  echo "Error: .app bundle not found at: $APP_PATH"
  exit 1
fi

APP_NAME=$(basename "$APP_PATH" .app)
SAFE_NAME=$(echo "$APP_NAME" | tr ' ' '_')
DMG_NAME="${SAFE_NAME}_${VERSION}_${ARCH}.dmg"

# Output DMG next to the .app in the dmg bundle directory
BUNDLE_DIR="$(dirname "$APP_PATH")"
DMG_DIR="${BUNDLE_DIR}/../dmg"
mkdir -p "$DMG_DIR"
DMG_PATH="${DMG_DIR}/${DMG_NAME}"

# Clean up any previous DMG
rm -f "$DMG_PATH"

echo "Creating DMG: ${DMG_NAME}"
echo "  Source: ${APP_PATH}"
echo "  Output: ${DMG_PATH}"

# Create a temporary directory for the DMG contents
STAGING_DIR=$(mktemp -d)
trap 'rm -rf "$STAGING_DIR"' EXIT

# Copy .app to staging
cp -R "$APP_PATH" "$STAGING_DIR/"

# Create a symlink to /Applications for drag-and-drop install
ln -s /Applications "$STAGING_DIR/Applications"

# Create the DMG
hdiutil create \
  -volname "$APP_NAME" \
  -srcfolder "$STAGING_DIR" \
  -ov \
  -format UDZO \
  "$DMG_PATH"

echo ""
echo "DMG created successfully: ${DMG_PATH}"
echo "Size: $(du -h "$DMG_PATH" | cut -f1)"

# Output the path for CI usage
echo "dmg_path=${DMG_PATH}"
