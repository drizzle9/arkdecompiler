import React, { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import mockDisassemblyText from '../assets/demo.pa?raw'
import { buildBinaryFileFromDisassembly } from '../services/disassembly-parser'
import { decompileCurrentAbcFile, openAbcFile } from '../services/file-actions'
import packageJson from '../../package.json'

type MenuSeparator = { type: 'separator' }
type MenuActionItem = {
  label: string
  shortcut: string
  action: () => void | Promise<void>
  disabled?: boolean
}
type MenuItem = MenuSeparator | MenuActionItem
type MenuGroup = { name: string; items: MenuItem[] }
const ToolConfigModal = lazy(() => import('./ToolConfigModal'))

const MenuBar: React.FC = () => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [isToolConfigOpen, setIsToolConfigOpen] = useState(false)
  const [toolConfigSection, setToolConfigSection] = useState<'arkDisasm' | 'arkDecompile' | 'workspace'>('arkDisasm')
  const menuBarRef = useRef<HTMLDivElement | null>(null)
  const {
    setError,
    addFile,
    setCurrentFile,
    setCurrentAddress,
    removeFile,
    setCurrentFunction,
    addTab,
    addOutputLog,
    currentFile,
    viewState
  } = useAppStore()

  const notify = (message: string) => {
    setError(message)
    addOutputLog('warning', 'Info', message)
    window.setTimeout(() => {
      if (useAppStore.getState().error === message) {
        useAppStore.getState().setError(null)
      }
    }, 1800)
  }

  const handleMenuClick = (menu: string) => {
    setActiveMenu(activeMenu === menu ? null : menu)
  }

  useEffect(() => {
    if (!activeMenu) return

    const handleDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (!menuBarRef.current?.contains(target)) {
        setActiveMenu(null)
      }
    }

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveMenu(null)
      }
    }

    document.addEventListener('mousedown', handleDocumentMouseDown)
    window.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleDocumentMouseDown)
      window.removeEventListener('keydown', handleEsc)
    }
  }, [activeMenu])

  const handleNotImplemented = () => {
    notify('This feature is under development')
    setActiveMenu(null)
  }

  // ============ File menu operations ============
  
  const handleOpenMockText = () => {
    try {
      const fileName = 'mock-disassembly.txt'
      const filePath = 'mock://mock-disassembly.txt'
      const output = mockDisassemblyText || '; mock text is empty'

      const file = buildBinaryFileFromDisassembly({
        filePath,
        fileName,
        fileSize: output.length,
        disassemblyOutput: output,
        decompileOutput: '// mock decompile text not provided'
      })
      const entryFunction = file.functions[0]

      addFile(file)
      setCurrentFile(file)
      setCurrentFunction(entryFunction)
      setCurrentAddress(entryFunction.address)
      addTab({
        id: `func-${entryFunction.id}`,
        name: `${file.name}::disasm`,
        type: 'decompiler',
        functionId: entryFunction.id,
        address: entryFunction.address,
        isDirty: false
      })

      addOutputLog('success', 'Sample text loaded', `source=${fileName}\nbytes=${output.length}`)
      setError(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      addOutputLog('error', 'Failed to load sample text', message)
      setError('Failed to load sample text. Please check the output window')
    } finally {
      setActiveMenu(null)
    }
  }

  const handleOpenFile = async () => {
    await openAbcFile()
    setActiveMenu(null)
  }

  const handleOpenProject = async () => {
    notify('Project loading feature pending')
    setActiveMenu(null)
  }

  const handleSaveProject = async () => {
    if (!currentFile) {
      notify('No project to save')
      setActiveMenu(null)
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
    setActiveMenu(null)
  }

  const handleExport = async () => {
    if (!currentFile) {
      notify('Please open an .abc file first before exporting')
      setActiveMenu(null)
      return
    }

    const report = `arkdecompiler Export\nFile: ${currentFile.name}\nSize: ${currentFile.size}\nFormat: ${currentFile.format}\nTime: ${new Date().toLocaleString()}`
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${currentFile.name}.report.txt`
    a.click()
    URL.revokeObjectURL(url)
    setActiveMenu(null)
  }

  const handleClose = () => {
    if (!currentFile) {
      notify('No file is currently open')
      setActiveMenu(null)
      return
    }
    removeFile(currentFile.id)
    setCurrentFile(null)
    setCurrentFunction(null)
    setCurrentAddress(0)
    setActiveMenu(null)
  }

  // ============ Edit menu operations ============

  const handleUndo = () => {
    notify('Undo feature pending')
    setActiveMenu(null)
  }

  const handleRedo = () => {
    notify('Redo feature pending')
    setActiveMenu(null)
  }

  const handleFind = () => {
    const input = document.querySelector<HTMLInputElement>('input.search-input[placeholder="Search..."]')
    if (input) {
      input.focus()
      input.select()
    } else {
      notify('Search input box not found')
    }
    setActiveMenu(null)
  }

  const handleRename = () => {
    notify('Rename symbol feature pending')
    setActiveMenu(null)
  }

  // ============ View menu operations ============

  const handleViewMode = (mode: 'graph' | 'text' | 'mixed') => {
    useAppStore.getState().setViewMode(mode)
    setActiveMenu(null)
  }

  // ============ Analyze menu operations ============

  const handleAnalyzeAll = async () => {
    if (!currentFile) {
      notify('Please open an .abc file first before analyzing')
      setActiveMenu(null)
      return
    }

    setLoading(true, 'Analyzing file...')
    try {
      await new Promise(resolve => setTimeout(resolve, 700))
    } finally {
      setLoading(false)
    }
    setActiveMenu(null)
  }

  const handleAnalyzeFunction = async () => {
    if (!viewState.currentAddress) {
      notify('Please select a function or address first')
      setActiveMenu(null)
      return
    }

    setLoading(true, 'Analyzing function...')
    try {
      await new Promise(resolve => setTimeout(resolve, 500))
    } finally {
      setLoading(false)
    }
    setActiveMenu(null)
  }

  const handleMenuDecompile = async () => {
    await decompileCurrentAbcFile()
    setActiveMenu(null)
  }

  const openToolConfig = () => {
    setToolConfigSection('arkDisasm')
    setIsToolConfigOpen(true)
    setActiveMenu(null)
  }

  const openWorkspaceConfig = () => {
    setToolConfigSection('workspace')
    setIsToolConfigOpen(true)
    setActiveMenu(null)
  }

  // ============ Tools menu operations ============

  const handleSearchStrings = () => {
    const input = document.querySelector<HTMLInputElement>('input.search-input[placeholder="Search..."]')
    if (input) {
      input.value = 'string'
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.focus()
    } else {
      notify('Search input box not found')
    }
    setActiveMenu(null)
  }

  const handleSearchFunctions = () => {
    const input = document.querySelector<HTMLInputElement>('input.search-input[placeholder="Search functions..."]')
    if (input) {
      input.focus()
      input.select()
    } else {
      notify('Function search input box not found')
    }
    setActiveMenu(null)
  }

  const handleGotoAddress = () => {
    const raw = window.prompt('Enter address (hex like 0x401000 or decimal)')
    if (!raw) {
      setActiveMenu(null)
      return
    }
    const value = raw.trim().toLowerCase().startsWith('0x')
      ? Number.parseInt(raw, 16)
      : Number.parseInt(raw, 10)

    if (Number.isNaN(value)) {
      notify('Invalid address format')
    } else {
      setCurrentAddress(value)
    }
    setActiveMenu(null)
  }

  // ============ Help menu operations ============

  const handleAbout = () => {
    window.alert(`${packageJson.name}  v${packageJson.version}\n${packageJson.description}\n\nLicense: ${packageJson.license}`)
    setActiveMenu(null)
  }

  const menus: MenuGroup[] = [
    {
      name: 'File',
      items: [
        { label: 'Open File...', shortcut: 'Ctrl+O', action: handleOpenFile },
        { label: 'Open Sample Text...', shortcut: '', action: handleOpenMockText },
        { label: 'Open Project...', shortcut: 'Ctrl+Shift+O', action: handleOpenProject },
        { type: 'separator' },
        { label: 'Save Project', shortcut: 'Ctrl+S', action: handleSaveProject },
        { label: 'Export...', shortcut: 'Ctrl+E', action: handleExport },
        { type: 'separator' },
        { label: 'Close', shortcut: 'Ctrl+W', action: handleClose },
        { label: 'Exit', shortcut: 'Alt+F4', action: () => window.close() },
      ]
    },
    {
      name: 'Edit',
      items: [
        { label: 'Undo', shortcut: 'Ctrl+Z', action: handleUndo },
        { label: 'Redo', shortcut: 'Ctrl+Y', action: handleRedo },
        { type: 'separator' },
        { label: 'Find...', shortcut: 'Ctrl+F', action: handleFind },
        { label: 'Rename Symbol', shortcut: 'N', action: handleRename },
        { label: 'Add Comment', shortcut: ';', action: handleNotImplemented },
        { type: 'separator' },
        { label: 'Preferences...', shortcut: '', action: handleNotImplemented },
      ]
    },
    {
      name: 'View',
      items: [
        { label: 'Text View', shortcut: '', action: () => handleViewMode('text') },
        { label: 'Graph View', shortcut: '', action: () => handleViewMode('graph') },
        { label: 'Mixed View', shortcut: '', action: () => handleViewMode('mixed') },
        { type: 'separator' },
        { label: 'Show Address', shortcut: '', action: handleNotImplemented },
        { label: 'Show Bytecode', shortcut: '', action: handleNotImplemented },
        { label: 'Show Comments', shortcut: '', action: handleNotImplemented },
        { type: 'separator' },
        { label: 'Reset Layout', shortcut: '', action: handleNotImplemented },
      ]
    },
    {
      name: 'Analyze',
      items: [
        { label: 'Decompile', shortcut: 'F5', action: handleMenuDecompile },
        { label: 'Full Analysis', shortcut: '', action: handleAnalyzeAll, disabled: true },
        { label: 'Analyze Current Function', shortcut: '', action: handleAnalyzeFunction, disabled: true },
        { type: 'separator' },
        { label: 'Auto Analysis', shortcut: '', action: handleNotImplemented, disabled: true },
        { label: 'Type Inference', shortcut: '', action: handleNotImplemented, disabled: true },
        { label: 'Stack Frame Analysis', shortcut: '', action: handleNotImplemented, disabled: true },
        { type: 'separator' },
        { label: 'String Decryption', shortcut: '', action: handleNotImplemented, disabled: true },
        { label: 'Script Execution...', shortcut: '', action: handleNotImplemented, disabled: true },
      ]
    },
    {
      name: 'Tools',
      items: [
        { label: 'String Search', shortcut: 'Shift+F12', action: handleSearchStrings },
        { label: 'Function Search', shortcut: 'Ctrl+F12', action: handleSearchFunctions },
        { type: 'separator' },
        { label: 'Go to Address...', shortcut: 'G', action: handleGotoAddress },
        { label: 'Go to Entry Point', shortcut: '', action: handleNotImplemented },
        { type: 'separator' },
        { label: 'Hex Editor', shortcut: '', action: handleNotImplemented },
        { label: 'Signature Management', shortcut: '', action: handleNotImplemented },
        { type: 'separator' },
        { label: 'Script Console', shortcut: '', action: handleNotImplemented },
      ]
    },
    {
      name: 'Window',
      items: [
        { label: 'File Explorer', shortcut: '', action: handleNotImplemented },
        { label: 'Function List', shortcut: '', action: handleNotImplemented },
        { label: 'Symbol Table', shortcut: '', action: handleNotImplemented },
        { label: 'Strings', shortcut: '', action: handleNotImplemented, disabled: true },
        { label: 'Xref', shortcut: '', action: handleNotImplemented, disabled: true },
        { type: 'separator' },
        { label: 'Output Window', shortcut: '', action: handleNotImplemented },
      ]
    },
    {
      name: 'Settings',
      items: [
        { label: 'Tool Paths...', shortcut: '', action: openToolConfig },
        { type: 'separator' },
        { label: 'Set Working Directory...', shortcut: '', action: openWorkspaceConfig },
      ]
    },
    {
      name: 'AI',
      items: [
        { label: 'AI Copilot Panel (Coming Soon)', shortcut: '', action: handleNotImplemented, disabled: true },
        { type: 'separator' },
        { label: 'MCP Server Hub', shortcut: '', action: handleNotImplemented, disabled: true },
        { label: 'Skills Marketplace', shortcut: '', action: handleNotImplemented, disabled: true },
        { label: 'Prompt Library', shortcut: '', action: handleNotImplemented, disabled: true },
        { type: 'separator' },
        { label: 'Agent Workflows', shortcut: '', action: handleNotImplemented, disabled: true },
        { label: 'RAG Knowledge Base', shortcut: '', action: handleNotImplemented, disabled: true },
        { label: 'Local LLM Provider', shortcut: '', action: handleNotImplemented, disabled: true },
      ]
    },
    {
      name: 'Plugins',
      items: [
        { label: 'Plugin Manager (Coming Soon)', shortcut: '', action: handleNotImplemented, disabled: true },
      ]
    },
    {
      name: 'Debugger',
      items: [
        { label: 'Debugger (Coming Soon)', shortcut: '', action: handleNotImplemented, disabled: true },
      ]
    },
    {
      name: 'Help',
      items: [
        { label: 'Documentation', shortcut: 'F1', action: handleNotImplemented, disabled: true },
        { label: 'Shortcuts', shortcut: '', action: handleNotImplemented, disabled: true },
        { type: 'separator' },
        { label: 'Check for Updates...', shortcut: '', action: handleNotImplemented, disabled: true },
        { label: 'About', shortcut: '', action: handleAbout },
      ]
    },
  ]

  return (
    <>
      <div className="menu-bar" ref={menuBarRef}>
        {menus.map((menu) => {
          const menuDisabled = menu.name !== 'Analyze' && menu.name !== 'Settings' && menu.name !== 'AI' && menu.name !== 'Help'
          return (
          <div
            key={menu.name}
            style={{ position: 'relative' }}
            onMouseLeave={() => {
              if (activeMenu === menu.name) {
                setActiveMenu(null)
              }
            }}
          >
            <div
              className={`menu-item${menuDisabled ? ' disabled' : ''}`}
              onClick={menuDisabled ? undefined : () => handleMenuClick(menu.name)}
              style={{ backgroundColor: !menuDisabled && activeMenu === menu.name ? 'var(--bg-hover)' : 'transparent' }}
            >
              {menu.name}
            </div>
            {!menuDisabled && activeMenu === menu.name && (
              <div className="context-menu" style={{ top: '100%', left: 0, minWidth: 200 }}>
                {menu.items.map((item, index) => (
                  item.type === 'separator' ? (
                    <div key={index} className="context-menu-separator" />
                  ) : (
                    <div
                      key={index}
                      className={`context-menu-item${item.disabled ? ' disabled' : ''}`}
                      onClick={item.disabled ? undefined : () => {
                        void item.action()
                      }}
                    >
                      <span style={{ flex: 1 }}>{item.label}</span>
                      {item.shortcut && (
                        <span style={{ color: 'var(--text-secondary)', fontSize: '11px', marginLeft: 24 }}>
                          {item.shortcut}
                        </span>
                      )}
                    </div>
                  )
                ))}
              </div>
            )}
          </div>
          )
        })}
      </div>

      <Suspense fallback={null}>
        <ToolConfigModal
          isOpen={isToolConfigOpen}
          onClose={() => setIsToolConfigOpen(false)}
          initialSection={toolConfigSection}
        />
      </Suspense>
    </>
  )
}

export default MenuBar