import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useAppStore } from '../store/useAppStore'
import { Tab } from '../types'
import { X, Code, FileCode, FolderOpen, FileText, Search } from 'lucide-react'
import { openAbcFile } from '../services/file-actions'

interface MainEditorProps {
  mode?: 'disasm' | 'decompile'
}

type DecompileLanguage = 'javascript' | 'typescript'
type SyntaxHighlighterComponent = React.ComponentType<{
  language?: string
  style?: Record<string, unknown>
  wrapLongLines?: boolean
  customStyle?: React.CSSProperties
  codeTagProps?: Record<string, unknown>
  children?: React.ReactNode
}>

const detectDecompileLanguage = (fileFormat: string | undefined, code: string): DecompileLanguage => {
  if (fileFormat === 'ABC') {
    return 'typescript'
  }

  if (
    /@(Entry|Component|State|Prop|Link|Provide|Consume|Builder|Styles)\b/.test(code) ||
    /@ohos\./i.test(code)
  ) {
    return 'typescript'
  }

  return 'javascript'
}

const MainEditor: React.FC<MainEditorProps> = ({ mode = 'disasm' }) => {
  const {
    viewState,
    removeTab,
    setActiveTab,
    currentFile,
    setCurrentAddress
  } = useAppStore()
  const [editorContent, setEditorContent] = useState<string>('')
  const [SyntaxHighlighter, setSyntaxHighlighter] = useState<SyntaxHighlighterComponent | null>(null)
  const [syntaxStyle, setSyntaxStyle] = useState<Record<string, unknown> | null>(null)
  const editorRef = useRef<HTMLTextAreaElement>(null)

  const { openTabs, selectedTab, currentFunction, currentAddress, viewMode } = viewState

  const decompileLanguage = useMemo<DecompileLanguage>(() => {
    if (mode !== 'decompile') return 'javascript'
    return detectDecompileLanguage(currentFile?.format, editorContent)
  }, [mode, currentFile?.format, editorContent])

  useEffect(() => {
    if (mode !== 'decompile') return
    let cancelled = false
    ;(async () => {
      const [{ default: PrismAsyncLight }, { default: langJs }, { default: langTs }, { vscDarkPlus }] = await Promise.all([
        import('react-syntax-highlighter/dist/esm/prism-async-light'),
        import('react-syntax-highlighter/dist/esm/languages/prism/javascript'),
        import('react-syntax-highlighter/dist/esm/languages/prism/typescript'),
        import('react-syntax-highlighter/dist/esm/styles/prism')
      ])
      ;(PrismAsyncLight as unknown as { registerLanguage: (name: string, language: unknown) => void })
        .registerLanguage('javascript', langJs)
      ;(PrismAsyncLight as unknown as { registerLanguage: (name: string, language: unknown) => void })
        .registerLanguage('typescript', langTs)
      if (!cancelled) {
        setSyntaxHighlighter(() => PrismAsyncLight as unknown as SyntaxHighlighterComponent)
        setSyntaxStyle(vscDarkPlus as Record<string, unknown>)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [mode])

  // Get the display content of the current tab
  useEffect(() => {
    if (!currentFunction) {
      setEditorContent(mode === 'decompile' ? '// Select a function to start decompilation' : '// Select a function to view disassembly')
      return
    }

    const fileLevelOutput = mode === 'decompile'
      ? currentFile?.decompileOutput
      : currentFile?.disassemblyOutput

    if (typeof fileLevelOutput === 'string' && fileLevelOutput.trim().length > 0) {
      setEditorContent(fileLevelOutput)
      return
    }

    if (currentFunction.decompiledCode) {
      setEditorContent(currentFunction.decompiledCode)
      return
    }

    if (mode === 'decompile') {
      const mockCode = generateMockDecompiledCode(currentFunction)
      setEditorContent(mockCode)
    } else {
      setEditorContent('; Disassembly result is empty')
    }
  }, [currentFile, currentFunction, mode, viewMode])

  // Locate the corresponding position in disassembly text based on current address
  useEffect(() => {
    if (mode === 'decompile' || !currentFile || !currentFunction || !editorContent || !editorRef.current || !currentAddress) return

    const baseAddress = currentFile.sections?.[0]?.virtualAddress ?? currentFunction.address
    const lines = editorContent.split(/\r?\n/)
    if (lines.length === 0) return

    const rawLineIndex = currentAddress - baseAddress
    const lineIndex = Math.max(0, Math.min(rawLineIndex, lines.length - 1))

    let cursorOffset = 0
    for (let i = 0; i < lineIndex; i += 1) {
      cursorOffset += lines[i].length + 1
    }

    const textarea = editorRef.current
    const lineHeight = 21
    textarea.scrollTop = Math.max(0, (lineIndex - 2) * lineHeight)
    textarea.setSelectionRange(cursorOffset, cursorOffset)
  }, [mode, currentAddress, currentFile, currentFunction, editorContent])

  // Generate mock decompiled code
  const generateMockDecompiledCode = (func: typeof currentFunction): string => {
    if (!func) return ''
    
    const lines: string[] = []
    
    // Function signature
    lines.push(`// Function: ${func.name}`)
    lines.push(`// Address: 0x${func.address.toString(16).toUpperCase()}`)
    lines.push(`// Size: ${func.size} bytes`)
    lines.push('')
    
    // Function definition
    const params = func.parameters.map(p => `${p.type} ${p.name}`).join(', ')
    lines.push(`${func.signature.returnType} ${func.name}(${params}) {`)
    
    // Local variables
    if (func.localVariables.length > 0) {
      lines.push('    // Local variables')
      func.localVariables.forEach(v => {
        lines.push(`    ${v.type} ${v.name}; // offset: ${v.offset}`)
      })
      lines.push('')
    }
    
    // Simulated function body
    lines.push('    // TODO: Decompiled code will appear here')
    lines.push('    // Engine integration pending')
    lines.push('')
    lines.push('    // This is a placeholder for the decompiled code.')
    lines.push('    // The actual decompilation will be done by the engine.')
    lines.push('')
    lines.push('    // Variables and control flow will be reconstructed')
    lines.push('    // from the binary analysis.')
    lines.push('')
    
    // Return statement
    if (func.signature.returnType !== 'void') {
      lines.push('    return 0;')
    }
    lines.push('}')
    
    return lines.join('\n')
  }

  const handleTabClick = (tab: Tab) => {
    setActiveTab(tab.id)
  }

  const handleTabClose = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation()
    removeTab(tabId)
  }

  const handleOpenFile = async () => {
    await openAbcFile()
  }

  const getTabIcon = (type: string) => {
    switch (type) {
      case 'decompiler':
        return <Code size={14} style={{ color: 'var(--success-color)' }} />
      case 'disassembly':
        return <FileCode size={14} style={{ color: 'var(--warning-color)' }} />
      case 'hex':
        return <FileText size={14} style={{ color: 'var(--number-color)' }} />
      default:
        return <FileText size={14} />
    }
  }

  // If no file is open
  if (!currentFile) {
    return (
      <div className="panel" style={{ height: '100%', minHeight: 0 }}>
        <div className="tab-bar" style={{ minHeight: 35 }}>
          {/* Empty tab bar */}
        </div>
        <div style={{ 
          flex: 1,
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: 'var(--text-secondary)',
          padding: '40px'
        }}>
          <FileCode size={64} style={{ marginBottom: 16, opacity: 0.3 }} />
          <h3 style={{ marginBottom: 8, fontWeight: 'normal' }}>Welcome to Ark Bytecode Decompiler</h3>
          <p style={{ textAlign: 'center', fontSize: 12, maxWidth: 400 }}>
            Open a HarmonyOS .abc file to start analysis. Ark Bytecode (.abc) files from HarmonyOS applications are supported.
          </p>
          <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
            <button className="btn" onClick={handleOpenFile}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <FolderOpen size={14} />
                Open File
              </span>
            </button>
          </div>
          <div style={{ marginTop: 32, fontSize: 11, color: 'var(--text-secondary)' }}>
            <p>Shortcuts:</p>
            <ul style={{ marginTop: 8, lineHeight: 1.8 }}>
              <li>F5 - Decompile</li>
            </ul>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="panel" style={{ height: '100%', minHeight: 0 }}>
      {/* Tab bar */}
      <div className="tab-bar">
        {openTabs.length === 0 ? (
          <div style={{ 
            padding: '0 12px',
            display: 'flex',
            alignItems: 'center',
            color: 'var(--text-secondary)',
            fontSize: 12
          }}>
            {currentFile.name}
          </div>
        ) : (
          openTabs.map(tab => (
            <div
              key={tab.id}
              className={`tab ${selectedTab === tab.id ? 'active' : ''}`}
              onClick={() => handleTabClick(tab)}
            >
              {getTabIcon(tab.type)}
              <span style={{ marginLeft: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {tab.name}
              </span>
              {tab.isDirty && <span style={{ marginLeft: 4, color: 'var(--warning-color)' }}>●</span>}
              <div className="tab-close" onClick={(e) => handleTabClose(e, tab.id)}>
                <X size={12} />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Editor content */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {currentFunction ? (
          <>
            {/* Function info bar */}
            <div style={{ 
              padding: '4px 12px',
              backgroundColor: 'var(--bg-tertiary)',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              fontSize: 12
            }}>
              <span style={{ color: 'var(--success-color)', fontWeight: 500 }}>
                {currentFunction.name}
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>
                0x{currentFunction.address.toString(16).toUpperCase()}
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>
                {currentFunction.size} bytes
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>
                {currentFunction.basicBlocks.length} blocks
              </span>
              {mode === 'decompile' && (
                <span style={{ color: 'var(--text-secondary)' }}>
                  Syntax: {decompileLanguage === 'typescript' ? 'ARKTS' : 'JS'}
                </span>
              )}
              <span style={{ marginLeft: 'auto', color: 'var(--text-secondary)' }}>
                View: {viewMode === 'graph' ? 'Graph' : viewMode === 'text' ? 'Text' : 'Mixed'}
              </span>
            </div>

            {/* Code editor */}
            {mode === 'decompile' ? (
              SyntaxHighlighter && syntaxStyle ? (
                <SyntaxHighlighter
                  language={decompileLanguage}
                  style={syntaxStyle}
                  wrapLongLines={false}
                  customStyle={{
                    flex: 1,
                    minHeight: 0,
                    width: '100%',
                    margin: 0,
                    padding: '12px',
                    border: 'none',
                    outline: 'none',
                    background: 'var(--bg-primary)',
                    overflowX: 'auto',
                    overflowY: 'auto',
                    fontFamily: 'Consolas, "Courier New", monospace',
                    fontSize: '13px',
                    lineHeight: 1.6,
                    whiteSpace: 'pre',
                    tabSize: 4
                  }}
                  codeTagProps={{
                    style: {
                      fontFamily: 'Consolas, "Courier New", monospace'
                    }
                  }}
                >
                  {editorContent}
                </SyntaxHighlighter>
              ) : (
                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    width: '100%',
                    overflowX: 'auto',
                    overflowY: 'auto',
                    padding: '12px',
                    color: 'var(--text-secondary)',
                    fontFamily: 'Consolas, "Courier New", monospace',
                    fontSize: 12,
                    backgroundColor: 'var(--bg-primary)'
                  }}
                >
                  Loading syntax highlighter...
                </div>
              )
            ) : (
              <textarea
                ref={editorRef}
                readOnly
                value={editorContent}
                className="code-editor"
                style={{
                  flex: 1,
                  minHeight: 0,
                  width: '100%',
                  resize: 'none',
                  overflowX: 'auto',
                  overflowY: 'auto',
                  padding: '12px',
                  border: 'none',
                  outline: 'none',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontFamily: 'Consolas, "Courier New", monospace',
                  fontSize: 13,
                  lineHeight: 1.6,
                  whiteSpace: 'pre',
                  tabSize: 4
                }}
              />
            )}
          </>
        ) : (
          <div style={{ 
            flex: 1,
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: 'var(--text-secondary)'
          }}>
            <Search size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
            <p style={{ fontSize: 12 }}>Select a function from the function list to view decompiled code</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default MainEditor