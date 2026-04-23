import React, { useState, useMemo } from 'react'
import { useAppStore } from '../store/useAppStore'
import { Function } from '../types'
import { Code, Lock, Unlock, Search, SortAsc, SortDesc } from 'lucide-react'

const FunctionList: React.FC = () => {
  const currentFile = useAppStore((state) => state.currentFile)
  const selectedFunctionId = useAppStore((state) => state.viewState.currentFunction?.id || '')
  const setCurrentFunction = useAppStore((state) => state.setCurrentFunction)
  const setCurrentAddress = useAppStore((state) => state.setCurrentAddress)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'address' | 'size'>('address')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  // Get function list (from current file or mock data)
  const functions = useMemo(() => {
    if (!currentFile) return []
    return currentFile.functions
  }, [currentFile])

  // Filter and sort functions
  const filteredFunctions = useMemo(() => {
    let result = [...functions]
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(f => 
        f.name.toLowerCase().includes(query) ||
        f.address.toString(16).includes(query)
      )
    }
    
    // Sort
    result.sort((a, b) => {
      let cmp = 0
      switch (sortBy) {
        case 'name':
          cmp = a.name.localeCompare(b.name)
          break
        case 'address':
          cmp = a.address - b.address
          break
        case 'size':
          cmp = a.size - b.size
          break
      }
      return sortOrder === 'asc' ? cmp : -cmp
    })
    
    return result
  }, [functions, searchQuery, sortBy, sortOrder])

  const handleFunctionClick = (func: Function) => {
    setCurrentFunction(func)
    setCurrentAddress(func.address)

    // TODO: Call engine to jump to function address
    console.log('Function selected - Engine integration pending:', func.name)
  }

  const formatAddress = (address: number): string => {
    return `0x${address.toString(16).toUpperCase().padStart(8, '0')}`
  }

  const formatSize = (size: number): string => {
    if (size < 1024) return `${size}B`
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}KB`
    return `${(size / (1024 * 1024)).toFixed(1)}MB`
  }

  const toggleSort = (field: 'name' | 'address' | 'size') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
  }

  // If no file, show placeholder
  if (!currentFile) {
    return (
      <div className="panel">
        <div className="panel-header">
          <Code size={14} style={{ marginRight: 6 }} />
          Function List
        </div>
        <div className="panel-content" style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: 'var(--text-secondary)',
          padding: '20px'
        }}>
          <Code size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
          <p style={{ textAlign: 'center', fontSize: 12 }}>
            Open an .abc file to view Function List
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <Code size={14} style={{ marginRight: 6 }} />
        Function List
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-secondary)' }}>
          {filteredFunctions.length} / {functions.length}
        </span>
      </div>
      
      {/* Search and sort */}
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
            placeholder="Search functions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', paddingLeft: 24 }}
          />
        </div>
      </div>

      {/* Sort buttons */}
      <div style={{ 
        padding: '4px 8px', 
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        gap: '4px',
        fontSize: 11
      }}>
        <button
          className={`btn btn-secondary ${sortBy === 'name' ? 'active' : ''}`}
          onClick={() => toggleSort('name')}
          style={{ 
            padding: '2px 8px', 
            fontSize: 11,
            backgroundColor: sortBy === 'name' ? 'var(--accent-color)' : 'transparent',
            color: sortBy === 'name' ? 'var(--text-active)' : 'var(--text-primary)'
          }}
        >
          Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
        </button>
        <button
          className={`btn btn-secondary ${sortBy === 'address' ? 'active' : ''}`}
          onClick={() => toggleSort('address')}
          style={{ 
            padding: '2px 8px', 
            fontSize: 11,
            backgroundColor: sortBy === 'address' ? 'var(--accent-color)' : 'transparent',
            color: sortBy === 'address' ? 'var(--text-active)' : 'var(--text-primary)'
          }}
        >
          Address {sortBy === 'address' && (sortOrder === 'asc' ? '↑' : '↓')}
        </button>
        <button
          className={`btn btn-secondary ${sortBy === 'size' ? 'active' : ''}`}
          onClick={() => toggleSort('size')}
          style={{ 
            padding: '2px 8px', 
            fontSize: 11,
            backgroundColor: sortBy === 'size' ? 'var(--accent-color)' : 'transparent',
            color: sortBy === 'size' ? 'var(--text-active)' : 'var(--text-primary)'
          }}
        >
          Size {sortBy === 'size' && (sortOrder === 'asc' ? '↑' : '↓')}
        </button>
      </div>

      {/* Function List */}
      <div className="panel-content" style={{ overflow: 'auto' }}>
        {filteredFunctions.length === 0 ? (
          <div style={{ 
            padding: '20px', 
            textAlign: 'center', 
            color: 'var(--text-secondary)',
            fontSize: 12
          }}>
            {searchQuery ? 'No matching functions found' : 'No functions found'}
          </div>
        ) : (
          filteredFunctions.map(func => (
            <div
              key={func.id}
              className={`list-item ${selectedFunctionId === func.id ? 'selected' : ''}`}
              onClick={() => handleFunctionClick(func)}
              style={{ 
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: '2px'
              }}
            >
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                width: '100%',
                gap: '6px'
              }}>
                {func.flags.library ? (
                  <Lock size={12} style={{ color: 'var(--text-secondary)' }} />
                ) : (
                  <Unlock size={12} style={{ color: 'var(--success-color)' }} />
                )}
                <span style={{ 
                  flex: 1,
                  color: 'var(--function-color)',
                  fontFamily: 'Consolas, monospace',
                  fontSize: 12
                }}>
                  {func.name}
                </span>
                <span style={{ 
                  fontSize: 10,
                  color: 'var(--text-secondary)'
                }}>
                  {formatSize(func.size)}
                </span>
              </div>
              <div style={{ 
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                paddingLeft: 18,
                gap: '8px'
              }}>
                <span style={{ 
                  fontSize: 10,
                  color: 'var(--number-color)',
                  fontFamily: 'Consolas, monospace'
                }}>
                  {formatAddress(func.address)}
                </span>
                <span style={{ 
                  fontSize: 10,
                  color: 'var(--text-secondary)'
                }}>
                  {func.signature.returnType}
                </span>
                <span style={{ 
                  fontSize: 10,
                  color: 'var(--text-secondary)'
                }}>
                  ({func.parameters.length} params)
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default FunctionList