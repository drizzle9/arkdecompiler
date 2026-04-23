import React, { useEffect, useState } from 'react'
import {
  ToolConfigData,
  ToolConfigResponse,
  getToolConfigFromRuntime,
  saveToolConfigToRuntime,
  toErrorMessage
} from '../services/runtime-adapter'
import { useAppStore } from '../store/useAppStore'

interface ToolConfigModalProps {
  isOpen: boolean
  onClose: () => void
  initialSection?: 'arkDisasm' | 'arkDecompile' | 'workspace'
}

const emptyConfig: ToolConfigData = {
  arkDisasm: { win32: '', linux: '', darwin: '' },
  arkDecompile: { win32: '', linux: '', darwin: '' },
  workspaceRoot: ''
}

const ToolConfigModal: React.FC<ToolConfigModalProps> = ({ isOpen, onClose, initialSection = 'arkDisasm' }) => {
  const { addOutputLog, setError } = useAppStore()
  const [config, setConfig] = useState<ToolConfigData>(emptyConfig)
  const [configPath, setConfigPath] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState('')
  const disasmRef = React.useRef<HTMLDivElement | null>(null)
  const decompileRef = React.useRef<HTMLDivElement | null>(null)
  const workspaceRef = React.useRef<HTMLDivElement | null>(null)

  const loadConfig = async () => {
    setIsLoading(true)
    setMessage('')
    try {
      const loaded: ToolConfigResponse = await getToolConfigFromRuntime()
      setConfig({
        arkDisasm: loaded.arkDisasm,
        arkDecompile: loaded.arkDecompile,
        workspaceRoot: loaded.workspaceRoot || ''
      })
      setConfigPath(loaded.configPath || '')
    } catch (err) {
      const msg = toErrorMessage(err)
      setMessage(msg)
      setError(msg)
      addOutputLog('error', 'Failed to load tool config', msg)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!isOpen) return
    void loadConfig()
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || isLoading) return
    const timer = window.setTimeout(() => {
      if (initialSection === 'arkDecompile') {
        decompileRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      } else if (initialSection === 'workspace') {
        workspaceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      } else {
        disasmRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 80)
    return () => window.clearTimeout(timer)
  }, [initialSection, isLoading, isOpen])

  const updateField = (
    section: 'arkDisasm' | 'arkDecompile',
    platform: 'win32' | 'linux' | 'darwin',
    value: string
  ) => {
    setConfig((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [platform]: value
      }
    }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    setMessage('')
    try {
      const saved = await saveToolConfigToRuntime(config)
      setConfigPath(saved.configPath || configPath)
      setMessage('Saved successfully.')
      addOutputLog('success', 'Tool config saved', `configPath=${saved.configPath}`)
    } catch (err) {
      const msg = toErrorMessage(err)
      setMessage(msg)
      setError(msg)
      addOutputLog('error', 'Failed to save tool config', msg)
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '6px 8px',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-primary)',
    borderRadius: 4,
    fontSize: 12,
    fontFamily: 'Consolas, "Courier New", monospace'
  }

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: 12,
    color: 'var(--text-secondary)',
    marginBottom: 6
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 'min(980px, 92vw)',
          maxHeight: '88vh',
          overflow: 'auto',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 8,
          padding: 16
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Tool Settings</div>
          <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-secondary)' }}>
            {configPath ? `Config: ${configPath}` : 'Config path pending'}
          </div>
        </div>

        {isLoading ? (
          <div style={{ padding: '18px 0', color: 'var(--text-secondary)', fontSize: 12 }}>
            Loading config...
          </div>
        ) : (
          <>
            <div ref={disasmRef} style={{ ...sectionTitleStyle }}>Ark Disasm</div>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 8, marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>win32</label>
              <input style={inputStyle} value={config.arkDisasm.win32} onChange={(e) => updateField('arkDisasm', 'win32', e.target.value)} />
              <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>linux</label>
              <input style={inputStyle} value={config.arkDisasm.linux} onChange={(e) => updateField('arkDisasm', 'linux', e.target.value)} />
              <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>darwin</label>
              <input style={inputStyle} value={config.arkDisasm.darwin} onChange={(e) => updateField('arkDisasm', 'darwin', e.target.value)} />
            </div>

            <div ref={decompileRef} style={{ ...sectionTitleStyle }}>Ark Decompile</div>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 8, marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>win32</label>
              <input style={inputStyle} value={config.arkDecompile.win32} onChange={(e) => updateField('arkDecompile', 'win32', e.target.value)} />
              <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>linux</label>
              <input style={inputStyle} value={config.arkDecompile.linux} onChange={(e) => updateField('arkDecompile', 'linux', e.target.value)} />
              <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>darwin</label>
              <input style={inputStyle} value={config.arkDecompile.darwin} onChange={(e) => updateField('arkDecompile', 'darwin', e.target.value)} />
            </div>

            <div ref={workspaceRef} style={{ ...sectionTitleStyle }}>Workspace Root (optional)</div>
            <input
              style={{ ...inputStyle, marginBottom: 10 }}
              value={config.workspaceRoot}
              onChange={(e) => setConfig((prev) => ({ ...prev, workspaceRoot: e.target.value }))}
            />

            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 12 }}>
              If tool path is invalid, set this page and click Save. Linux decompile can include env prefix
              (example: <code>LD_LIBRARY_PATH=/path/a:/path/b /path/to/xabc</code>).
            </div>
          </>
        )}

        {message && (
          <div style={{ fontSize: 12, color: 'var(--warning-color)', marginBottom: 10 }}>
            {message}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          <button className="btn btn-secondary" onClick={() => void loadConfig()} disabled={isLoading || isSaving}>
            Reload
          </button>
          <button className="btn" onClick={() => void handleSave()} disabled={isLoading || isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ToolConfigModal
