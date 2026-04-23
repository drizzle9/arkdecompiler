#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

OS_NAME="$(uname -s)"
TAURI_BUNDLES=""
RUST_TARGET_DIR="$SCRIPT_DIR/target/tauri/rust"
BUNDLE_DIR="$RUST_TARGET_DIR/release/bundle"

case "$OS_NAME" in
  Darwin)
    TAURI_BUNDLES="app,dmg"
    ;;
  Linux)
    TAURI_BUNDLES="deb,appimage"
    ;;
  *)
    echo "[ERROR] Unsupported OS: $OS_NAME"
    echo "This script supports macOS and Linux only."
    exit 1
    ;;
esac

echo "=============================="
echo "Building arkdecompiler (Tauri: $OS_NAME)"
echo "=============================="

if ! command -v cargo >/dev/null 2>&1; then
  echo "[ERROR] Rust/Cargo not found. Please install Rust first."
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "Installing npm dependencies..."
  bash ./install-deps.sh
fi

echo "Cleaning src-tauri/gen directory..."
if [ -d "src-tauri/gen" ]; then
  rm -rf src-tauri/gen
  echo "[OK] Cleaned src-tauri/gen"
fi

mkdir -p "$RUST_TARGET_DIR"
export CARGO_TARGET_DIR="$RUST_TARGET_DIR"

npm run tauri:build -- --bundles "$TAURI_BUNDLES"

mkdir -p target/tauri

if [ -d "$BUNDLE_DIR" ]; then
  cp -a "$BUNDLE_DIR"/. target/tauri/
else
  echo "[WARN] Bundle directory not found: $BUNDLE_DIR"
fi

if [ -d "src-tauri/gen" ]; then
  mkdir -p target/tauri/gen
  cp -a src-tauri/gen/. target/tauri/gen/
  rm -rf src-tauri/gen
fi

echo "[OK] Tauri build completed."
echo "Output: target/tauri"