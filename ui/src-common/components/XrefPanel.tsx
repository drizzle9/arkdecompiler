import React, { useState, useMemo } from 'react'
import { useAppStore } from '../store/useAppStore'
import { Reference, ReferenceType } from '../types'
import { GitBranch, ArrowUpRight, ArrowDownRight, Search } from 'lucide-react'

const XrefPanel: React.FC = () => {
  const { currentFile, viewState, setCurrentAddress } = useAppStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<ReferenceType | 'all'>('all')

  const allXrefs = useMemo(() => {
    if (!currentFile) return []
    const disassemblyText = currentFile.disassemblyOutput || ''
    if (!disassemblyText.trim()) return []

    const lines = disassemblyText.split(/\r?\n/)
    const baseAddress = currentFile.sections?.[0]?.virtualAddress ?? 0x401000
    const refs: Reference[] = []
    const labelAddressMap = new Map<string, number>()
    const functionAddressMap = new Map<string, number>()
    const maxAddress = baseAddress + Math.max(0, lines.length - 1)

    const normalizeToken = (token: string): string => token.trim().replace(/[;,]+$/g, '')
    const toAddress = (lineIndex: number) => baseAddress + lineIndex

    // Build label/function -> address map first
    lines.forEach((line, lineIndex) => {
      const trimmed = line.trim()
      if (!trimmed) return

      const labelMatch = trimmed.match(/^([A-Za-z_][\w.$#^]*)\s*:\s*$/)
      if (labelMatch) {
        labelAddressMap.set(labelMatch[1], toAddress(lineIndex))
      }

      const functionMatch = trimmed.match(/^\.function\s+.+?\s+([^\s(]+)\s*\(/i)
      if (functionMatch) {
        functionAddressMap.set(functionMatch[1], toAddress(lineIndex))
      }
    })

    currentFile.functions.forEach((func) => {
      functionAddressMap.set(func.name, func.address)
    })

    const addRef = (
      fromAddress: number,
      toAddressValue: number,
      type: ReferenceType,
      instruction: string,
      idSuffix: string
    ) => {
      refs.push({
        id: `xref-${fromAddress}-${toAddressValue}-${type}-${idSuffix}`,
        fromAddress,
        toAddress: toAddressValue,
        type,
        instruction
      })
    }

    lines.forEach((line, lineIndex) => {
      const fromAddress = toAddress(lineIndex)
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('.') || trimmed.endsWith(':')) return

      // Jump-like references to labels
      const jumpMatch = trimmed.match(/\b(?:jmp|jnez|jeqz|jz|jnz|jez|goto|br)\s+([A-Za-z_][\w.$#^]*)\b/i)
      if (jumpMatch) {
        const target = normalizeToken(jumpMatch[1])
        const targetAddress = labelAddressMap.get(target)
        if (typeof targetAddress === 'number') {
          addRef(fromAddress, targetAddress, 'jump', trimmed, `jump-${lineIndex}`)
        }
      }

      // Call-like references by symbol name (definefunc/call/invoke)
      const defineFuncMatch = trimmed.match(/\bdefinefunc\b[^,]*,\s*([^,\s]+)\s*:/i)
      if (defineFuncMatch) {
        const funcName = normalizeToken(defineFuncMatch[1])
        const targetAddress = functionAddressMap.get(funcName)
        if (typeof targetAddress === 'number') {
          addRef(fromAddress, targetAddress, 'call', trimmed, `definefunc-${lineIndex}`)
        }
      }

      const callMatch = trimmed.match(/\b(?:call|calli|invoke\w*|bl)\s+([A-Za-z_#][^,\s]*)/i)
      if (callMatch) {
        const funcName = normalizeToken(callMatch[1])
        const targetAddress = functionAddressMap.get(funcName) ?? labelAddressMap.get(funcName)
        if (typeof targetAddress === 'number') {
          addRef(fromAddress, targetAddress, 'call', trimmed, `call-${lineIndex}`)
        }
      }

      // String references by literal value
      const stringMatches = [...trimmed.matchAll(/"([^"]+)"/g)]
      stringMatches.forEach((match, idx) => {
        const literal = match[1]
        const stringInfo = currentFile.strings.find((s) => s.value === literal)
        if (stringInfo) {
          addRef(fromAddress, stringInfo.address, 'string', trimmed, `string-${lineIndex}-${idx}`)
        }
      })

      // Offset references when line contains absolute hex address in current pseudo-address range
      const hexMatches = [...trimmed.matchAll(/\b0x([0-9a-fA-F]+)\b/g)]
      hexMatches.forEach((match, idx) => {
        const value = Number.parseInt(match[1], 16)
        if (!Number.isNaN(value) && value >= baseAddress && value <= maxAddress) {
          addRef(fromAddress, value, 'offset', trimmed, `offset-${lineIndex}-${idx}`)
        }
      })
    })

    // Deduplicate by (from,to,type,instruction)
    const uniq = new Map<string, Reference>()
    refs.forEach((ref) => {
      const key = `${ref.fromAddress}|${ref.toAddress}|${ref.type}|${ref.instruction || ''}`
      if (!uniq.has(key)) uniq.set(key, ref)
    })
    return [...uniq.values()]
  }, [currentFile])

  // Get cross-references for current address
  const xrefs = useMemo(() => {
    if (!viewState.currentAddress) return []
    return allXrefs.filter((ref) => (
      ref.fromAddress === viewState.currentAddress || ref.toAddress === viewState.currentAddress
    ))
  }, [allXrefs, viewState.currentAddress])

  // Filter cross-references
  const filteredXrefs = useMemo(() => {
    let result = [...xrefs]
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(ref =>
        ref.instruction?.toLowerCase().includes(query) ||
        ref.fromAddress.toString(16).includes(query) ||
        ref.toAddress.toString(16).includes(query)
      )
    }
    
    // Type filter
    if (filterType !== 'all') {
      result = result.filter(ref => ref.type === filterType)
    }
    
    return result
  }, [xrefs, searchQuery, filterType])

  const handleXrefClick = (ref: Reference) => {
    // When browsing xrefs of current address, clicking jumps to the opposite side.
    if (viewState.currentAddress === ref.fromAddress) {
      setCurrentAddress(ref.toAddress)
    } else {
      setCurrentAddress(ref.fromAddress)
    }
  }

  const formatAddress = (address: number): string => {
    return `0x${address.toString(16).toUpperCase().padStart(8, '0')}`
  }

  const getReferenceTypeIcon = (type: ReferenceType) => {
    switch (type) {
      case 'call':
        return <ArrowDownRight size={12} style={{ color: 'var(--success-color)' }} />
      case 'jump':
        return <ArrowUpRight size={12} style={{ color: 'var(--warning-color)' }} />
      case 'data':
        return <span style={{ color: 'var(--variable-color)', fontSize: 10 }}>D</span>
      case 'string':
        return <span style={{ color: 'var(--string-color)', fontSize: 10 }}>S</span>
      case 'offset':
        return <span style={{ color: 'var(--number-color)', fontSize: 10 }}>O</span>
    }
  }

  const getReferenceTypeLabel = (type: ReferenceType): string => {
    const labels: Record<ReferenceType, string> = {
      call: 'Call',
      jump: 'Jump',
      data: 'Data',
      string: 'String',
      offset: 'Offset'
    }
    return labels[type]
  }

  // If no file is open
  if (!currentFile) {
    return (
      <div className="panel" style={{ height: '100%', minHeight: 0 }}>
        <div className="panel-header">
          <GitBranch size={14} style={{ marginRight: 6 }} />
          Xref
        </div>
        <div className="panel-content" style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: 'var(--text-secondary)',
          padding: '20px'
        }}>
          <GitBranch size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
          <p style={{ textAlign: 'center', fontSize: 12 }}>
            Open an .abc file to view Cross References
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="panel" style={{ height: '100%', minHeight: 0 }}>
      <div className="panel-header">
        <GitBranch size={14} style={{ marginRight: 6 }} />
        Xref
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-secondary)' }}>
          {filteredXrefs.length} refs
        </span>
      </div>
      
      {/* Current address */}
      {viewState.currentAddress !== 0 && (
        <div style={{ 
          padding: '4px 8px',
          backgroundColor: 'var(--bg-tertiary)',
          borderBottom: '1px solid var(--border-color)',
          fontSize: 11
        }}>
          <span style={{ color: 'var(--text-secondary)' }}>Address: </span>
          <span style={{ color: 'var(--number-color)', fontFamily: 'Consolas, monospace' }}>
            {formatAddress(viewState.currentAddress)}
          </span>
        </div>
      )}

      {/* Search and filter */}
      <div style={{ 
        padding: '8px', 
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        gap: '4px'
      }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={12} style={{ 
            position: 'absolute', 
            left: 8, 
            top: '50%', 
            transform: 'translateY(-50%)',
            color: 'var(--text-secondary)'
          }} />
          <input
            type="text"
            className="search-input"
            placeholder="Search references..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', paddingLeft: 24 }}
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as ReferenceType | 'all')}
          style={{
            padding: '4px 8px',
            fontSize: 11,
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
            borderRadius: 4
          }}
        >
          <option value="all">All</option>
          <option value="call">Call</option>
          <option value="jump">Jump</option>
          <option value="data">Data</option>
          <option value="string">String</option>
          <option value="offset">Offset</option>
        </select>
      </div>

      {/* Xref list */}
      <div className="panel-content" style={{ flex: 1, minHeight: 0, overflowX: 'hidden', overflowY: 'auto' }}>
        {filteredXrefs.length === 0 ? (
          <div style={{ 
            padding: '20px', 
            textAlign: 'center', 
            color: 'var(--text-secondary)',
            fontSize: 12
          }}>
            {viewState.currentAddress === 0 
              ? 'Select an address to view Xref'
              : 'No Xref found'}
          </div>
        ) : (
          filteredXrefs.map(ref => (
            <div
              key={ref.id}
              className="list-item"
              onClick={() => handleXrefClick(ref)}
              style={{ 
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: '2px',
                cursor: 'pointer'
              }}
            >
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                width: '100%',
                gap: '8px'
              }}>
                {getReferenceTypeIcon(ref.type)}
                <span style={{ 
                  flex: 1,
                  fontFamily: 'Consolas, monospace',
                  fontSize: 11
                }}>
                  <span style={{ color: 'var(--number-color)' }}>
                    {formatAddress(ref.fromAddress)}
                  </span>
                  <span style={{ color: 'var(--text-secondary)', margin: '0 4px' }}>→</span>
                  <span style={{ color: 'var(--number-color)' }}>
                    {formatAddress(ref.toAddress)}
                  </span>
                </span>
                <span style={{ 
                  fontSize: 10,
                  padding: '1px 4px',
                  backgroundColor: 'var(--bg-tertiary)',
                  borderRadius: 2,
                  color: 'var(--text-secondary)'
                }}>
                  {getReferenceTypeLabel(ref.type)}
                </span>
              </div>
              {ref.instruction && (
                <div style={{ 
                  width: '100%',
                  paddingLeft: 20,
                  fontFamily: 'Consolas, monospace',
                  fontSize: 10,
                  color: 'var(--text-secondary)'
                }}>
                  {ref.instruction}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default XrefPanel