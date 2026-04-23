import React, { useState, useMemo } from 'react'
import { useAppStore } from '../store/useAppStore'
import { Symbol, SymbolType, SymbolBinding } from '../types'
import { Hash, Search, Globe, Lock, Link } from 'lucide-react'

const SymbolPanel: React.FC = () => {
  const { currentFile, setCurrentAddress } = useAppStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [filterSection, setFilterSection] = useState<'all' | 'METHODS' | 'RECORDS'>('all')
  const [filterKind, setFilterKind] = useState<SymbolType | 'all'>('all')

  // Get symbol list (keep only METHODS / RECORDS)
  const symbols = useMemo(() => {
    if (!currentFile) return []
    return currentFile.symbols.filter(s => s.section === 'METHODS' || s.section === 'RECORDS')
  }, [currentFile])

  // Filter symbols
  const filteredSymbols = useMemo(() => {
    let result = [...symbols]
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(s => 
        s.name.toLowerCase().includes(query) ||
        s.address.toString(16).includes(query) ||
        (s.mangledName && s.mangledName.toLowerCase().includes(query))
      )
    }
    
    // Group filter (METHODS / RECORDS)
    if (filterSection !== 'all') {
      result = result.filter(s => s.section === filterSection)
    }

    // Symbol type filter (function / record)
    if (filterKind !== 'all') {
      result = result.filter(s => s.type === filterKind)
    }
    
    return result.sort((a, b) => a.address - b.address)
  }, [symbols, searchQuery, filterSection, filterKind])

  const handleSymbolClick = (symbol: Symbol) => {
    setCurrentAddress(symbol.address)
    // TODO: Call engine to jump to symbol
    console.log('Symbol selected - Engine integration pending:', symbol.name)
  }

  const formatAddress = (address: number): string => {
    return `0x${address.toString(16).toUpperCase().padStart(8, '0')}`
  }

  const getSymbolTypeIcon = (type: SymbolType) => {
    switch (type) {
      case 'function':
        return <span style={{ color: 'var(--function-color)' }}>ƒ</span>
      case 'object':
        return <span style={{ color: 'var(--variable-color)' }}>●</span>
      case 'section':
        return <span style={{ color: 'var(--warning-color)' }}>§</span>
      default:
        return <span style={{ color: 'var(--text-secondary)' }}>○</span>
    }
  }

  const getSymbolTypeLabel = (type: SymbolType): string => {
    const labels: Record<SymbolType, string> = {
      function: 'Function',
      object: 'Object',
      section: 'Section',
      file: 'File',
      notype: 'No type'
    }
    return labels[type]
  }

  const getBindingIcon = (binding: SymbolBinding) => {
    switch (binding) {
      case 'global':
        return <Globe size={10} style={{ color: 'var(--success-color)' }} />
      case 'local':
        return <Lock size={10} style={{ color: 'var(--text-secondary)' }} />
      case 'weak':
        return <Link size={10} style={{ color: 'var(--warning-color)' }} />
    }
  }

  // If no file, show placeholder
  if (!currentFile) {
    return (
      <div className="panel">
        <div className="panel-header">
          <Hash size={14} style={{ marginRight: 6 }} />
          Symbol Table
        </div>
        <div className="panel-content" style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: 'var(--text-secondary)',
          padding: '20px'
        }}>
          <Hash size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
          <p style={{ textAlign: 'center', fontSize: 12 }}>
            Open an .abc file to view Symbol Table
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <Hash size={14} style={{ marginRight: 6 }} />
        Symbol Table
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-secondary)' }}>
          {filteredSymbols.length} / {symbols.length}
        </span>
      </div>
      
      {/* Search and filter */}
      <div style={{ 
        padding: '8px', 
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px'
      }}>
        <div style={{ position: 'relative' }}>
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
            placeholder="Search symbols..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', paddingLeft: 24 }}
          />
        </div>
        
        {/* Filter buttons */}
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          <select
            value={filterSection}
            onChange={(e) => setFilterSection(e.target.value as 'all' | 'METHODS' | 'RECORDS')}
            style={{
              flex: 1,
              padding: '2px 4px',
              fontSize: 10,
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              borderRadius: 2
            }}
          >
            <option value="all">All Groups</option>
            <option value="METHODS">METHODS</option>
            <option value="RECORDS">RECORDS</option>
          </select>
          
          <select
            value={filterKind}
            onChange={(e) => setFilterKind(e.target.value as SymbolType | 'all')}
            style={{
              flex: 1,
              padding: '2px 4px',
              fontSize: 10,
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              borderRadius: 2
            }}
          >
            <option value="all">All Types</option>
            <option value="function">Function(METHOD)</option>
            <option value="object">Record(RECORD)</option>
          </select>
        </div>
      </div>

      {/* Symbol list */}
      <div className="panel-content" style={{ overflow: 'auto' }}>
        {filteredSymbols.length === 0 ? (
          <div style={{ 
            padding: '20px', 
            textAlign: 'center', 
            color: 'var(--text-secondary)',
            fontSize: 12
          }}>
            {searchQuery || filterSection !== 'all' || filterKind !== 'all'
              ? 'No matching symbols found'
              : 'No symbols found'}
          </div>
        ) : (
          filteredSymbols.map(symbol => (
            <div
              key={symbol.id}
              className="list-item"
              onClick={() => handleSymbolClick(symbol)}
              style={{ 
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: '2px',
                fontSize: 11
              }}
            >
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                width: '100%',
                gap: '6px'
              }}>
                {getBindingIcon(symbol.binding)}
                <span style={{ 
                  fontFamily: 'Consolas, monospace',
                  color: symbol.type === 'function' ? 'var(--function-color)' : 'var(--variable-color)'
                }}>
                  {symbol.name}
                </span>
                <span style={{ 
                  marginLeft: 'auto',
                  fontSize: 10,
                  color: 'var(--text-secondary)'
                }}>
                  {getSymbolTypeLabel(symbol.type)}
                </span>
              </div>
              <div style={{ 
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                paddingLeft: 16,
                gap: '8px'
              }}>
                <span style={{ 
                  color: 'var(--number-color)',
                  fontFamily: 'Consolas, monospace'
                }}>
                  {formatAddress(symbol.address)}
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  Size: {symbol.size}
                </span>
                {symbol.section && (
                  <span style={{ color: 'var(--text-secondary)' }}>
                    §{symbol.section}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default SymbolPanel