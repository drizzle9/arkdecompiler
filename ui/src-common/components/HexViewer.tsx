import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useAppStore } from '../store/useAppStore'
import { Database, AlertCircle } from 'lucide-react'
import { readFileBytesFromRuntime, isRuntimeReady } from '../services/runtime-adapter'

interface HexLine {
  offset: number
  bytes: number[]
  ascii: string
}

const HexViewer: React.FC = () => {
  const currentFile = useAppStore((state) => state.currentFile)
  const currentAddress = useAppStore((state) => state.viewState.currentAddress)
  const [selectedOffset, setSelectedOffset] = useState<number | null>(null)
  const [scrollOffset, setScrollOffset] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cacheVersion, setCacheVersion] = useState(0)
  const [isEnvironmentReady, setIsEnvironmentReady] = useState(false)
  const [isCheckingEnvironment, setIsCheckingEnvironment] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const environmentCheckRef = useRef<NodeJS.Timeout | null>(null)
  const requestIdRef = useRef(0)
  const pageCacheRef = useRef<Map<number, Uint8Array>>(new Map())
  const inFlightPagesRef = useRef<Map<number, Promise<void>>>(new Map())

  const bytesPerLine = 16
  const visibleLines = 50
  const preloadMarginLines = 180
  const lineHeight = 18
  const pageSize = 256 * 1024
  const maxCachedPages = 64
  const totalLines = currentFile ? Math.ceil(currentFile.size / bytesPerLine) : 0

  // Check for Tauri/Electron environment with retry logic
  useEffect(() => {
    const checkEnvironment = () => {
      const isReady = isRuntimeReady()
      setIsEnvironmentReady(isReady)
      
      if (isReady) {
        setIsCheckingEnvironment(false)
        if (environmentCheckRef.current) {
          clearInterval(environmentCheckRef.current)
          environmentCheckRef.current = null
        }
      }
    }

    // Initial check
    checkEnvironment()

    // If not ready, start polling
    if (!isEnvironmentReady) {
      setIsCheckingEnvironment(true)
      environmentCheckRef.current = setInterval(checkEnvironment, 100)

      // Timeout after 5 seconds
      const timeoutId = setTimeout(() => {
        if (environmentCheckRef.current) {
          clearInterval(environmentCheckRef.current)
          environmentCheckRef.current = null
        }
        setIsCheckingEnvironment(false)
      }, 5000)

      return () => {
        if (environmentCheckRef.current) {
          clearInterval(environmentCheckRef.current)
        }
        clearTimeout(timeoutId)
      }
    }
  }, [])

  const readPage = useCallback(
    async (filePath: string, fileSize: number, pageIndex: number, requestId: number) => {
      const pageStart = pageIndex * pageSize
      if (pageStart >= fileSize) return
      const pageReadSize = Math.min(pageSize, fileSize - pageStart)
      const chunk = await readFileBytesFromRuntime(filePath, pageStart, pageReadSize)
      if (requestId !== requestIdRef.current) return

      const cache = pageCacheRef.current
      // Refresh insertion order for LRU behavior.
      if (cache.has(pageIndex)) {
        cache.delete(pageIndex)
      }
      cache.set(pageIndex, chunk)
      while (cache.size > maxCachedPages) {
        const oldestKey = cache.keys().next().value as number | undefined
        if (oldestKey === undefined) break
        cache.delete(oldestKey)
      }
      setCacheVersion((v) => v + 1)
    },
    []
  )

  const ensureRangeLoaded = useCallback(
    async (rangeStart: number, rangeEnd: number) => {
      if (!currentFile || !isEnvironmentReady) return
      const start = Math.max(0, rangeStart)
      const end = Math.min(currentFile.size, Math.max(rangeEnd, rangeStart))
      if (end <= start) return

      const requestId = requestIdRef.current
      const firstPage = Math.floor(start / pageSize)
      const lastPage = Math.floor((end - 1) / pageSize)
      const tasks: Promise<void>[] = []
      const cache = pageCacheRef.current
      const inFlight = inFlightPagesRef.current

      for (let page = firstPage; page <= lastPage; page += 1) {
        if (cache.has(page)) continue
        const pending = inFlight.get(page)
        if (pending) {
          tasks.push(pending)
          continue
        }
        const loadingTask = readPage(currentFile.path, currentFile.size, page, requestId)
          .catch((err) => {
            const message = err instanceof Error ? err.message : String(err)
            setError(message)
            console.error('Failed to load page bytes:', err)
          })
          .finally(() => {
            inFlight.delete(page)
          })
        inFlight.set(page, loadingTask)
        tasks.push(loadingTask)
      }

      if (tasks.length === 0) return
      setIsLoading(true)
      await Promise.all(tasks)
      if (requestId === requestIdRef.current) {
        setIsLoading(false)
      }
    },
    [currentFile, isEnvironmentReady, readPage]
  )

  // Load file data when file or scroll offset changes
  useEffect(() => {
    if (!currentFile) {
      requestIdRef.current += 1
      pageCacheRef.current.clear()
      inFlightPagesRef.current.clear()
      setError(null)
      setScrollOffset(0)
      setCacheVersion((v) => v + 1)
      return
    }

    // Wait for environment to be ready
    if (!isEnvironmentReady) {
      // If we're still checking, don't show error yet
      if (isCheckingEnvironment) {
        return
      }
      // If checking is done and environment is not ready, show error
      setError('Hex viewer requires Tauri or Electron environment')
      return
    }

    requestIdRef.current += 1
    pageCacheRef.current.clear()
    inFlightPagesRef.current.clear()
    setCacheVersion((v) => v + 1)
    setScrollOffset(0)
    setError(null)
    if (containerRef.current) {
      containerRef.current.scrollTop = 0
    }
    void ensureRangeLoaded(0, (visibleLines + preloadMarginLines) * bytesPerLine)
  }, [currentFile, ensureRangeLoaded, isEnvironmentReady, isCheckingEnvironment])

  useEffect(() => {
    if (!currentFile || !isEnvironmentReady) return
    const rangeEnd = scrollOffset + (visibleLines + preloadMarginLines) * bytesPerLine
    void ensureRangeLoaded(scrollOffset, rangeEnd)
  }, [currentFile, isEnvironmentReady, scrollOffset, ensureRangeLoaded])

  const getByteAtOffset = useCallback(
    (offset: number): number | null => {
      if (!currentFile || offset < 0 || offset >= currentFile.size) {
        return null
      }
      const pageIndex = Math.floor(offset / pageSize)
      const page = pageCacheRef.current.get(pageIndex)
      if (!page) return null
      const indexInPage = offset - pageIndex * pageSize
      if (indexInPage < 0 || indexInPage >= page.length) return null
      return page[indexInPage]
    },
    [currentFile]
  )

  const computedHexLines = useMemo<HexLine[]>(() => {
    if (!currentFile) {
      return []
    }

    const lines: HexLine[] = []
    const baseAddress = currentFile.sections[0]?.virtualAddress || 0x00400000

    for (let i = 0; i < visibleLines; i++) {
      const lineStart = i * bytesPerLine
      const offset = scrollOffset + lineStart

      if (offset >= currentFile.size) break

      const bytes: number[] = []
      let ascii = ''

      for (let j = 0; j < bytesPerLine; j++) {
        const byteIndex = offset + j
        const byte = getByteAtOffset(byteIndex)
        if (byte === null) {
          bytes.push(0)
          ascii += ' '
        } else {
          bytes.push(byte)
          ascii += byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.'
        }
      }

      lines.push({ offset: baseAddress + offset, bytes, ascii })
    }

    return lines
  }, [currentFile, scrollOffset, cacheVersion, getByteAtOffset])

  // Highlight current address
  useEffect(() => {
    if (currentAddress && currentFile) {
      const baseAddress = currentFile.sections[0]?.virtualAddress || 0x00400000
      const relativeOffset = currentAddress - baseAddress
      if (relativeOffset >= 0) {
        setSelectedOffset(relativeOffset)
      }
    }
  }, [currentAddress, currentFile])

  const formatOffset = (offset: number): string => {
    return offset.toString(16).toUpperCase().padStart(8, '0')
  }

  const formatByte = (byte: number): string => {
    return byte.toString(16).toUpperCase().padStart(2, '0')
  }

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement
    const newOffset = Math.floor(target.scrollTop / lineHeight) * bytesPerLine
    setScrollOffset(prev => (prev === newOffset ? prev : newOffset))
  }

  const handleByteClick = (lineIndex: number, byteIndex: number) => {
    const offset = scrollOffset + lineIndex * bytesPerLine + byteIndex
    setSelectedOffset(offset)
    
    // TODO: Update current address
    // useAppStore.getState().setCurrentAddress(baseAddress + offset)
  }

  const firstVisibleLine = Math.floor(scrollOffset / bytesPerLine)
  const topSpacerHeight = firstVisibleLine * lineHeight
  const bottomSpacerLines = Math.max(0, totalLines - firstVisibleLine - computedHexLines.length)
  const bottomSpacerHeight = bottomSpacerLines * lineHeight

  // If no file is open
  if (!currentFile) {
    return (
      <div className="panel" style={{ height: '100%', minHeight: 0 }}>
        <div className="panel-header">
          <Database size={14} style={{ marginRight: 6 }} />
          Hex Viewer
        </div>
        <div className="panel-content" style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: 'var(--text-secondary)',
          padding: '20px'
        }}>
          <Database size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
          <p style={{ textAlign: 'center', fontSize: 12 }}>
            Open an .abc file to view hexadecimal data
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="panel" style={{ height: '100%', minHeight: 0, position: 'relative' }}>
      <div className="panel-header">
        <Database size={14} style={{ marginRight: 6 }} />
        Hex Viewer
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-secondary)' }}>
          {currentFile.size.toLocaleString()} bytes
        </span>
      </div>
      
      {/* Address and data information bar */}
      <div style={{ 
        padding: '4px 8px',
        backgroundColor: 'var(--bg-tertiary)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        fontSize: 10
      }}>
        <span>
          Base: <span style={{ color: 'var(--number-color)', fontFamily: 'Consolas, monospace' }}>
            {formatOffset(currentFile.sections[0]?.virtualAddress || 0x00400000)}
          </span>
        </span>
        <span>
          Size: <span style={{ color: 'var(--number-color)' }}>{currentFile.size.toLocaleString()}</span>
        </span>
        {selectedOffset !== null && (
          <span>
            Selected: <span style={{ color: 'var(--warning-color)', fontFamily: 'Consolas, monospace' }}>
              0x{selectedOffset.toString(16).toUpperCase()}
            </span>
          </span>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div style={{
          padding: '8px 12px',
          backgroundColor: 'var(--error-bg, #2d1f1f)',
          borderBottom: '1px solid var(--error-color)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: 11
        }}>
          <AlertCircle size={14} style={{ color: 'var(--error-color)', flexShrink: 0 }} />
          <span style={{ color: 'var(--error-color)' }}>{error}</span>
        </div>
      )}

      {/* Hexadecimal content */}
      <div
        ref={containerRef}
        className="panel-content hex-viewer"
        style={{
          flex: 1,
          minHeight: 0,
          overflowX: 'auto',
          overflowY: 'auto',
          fontFamily: 'Consolas, "Courier New", monospace',
          fontSize: 12,
          lineHeight: '18px',
          position: 'relative'
        }}
        onScroll={handleScroll}
      >
        {/* Column headers */}
        <div style={{
          position: 'sticky',
          top: 0,
          backgroundColor: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          padding: '4px',
          zIndex: 1
        }}>
          <div style={{ minWidth: '80px', color: 'var(--text-secondary)' }}>Offset</div>
          <div style={{
            minWidth: '480px',
            color: 'var(--text-secondary)',
            display: 'flex',
            gap: '3px'
          }}>
            {Array.from({ length: 16 }, (_, i) => (
              <span key={i} style={{ width: '23px', textAlign: 'center' }}>
                {i.toString(16).toUpperCase()}
              </span>
            ))}
          </div>
          <div style={{ color: 'var(--text-secondary)', marginLeft: '8px' }}>ASCII</div>
        </div>

        {/* Loading state */}
        {isLoading && computedHexLines.length === 0 && (
          <div style={{
            padding: '20px',
            textAlign: 'center',
            color: 'var(--text-secondary)'
          }}>
            Loading binary pages...
          </div>
        )}

        {/* Empty state when no data */}
        {!isLoading && !error && computedHexLines.length === 0 && (
          <div style={{
            padding: '20px',
            textAlign: 'center',
            color: 'var(--text-secondary)'
          }}>
            No data to display
          </div>
        )}

        {/* Hexadecimal lines */}
        {topSpacerHeight > 0 && <div style={{ height: `${topSpacerHeight}px` }} />}
        {computedHexLines.map((line, lineIndex) => {
          const lineOffset = scrollOffset + lineIndex * bytesPerLine
          return (
            <div key={line.offset} className="hex-line">
              {/* Offset */}
              <span className="hex-offset">
                {formatOffset(line.offset)}
              </span>
              
              {/* Bytes */}
              <span className="hex-bytes" style={{ display: 'flex', gap: '3px' }}>
                {line.bytes.map((byte, byteIndex) => {
                  const byteOffset = lineOffset + byteIndex
                  const isSelected = selectedOffset === byteOffset
                  return (
                    <span
                      key={byteIndex}
                      onClick={() => handleByteClick(lineIndex, byteIndex)}
                      style={{
                        width: '23px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        backgroundColor: isSelected ? 'var(--accent-color)' : 'transparent',
                        color: isSelected ? 'var(--text-active)' : (
                          byte === 0 ? 'var(--text-secondary)' : 
                          (byte >= 32 && byte <= 126) ? 'var(--number-color)' : 'var(--text-primary)'
                        )
                      }}
                    >
                      {formatByte(byte)}
                    </span>
                  )
                })}
              </span>
              
              {/* ASCII */}
              <span className="hex-ascii" style={{ marginLeft: '8px' }}>
                {line.ascii}
              </span>
            </div>
          )
        })}
        {bottomSpacerHeight > 0 && <div style={{ height: `${bottomSpacerHeight}px` }} />}
      </div>
    </div>
  )
}

export default HexViewer