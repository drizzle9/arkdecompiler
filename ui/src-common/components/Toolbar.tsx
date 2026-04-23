import React, { Suspense, lazy, useEffect, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { decompileCurrentAbcFile, openAbcFile } from '../services/file-actions'
import {
  FolderOpen,
  Save,
  Search,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Code,
  GitBranch,
  Settings,
  Zap
} from 'lucide-react'

const ToolConfigModal = lazy(() => import('./ToolConfigModal'))

const Toolbar: React.FC = () => {
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false)
  const {
    setError,
    setCurrentAddress,
    currentFile
  } = useAppStore()

  // ============ Toolbar button operations ============

  const handleOpenFile = async () => {
    await openAbcFile()
  }

  const handleSave = () => {
    if (!currentFile) {
      setError('No project to save')
      return
    }

    const content = JSON.stringify(
      {
        name: currentFile.name,
        size: currentFile.size,
        format: currentFile.format,
        architecture: currentFile.architecture,
        exportedAt: new Date().toISOString()
      },
      null,
      2
    )

    const blob = new Blob([content], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${currentFile.name}.dproj.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleSearch = () => {
    const input = document.querySelector<HTMLInputElement>('input.search-input[placeholder="Search..."]')
    if (input) {
      input.focus()
      input.select()
    } else {
      setError('Search panel input box not found')
    }
  }

  const handleDecompile = async () => {
    await decompileCurrentAbcFile()
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'F5') {
        event.preventDefault()
        void handleDecompile()
      } else if (event.key === 'o' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault()
        void openAbcFile()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [currentFile])

  const handleBack = () => {
    setError('Navigation back feature pending history stack')
  }

  const handleForward = () => {
    setError('Navigation forward feature pending history stack')
  }

  const handleGoToAddress = () => {
    const raw = window.prompt('Enter address (hex like 0x401000 or decimal)')
    if (!raw) return

    const value = raw.trim().toLowerCase().startsWith('0x')
      ? Number.parseInt(raw, 16)
      : Number.parseInt(raw, 10)

    if (Number.isNaN(value)) {
      setError('Invalid address format')
      return
    }

    setCurrentAddress(value)
  }

  const handleTextView = () => {
    useAppStore.getState().setViewMode('text')
  }

  const handleGraphView = () => {
    useAppStore.getState().setViewMode('graph')
  }

  const handleSettings = () => {
    setIsConfigModalOpen(true)
  }

  return (
    <>
      <div className="toolbar">
        {/* File operations */}
        <div style={{ display: 'flex', gap: '2px', marginRight: '8px' }}>
          <button className="toolbar-btn" title="Open File (Ctrl+O)" onClick={handleOpenFile}>
            <FolderOpen size={16} />
          </button>
          <button className="toolbar-btn" title="Save Project (Ctrl+S)" onClick={handleSave} disabled>
            <Save size={16} />
          </button>
        </div>

        <div style={{ width: 1, height: 20, backgroundColor: 'var(--border-color)', margin: '0 4px' }} />

        {/* Navigation operations */}
        <div style={{ display: 'flex', gap: '2px', marginRight: '8px' }}>
          <button className="toolbar-btn" title="Back (Alt+Left)" onClick={handleBack} disabled>
            <ArrowLeft size={16} />
          </button>
          <button className="toolbar-btn" title="Forward (Alt+Right)" onClick={handleForward} disabled>
            <ArrowRight size={16} />
          </button>
          <button className="toolbar-btn" title="Go to Address (G)" onClick={handleGoToAddress} disabled>
            <ArrowUp size={16} />
          </button>
        </div>

        <div style={{ width: 1, height: 20, backgroundColor: 'var(--border-color)', margin: '0 4px' }} />

        {/* Search and decompile */}
        <div style={{ display: 'flex', gap: '2px', marginRight: '8px' }}>
          <button className="toolbar-btn" title="Search (Ctrl+F)" onClick={handleSearch}>
            <Search size={16} />
          </button>
          <button className="toolbar-btn" title="Decompile (F5)" onClick={handleDecompile}>
            <Zap size={16} />
          </button>
        </div>

        <div style={{ width: 1, height: 20, backgroundColor: 'var(--border-color)', margin: '0 4px' }} />

        {/* View switch */}
        <div style={{ display: 'flex', gap: '2px', marginRight: '8px' }}>
          <button className="toolbar-btn" title="Text View" onClick={handleTextView} disabled>
            <Code size={16} />
          </button>
          <button className="toolbar-btn" title="Graph View" onClick={handleGraphView} disabled>
            <GitBranch size={16} />
          </button>
        </div>

        {/* Right spacing */}
        <div style={{ flex: 1 }} />

        {/* Settings */}
        <div style={{ display: 'flex', gap: '2px' }}>
          <button className="toolbar-btn" title="Settings" onClick={handleSettings}>
            <Settings size={16} />
          </button>
        </div>
      </div>

      <Suspense fallback={null}>
        <ToolConfigModal isOpen={isConfigModalOpen} onClose={() => setIsConfigModalOpen(false)} />
      </Suspense>
    </>
  )
}

export default Toolbar