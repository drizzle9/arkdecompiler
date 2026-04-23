import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels'
import MenuBar from './components/MenuBar'
import Toolbar from './components/Toolbar'
import StatusBar from './components/StatusBar'
import { useAppStore } from './store/useAppStore'
import { openAbcFile, openAbcFileByPath } from './services/file-actions'
import packageJson from '../package.json'
import './styles/globals.css'

const FileExplorer = lazy(() => import('./components/FileExplorer'))
const FunctionList = lazy(() => import('./components/FunctionList'))
const SymbolPanel = lazy(() => import('./components/SymbolPanel'))
const MainEditor = lazy(() => import('./components/MainEditor'))
const HexViewer = lazy(() => import('./components/HexViewer'))
const SearchPanel = lazy(() => import('./components/SearchPanel'))
const OutputPanel = lazy(() => import('./components/OutputPanel'))

const LazyPanelFallback: React.FC = () => (
  <div className="panel-content" style={{ color: 'var(--text-secondary)', padding: 10 }}>
    Loading...
  </div>
)

const AppLogo: React.FC<{ size?: number }> = ({ size = 80 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 1024 1024">
    <defs>
      <linearGradient id="wbg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#0f1724"/>
        <stop offset="100%" stopColor="#1f2d46"/>
      </linearGradient>
      <linearGradient id="wmetal" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#d5deec"/>
        <stop offset="100%" stopColor="#8ea1c3"/>
      </linearGradient>
      <linearGradient id="whandle" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#d6893b"/>
        <stop offset="100%" stopColor="#9f5e25"/>
      </linearGradient>
      <filter id="wshadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="16" stdDeviation="16" floodColor="#000000" floodOpacity="0.35"/>
      </filter>
    </defs>
    <rect x="40" y="40" width="944" height="944" rx="220" fill="url(#wbg)"/>
    <g opacity="0.2" stroke="#4f81c7" strokeWidth="8" fill="none">
      <path d="M240 300 L290 272 L340 300 L340 356 L290 384 L240 356 Z"/>
      <path d="M332 356 L382 328 L432 356 L432 412 L382 440 L332 412 Z"/>
      <path d="M240 412 L290 384 L340 412 L340 468 L290 496 L240 468 Z"/>
      <path d="M332 468 L382 440 L432 468 L432 524 L382 552 L332 524 Z"/>
    </g>
    <g transform="translate(126 124)" filter="url(#wshadow)">
      <rect x="452" y="116" width="140" height="86" rx="18" fill="url(#wmetal)" stroke="#dbe6f7" strokeWidth="6"/>
      <rect x="388" y="138" width="98" height="42" rx="12" fill="#aab9d5"/>
      <rect x="476" y="200" width="36" height="414" rx="18" fill="url(#whandle)"/>
      <rect x="506" y="364" width="130" height="28" rx="12" transform="rotate(-45 506 364)" fill="url(#whandle)"/>
      <circle cx="628" cy="246" r="78" fill="none" stroke="#8ec3ff" strokeWidth="20"/>
      <rect x="676" y="292" width="116" height="24" rx="12" transform="rotate(45 676 292)" fill="#8ec3ff"/>
    </g>
    <path d="M152 760 C312 674 448 690 600 784" stroke="#74aef5" strokeWidth="18" fill="none" opacity="0.35"/>
  </svg>
)

const WelcomeScreen: React.FC = () => {
  const [hovering, setHovering] = useState(false)

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-primary)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Subtle grid background */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          linear-gradient(rgba(78,120,187,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(78,120,187,0.04) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px',
        pointerEvents: 'none'
      }} />
      {/* Radial glow at center */}
      <div style={{
        position: 'absolute',
        width: 600,
        height: 600,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(14,99,156,0.08) 0%, transparent 70%)',
        pointerEvents: 'none'
      }} />

      <div style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0,
        userSelect: 'none'
      }}>
        {/* Logo */}
        <div style={{ marginBottom: 24, filter: 'drop-shadow(0 8px 24px rgba(14,99,156,0.35))' }}>
          <AppLogo size={96} />
        </div>

        {/* App name */}
        <div style={{
          fontSize: 32,
          fontWeight: 700,
          color: 'var(--text-active)',
          letterSpacing: 2,
          marginBottom: 8
        }}>
          arkdecompiler
        </div>

        {/* Version + description */}
        <div style={{
          fontSize: 13,
          color: 'var(--text-secondary)',
          marginBottom: 40,
          letterSpacing: 0.5
        }}>
          v{packageJson.version} &nbsp;·&nbsp; Ark Bytecode Analysis Tool
        </div>

        {/* Open button */}
        <button
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 36px',
            background: hovering ? 'var(--accent-hover)' : 'var(--accent-color)',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            letterSpacing: 0.5,
            boxShadow: hovering ? '0 4px 20px rgba(14,99,156,0.5)' : '0 2px 10px rgba(14,99,156,0.3)',
            transition: 'all 0.15s ease',
            marginBottom: 20,
            transform: hovering ? 'translateY(-1px)' : 'none'
          }}
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
          onClick={() => { void openAbcFile() }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          Open .abc File
        </button>

        {/* Drag hint */}
        <div style={{
          fontSize: 12,
          color: 'var(--text-secondary)',
          marginBottom: 40,
          opacity: 0.7
        }}>
          or drag &amp; drop an .abc file anywhere
        </div>

        {/* Shortcuts panel */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '6px 32px',
          padding: '16px 28px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 6,
          minWidth: 320
        }}>
          {[
            ['Ctrl + O', 'Open file'],
            ['F5', 'Decompile'],
          ].map(([key, label]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                fontFamily: 'Consolas, monospace',
                fontSize: 11,
                padding: '2px 8px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: 3,
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap'
              }}>{key}</span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const EmptyPanelHint: React.FC<{ title: string }> = ({ title }) => (
  <div className="panel">
    <div className="panel-header">{title}</div>
    <div className="panel-content" style={{ color: 'var(--text-secondary)', padding: 10 }}>
      Open an .abc file to load this panel.
    </div>
  </div>
)

const PythonCommandBar: React.FC = () => (
  <div className="python-command-bar">
    <span className="python-command-prefix">Python:</span>
    <input
      className="python-command-input"
      type="text"
      placeholder="Python command console (press Enter to run, coming soon)"
      disabled
    />
  </div>
)

const App: React.FC = () => {
  const [centerTab, setCenterTab] = useState<'disasm' | 'decompile' | 'hex' | 'xref' | 'strings'>('disasm')
  const [deferredPanelsReady, setDeferredPanelsReady] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const dragCounterRef = useRef(0)
  const hasCurrentFile = useAppStore((state) => !!state.currentFile)

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounterRef.current += 1
    if (dragCounterRef.current === 1) setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounterRef.current -= 1
    if (dragCounterRef.current === 0) setIsDragOver(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    dragCounterRef.current = 0
    setIsDragOver(false)

    const file = e.dataTransfer.files[0]
    if (!file) return

    // Electron exposes the native path via File.path
    const nativePath = (file as File & { path?: string }).path
    const filePath = nativePath || file.name

    await openAbcFileByPath(filePath)
  }, [])

  useEffect(() => {
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback
    if (idle) {
      const idleId = idle(() => setDeferredPanelsReady(true))
      return () => {
        const cancelIdle = (window as unknown as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback
        if (cancelIdle) cancelIdle(idleId)
      }
    }

    const timer = window.setTimeout(() => setDeferredPanelsReady(true), 220)
    return () => {
      window.clearTimeout(timer)
    }
  }, [])

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100vh', position: 'relative' }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={(e) => { void handleDrop(e) }}
    >
      {isDragOver && (
        <div style={{
          position: 'absolute',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0, 120, 212, 0.12)',
          border: '2px dashed var(--accent-color, #0078d4)',
          pointerEvents: 'none'
        }}>
          <div style={{
            padding: '20px 40px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--accent-color, #0078d4)',
            borderRadius: 8,
            fontSize: 15,
            color: 'var(--accent-color, #0078d4)',
            fontWeight: 600,
            letterSpacing: 0.5
          }}>
            Drop .abc file to open
          </div>
        </div>
      )}
      {/* Menu bar */}
      <MenuBar />
      
      {/* Toolbar */}
      <Toolbar />
      
      {/* Main content area */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', position: 'relative' }}>
        {!hasCurrentFile && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 10 }}>
            <WelcomeScreen />
          </div>
        )}
        <PanelGroup direction="vertical">
          <Panel defaultSize={82} minSize={50}>
            <PanelGroup direction="horizontal">
              {/* Left panel - File explorer */}
              <Panel defaultSize={18} minSize={12} maxSize={30}>
                <PanelGroup direction="vertical">
                  <Panel defaultSize={50}>
                    {hasCurrentFile && deferredPanelsReady ? (
                      <Suspense fallback={<LazyPanelFallback />}>
                        <FileExplorer />
                      </Suspense>
                    ) : (
                      <EmptyPanelHint title="File Explorer" />
                    )}
                  </Panel>
                  <PanelResizeHandle />
                  <Panel defaultSize={50}>
                    {hasCurrentFile && deferredPanelsReady ? (
                      <Suspense fallback={<LazyPanelFallback />}>
                        <FunctionList />
                      </Suspense>
                    ) : (
                      <EmptyPanelHint title="Function List" />
                    )}
                  </Panel>
                </PanelGroup>
              </Panel>

              <PanelResizeHandle />

              {/* Central main editor area: disassembly/decompile/hex tabs */}
              <Panel defaultSize={64}>
                <div className="panel" style={{ height: '100%', minHeight: 0 }}>
                  <div className="tab-bar" style={{ minHeight: 35 }}>
                    <div
                      className={`tab ${centerTab === 'disasm' ? 'active' : ''}`}
                      onClick={() => setCenterTab('disasm')}
                    >
                      Disassembly
                    </div>
                    <div
                      className={`tab ${centerTab === 'decompile' ? 'active' : ''}`}
                      onClick={() => setCenterTab('decompile')}
                    >
                      Decompile
                    </div>
                    <div className={`tab ${centerTab === 'hex' ? 'active' : ''}`} onClick={() => setCenterTab('hex')}>
                      Hex
                    </div>
                    <div className="tab disabled" title="Graph (coming soon)">
                      Graph
                    </div>
                    <div className="tab disabled" title="Xref (coming soon)">
                      Xref
                    </div>
                    <div className="tab disabled" title="Strings (coming soon)">
                      Strings
                    </div>
                  </div>
                  <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                    {!hasCurrentFile ? (
                      <div className="panel-content" style={{ color: 'var(--text-secondary)', padding: 12 }}>
                        Open an .abc file to start analysis.
                      </div>
                    ) : (
                      <>
                        {centerTab === 'disasm' && (
                          <div style={{ height: '100%' }}>
                            <Suspense fallback={<LazyPanelFallback />}>
                              <MainEditor />
                            </Suspense>
                          </div>
                        )}
                        {centerTab === 'decompile' && (
                          <div style={{ height: '100%' }}>
                            <Suspense fallback={<LazyPanelFallback />}>
                              <MainEditor mode="decompile" />
                            </Suspense>
                          </div>
                        )}
                        {centerTab === 'hex' && (
                          <div style={{ height: '100%' }}>
                            <Suspense fallback={<LazyPanelFallback />}>
                              <HexViewer />
                            </Suspense>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </Panel>

              <PanelResizeHandle />

              {/* Right panel */}
              <Panel defaultSize={18} minSize={12} maxSize={30}>
                <PanelGroup direction="vertical">
                  <Panel defaultSize={50}>
                    {hasCurrentFile && deferredPanelsReady ? (
                      <Suspense fallback={<LazyPanelFallback />}>
                        <SymbolPanel />
                      </Suspense>
                    ) : (
                      <EmptyPanelHint title="Symbol Table" />
                    )}
                  </Panel>
                  <PanelResizeHandle />
                  <Panel defaultSize={50}>
                    {hasCurrentFile && deferredPanelsReady ? (
                      <Suspense fallback={<LazyPanelFallback />}>
                        <SearchPanel />
                      </Suspense>
                    ) : (
                      <EmptyPanelHint title="Search" />
                    )}
                  </Panel>
                </PanelGroup>
              </Panel>
            </PanelGroup>
          </Panel>

          <PanelResizeHandle />

          {/* Full-width output panel */}
          <Panel defaultSize={24} minSize={12} maxSize={45}>
            <div style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <div style={{ flex: 1, minHeight: 0 }}>
                {hasCurrentFile && deferredPanelsReady ? (
                  <Suspense fallback={<LazyPanelFallback />}>
                    <OutputPanel />
                  </Suspense>
                ) : (
                  <EmptyPanelHint title="Output" />
                )}
              </div>
              <PythonCommandBar />
            </div>
          </Panel>
        </PanelGroup>
      </div>
      
      {/* Status bar */}
      <StatusBar />
    </div>
  )
}

export default App