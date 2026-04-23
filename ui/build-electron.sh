#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

OS_NAME="$(uname -s)"
BUILD_TARGET=""

case "$OS_NAME" in
  Darwin)
    BUILD_TARGET="--mac"
    ;;
  Linux)
    BUILD_TARGET="--linux"
    ;;
  *)
    echo "[ERROR] Unsupported OS: $OS_NAME"
    echo "This script supports macOS and Linux only."
    exit 1
    ;;
esac

echo "=============================="
echo "Building arkdecompiler (Electron: $OS_NAME)"
echo "=============================="

NEED_SYNC_DEPS=0

if [ ! -d "node_modules" ]; then
  NEED_SYNC_DEPS=1
elif [ -f "package-lock.json" ]; then
  if [ ! -f "node_modules/.package-lock.json" ] || [ "package-lock.json" -nt "node_modules/.package-lock.json" ]; then
    NEED_SYNC_DEPS=1
  fi
fi

if [ "$NEED_SYNC_DEPS" -eq 1 ]; then
  echo "Syncing npm dependencies..."
  bash ./install-deps.sh
fi

npm run build:web

echo "Trying default output: target/electron"
if npx electron-builder $BUILD_TARGET; then
  echo "[OK] Electron build completed."
  echo "Output: target/electron"
  exit 0
fi

echo "[WARN] Default output directory may be locked or unavailable."
echo "Trying fallback output: target/electron-fallback"
if npx electron-builder $BUILD_TARGET --config.directories.output=target/electron-fallback; then
  echo "[OK] Electron build completed with fallback output."
  echo "Output: target/electron-fallback"
  exit 0
fi

echo "[ERROR] Electron build failed on both default and fallback outputs."
exit 1