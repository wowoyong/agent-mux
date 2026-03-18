#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:-}"
if [ -z "$VERSION" ]; then
  echo "Usage: bash scripts/release-version.sh <version>"
  echo "Example: bash scripts/release-version.sh 0.2.0"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "Updating version to $VERSION ..."

# 1. Update package.json
cd "$PROJECT_DIR"
sed -i '' "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" package.json
echo "  Updated package.json"

# 2. Update src-tauri/tauri.conf.json
sed -i '' "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" src-tauri/tauri.conf.json
echo "  Updated src-tauri/tauri.conf.json"

# 3. Update src-tauri/Cargo.toml (only the package version line)
sed -i '' "s/^version = \"[^\"]*\"/version = \"$VERSION\"/" src-tauri/Cargo.toml
echo "  Updated src-tauri/Cargo.toml"

# 4. Create git tag
TAG="desktop-v${VERSION}"
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml
git commit -m "chore(desktop): bump version to $VERSION"
git tag "$TAG"

echo ""
echo "Version $VERSION set and tag '$TAG' created."
echo ""
echo "To push:"
echo "  git push origin main"
echo "  git push origin $TAG"
