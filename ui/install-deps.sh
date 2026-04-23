#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "=============================="
echo "Installing arkdecompiler dependencies (macOS/Linux)"
echo "=============================="

if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] Node.js not found. Please install Node.js 18+ first."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "[ERROR] npm not found. Please reinstall Node.js."
  exit 1
fi

if [ -f "package-lock.json" ]; then
  echo "Installing npm dependencies with lockfile (npm ci)..."
  npm ci
else
  echo "Installing npm dependencies (npm install)..."
  npm install
fi

echo "[OK] npm dependencies installed."
echo "If you need Tauri build, also install Rust:"
echo "  https://rustup.rs/"