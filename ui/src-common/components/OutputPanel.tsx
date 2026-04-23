import React, { useState, useRef, useEffect } from 'react'
import { Terminal, Eraser, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react'
import { useAppStore, OutputLogEntry } from '../store/useAppStore'

const OutputPanel: React.FC = () => {
  const outputLogs = useAppStore((state) => state.outputLogs)
  const clearOutputLogs = useAppStore((state) => state.clearOutputLogs)
  const [filter, setFilter] = useState<'all' | 'info' | 'success' | 'warning' | 'error'>('all')
  const outputRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [outputLogs])

  const clearLogs = () => {
    clearOutputLogs()
  }

  const logs = outputLogs
  const logCounts = React.useMemo(() => {
    return logs.reduce(
      (acc, log) => {
        acc.all += 1
        acc[log.type] += 1
        return acc
      },
      { all: 0, info: 0, success: 0, warning: 0, error: 0 }
    )
  }, [logs])
  const filteredLogs = React.useMemo(
    () => (filter === 'all' ? logs : logs.filter((log) => log.type === filter)),
    [logs, filter]
  )

  const getLogIcon = (type: OutputLogEntry['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle size={12} style={{ color: 'var(--success-color)' }} />
      case 'warning':
        return <AlertTriangle size={12} style={{ color: 'var(--warning-color)' }} />
      case 'error':
        return <AlertCircle size={12} style={{ color: 'var(--error-color)' }} />
      default:
        return <Info size={12} style={{ color: 'var(--text-secondary)' }} />
    }
  }

  const getLogColor = (type: OutputLogEntry['type']): string => {
    switch (type) {
      case 'success':
        return 'var(--success-color)'
      case 'warning':
        return 'var(--warning-color)'
      case 'error':
        return 'var(--error-color)'
      default:
        return 'var(--text-primary)'
    }
  }

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    })
  }

  const formatLogLine = (log: OutputLogEntry): string => {
    const timeText = formatTime(log.timestamp)
    const details = log.details ? `\n${log.details}` : ''
    return `[${timeText}] [${log.type.toUpperCase()}] ${log.message}${details}`
  }

  const handleExportLogs = () => {
    if (filteredLogs.length === 0) return
    const payload = filteredLogs.map(formatLogLine).join('\n\n')
    const blob = new Blob([payload], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const now = new Date()
    const pad = (v: number) => String(v).padStart(2, '0')
    const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
    const fileName = `arkdecompiler-output-${filter}-${timestamp}.txt`
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <Terminal size={14} style={{ marginRight: 6 }} />
        Output
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-secondary)' }}>
          {filteredLogs.length} logs
        </span>
        <button
          onClick={handleExportLogs}
          title="Export current logs as txt"
          style={{
            marginLeft: '8px',
            padding: '2px 6px',
            background: 'none',
            border: '1px solid var(--border-color)',
            borderRadius: 3,
            color: 'var(--text-secondary)',
            cursor: filteredLogs.length > 0 ? 'pointer' : 'not-allowed',
            opacity: filteredLogs.length > 0 ? 1 : 0.5,
            fontSize: 10
          }}
          disabled={filteredLogs.length === 0}
        >
          Export
        </button>
        <button
          onClick={clearLogs}
          title="Clear logs"
          style={{
            marginLeft: '8px',
            padding: '2px',
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <Eraser size={14} />
        </button>
      </div>

      {/* Filter */}
      <div style={{ 
        padding: '4px 8px',
        backgroundColor: 'var(--bg-tertiary)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        gap: '4px'
      }}>
        {[
          { key: 'all', label: 'All', count: logCounts.all },
          { key: 'info', label: 'Info', count: logCounts.info },
          { key: 'success', label: 'Success', count: logCounts.success },
          { key: 'warning', label: 'Warning', count: logCounts.warning },
          { key: 'error', label: 'Error', count: logCounts.error }
        ].map(item => (
          <button
            key={item.key}
            onClick={() => setFilter(item.key as typeof filter)}
            style={{
              padding: '2px 6px',
              fontSize: 10,
              border: '1px solid var(--border-color)',
              borderRadius: 2,
              backgroundColor: filter === item.key ? 'var(--accent-color)' : 'transparent',
              color: filter === item.key ? 'var(--text-active)' : 'var(--text-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            {item.label}
            {item.count > 0 && (
              <span style={{ 
                fontSize: 9, 
                opacity: 0.7 
              }}>
                ({item.count})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Log Output area */}
      <div 
        ref={outputRef}
        className="panel-content"
        style={{ 
          overflow: 'auto',
          fontFamily: 'Consolas, "Courier New", monospace',
          fontSize: 11,
          lineHeight: 1.5,
          padding: '4px 8px'
        }}
      >
        {filteredLogs.length === 0 ? (
          <div style={{ 
            padding: '20px', 
            textAlign: 'center', 
            color: 'var(--text-secondary)'
          }}>
            No logs
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div 
              key={log.id}
              style={{ 
                display: 'flex',
                alignItems: 'flex-start',
                gap: '6px',
                padding: '2px 0',
                borderBottom: '1px solid var(--border-color)'
              }}
            >
              {/* Timestamp */}
              <span style={{ 
                color: 'var(--text-secondary)',
                fontSize: 10,
                minWidth: '60px'
              }}>
                {formatTime(log.timestamp)}
              </span>
              
              {/* Icon */}
              <span style={{ marginTop: 1 }}>
                {getLogIcon(log.type)}
              </span>
              
              {/* Message */}
              <div style={{ flex: 1 }}>
                <span style={{ color: getLogColor(log.type) }}>
                  {log.message}
                </span>
                {log.details && (
                  <div style={{ 
                    marginTop: '2px',
                    paddingLeft: '8px',
                    color: 'var(--text-secondary)',
                    fontSize: 10,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    lineHeight: 1.35
                  }}>
                    {log.details}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default OutputPanel