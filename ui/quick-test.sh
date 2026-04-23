#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

MODE="${1:-web}"

ensure_deps() {
  if [ ! -d "node_modules" ]; then
    echo "node_modules not found, installing dependencies first..."
    bash ./install-deps.sh
  fi
}

run_web() {
  echo "[INFO] Quick test (Web): starting Vite dev server..."
  npm run web:quick
}

run_electron() {
  ensure_deps

  echo "[INFO] Quick test (Electron): starting Vite on :1420 ..."
  npm run dev -- --host --port 1420 &
  VITE_PID=$!

  cleanup() {
    if kill -0 "$VITE_PID" >/dev/null 2>&1; then
      kill "$VITE_PID" >/dev/null 2>&1 || true
    fi
  }
  trap cleanup EXIT INT TERM

  sleep 3
  echo "[INFO] Launching Electron..."
  NODE_ENV=development npx electron .
}

run_tauri() {
  ensure_deps
  echo "[INFO] Quick test (Tauri): starting tauri dev..."
  npm run tauri:dev
}

case "$MODE" in
  web)
    run_web
    ;;
  electron)
    run_electron
    ;;
  tauri)
    run_tauri
    ;;
  *)
    echo "[ERROR] Unknown mode: $MODE"
    echo "Usage: bash ./quick-test.sh [web|electron|tauri]"
    exit 1
    ;;
esac