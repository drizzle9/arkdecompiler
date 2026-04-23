import React, { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { SearchResult, SearchScope } from '../types'
import { Search, CheckSquare, Square } from 'lucide-react'

const SearchPanel: React.FC = () => {
  const {
    currentFile,
    viewState,
    setCurrentAddress,
    setCurrentFunction,
    setSearchResults,
    setIsSearching,
    setLoading,
    setError
  } = useAppStore()

  const [query, setQuery] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const [useRegex, setUseRegex] = useState(false)
  const [searchScopes, setSearchScopes] = useState<SearchScope[]>(['functions', 'symbols', 'strings', 'instructions'])
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setSearching] = useState(false)

  const scopeOptions: { value: SearchScope; label: string }[] = [
    { value: 'functions', label: 'Function' },
    { value: 'symbols', label: 'Symbol' },
    { value: 'strings', label: 'String' },
    { value: 'instructions', label: 'Disassembly' },
    { value: 'data', label: 'Data' }
  ]

  const toggleScope = (scope: SearchScope) => {
    setSearchScopes(prev =>
      prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope]
    )
  }

  const escapeRegExp = (text: string) =>
    text.replace(/[.*+?^${}()|[\]\\]/g, (matched) => '\\' + matched)

  const createMatcher = (rawQuery: string): RegExp | null => {
    const source = useRegex ? rawQuery : escapeRegExp(rawQuery)
    const wrapped = wholeWord ? `\\b${source}\\b` : source
    const flags = caseSensitive ? 'g' : 'gi'
    try {
      return new RegExp(wrapped, flags)
    } catch {
      setError('Invalid regular expression')
      return null
    }
  }

  const collectRanges = (line: string, matcher: RegExp): { start: number; end: number }[] => {
    const ranges: { start: number; end: number }[] = []
    const local = new RegExp(matcher.source, matcher.flags)
    let matched: RegExpExecArray | null = null
    while ((matched = local.exec(line)) !== null) {
      const text = matched[0] || ''
      if (text.length === 0) {
        local.lastIndex += 1
        continue
      }
      ranges.push({ start: matched.index, end: matched.index + text.length })
      if (ranges.length >= 8) break
    }
    return ranges
  }

  const handleSearch = async () => {
    const rawQuery = query.trim()
    if (!rawQuery) return
    if (searchScopes.length === 0) {
      setError('Please select at least one search scope')
      return
    }

    setSearching(true)
    setIsSearching(true)
    setLoading(true, 'Searching...')
    setError(null)

    try {
      const matcher = createMatcher(rawQuery)
      if (!matcher) {
        setResults([])
        setSearchResults([])
        return
      }

      const testWithReset = (text: string): boolean => {
        matcher.lastIndex = 0
        return matcher.test(text)
      }

      const matchedResults: SearchResult[] = []
      const textSource = viewState.currentFunction?.decompiledCode
        || currentFile?.functions.find(f => !!f.decompiledCode)?.decompiledCode
        || ''
      const baseAddress = currentFile?.sections?.[0]?.virtualAddress ?? 0

      if (currentFile && searchScopes.includes('functions')) {
        currentFile.functions.forEach((func) => {
          const searchable = `${func.signature?.returnType || ''} ${func.name}`
          if (testWithReset(searchable)) {
            matchedResults.push({
              id: `search-func-${func.id}`,
              type: 'function',
              name: func.name,
              address: func.address,
              preview: `${func.signature?.returnType || 'any'} ${func.name}(...)`,
              matchRanges: collectRanges(func.name, matcher)
            })
          }
        })
      }

      if (currentFile && searchScopes.includes('symbols')) {
        currentFile.symbols.forEach((symbol) => {
          if (testWithReset(symbol.name)) {
            matchedResults.push({
              id: `search-sym-${symbol.id}`,
              type: 'symbol',
              name: symbol.name,
              address: symbol.address,
              preview: `${symbol.section || '-'} | ${symbol.type}`,
              matchRanges: collectRanges(symbol.name, matcher)
            })
          }
        })
      }

      if (currentFile && searchScopes.includes('strings')) {
        currentFile.strings.forEach((strRef) => {
          if (testWithReset(strRef.value)) {
            matchedResults.push({
              id: `search-str-${strRef.id}`,
              type: 'string',
              name: strRef.value,
              address: strRef.address,
              preview: strRef.value,
              matchRanges: collectRanges(strRef.value, matcher)
            })
          }
        })
      }

      if (textSource && (searchScopes.includes('instructions') || searchScopes.includes('data'))) {
        const lines = textSource.split(/\r?\n/)
        lines.forEach((line, lineIndex) => {
          if (!line) return
          if (testWithReset(line)) {
            const ranges = collectRanges(line, matcher)
            matchedResults.push({
              id: `search-ins-${lineIndex}`,
              type: 'instruction',
              name: `Line ${lineIndex + 1}`,
              address: baseAddress + lineIndex,
              preview: line.trim() || '(empty)',
              matchRanges: ranges.length ? ranges : [{ start: 0, end: Math.min(rawQuery.length, line.length) }]
            })
          }
        })
      }

      setResults(matchedResults)
      setSearchResults(matchedResults)
    } finally {
      setSearching(false)
      setIsSearching(false)
      setLoading(false)
    }
  }

  const handleResultClick = (result: SearchResult) => {
    setCurrentAddress(result.address)
    if (!currentFile) return

    const matchedFunction = currentFile.functions.find((f) => {
      const start = f.address
      const end = f.address + Math.max(1, f.size)
      return result.address >= start && result.address < end
    })

    if (matchedFunction) {
      setCurrentFunction(matchedFunction)
    }
  }

  const formatAddress = (address: number): string => {
    return `0x${address.toString(16).toUpperCase().padStart(8, '0')}`
  }

  const getResultTypeIcon = (type: string) => {
    switch (type) {
      case 'function':
        return <span style={{ color: 'var(--function-color)' }}>ƒ</span>
      case 'symbol':
        return <span style={{ color: 'var(--variable-color)' }}>●</span>
      case 'string':
        return <span style={{ color: 'var(--string-color)' }}>S</span>
      case 'instruction':
        return <span style={{ color: 'var(--keyword-color)' }}>I</span>
      case 'data':
        return <span style={{ color: 'var(--number-color)' }}>D</span>
      default:
        return <span>○</span>
    }
  }

  const getResultTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      function: 'Function',
      symbol: 'Symbol',
      string: 'String',
      instruction: 'Disassembly',
      data: 'Data'
    }
    return labels[type] || type
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <Search size={14} style={{ marginRight: 6 }} />
        Search
      </div>

      <div style={{
        padding: '8px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type="text"
              className="search-input"
              placeholder="Search Disassembly/Function/Symbol..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              style={{ width: '100%' }}
            />
          </div>
          <button
            className="btn"
            onClick={handleSearch}
            disabled={!query.trim() || isSearching}
            style={{ padding: '4px 8px' }}
          >
            {isSearching ? (
              <div className="loading-spinner" style={{ width: 14, height: 14 }} />
            ) : (
              <Search size={14} />
            )}
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px', fontSize: 11 }}>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            cursor: 'pointer',
            color: caseSensitive ? 'var(--accent-color)' : 'var(--text-secondary)'
          }}>
            <input
              type="checkbox"
              checked={caseSensitive}
              onChange={(e) => setCaseSensitive(e.target.checked)}
              style={{ display: 'none' }}
            />
            {caseSensitive ? <CheckSquare size={12} /> : <Square size={12} />}
            Case sensitive
          </label>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            cursor: 'pointer',
            color: wholeWord ? 'var(--accent-color)' : 'var(--text-secondary)'
          }}>
            <input
              type="checkbox"
              checked={wholeWord}
              onChange={(e) => setWholeWord(e.target.checked)}
              style={{ display: 'none' }}
            />
            {wholeWord ? <CheckSquare size={12} /> : <Square size={12} />}
            Whole word
          </label>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            cursor: 'pointer',
            color: useRegex ? 'var(--accent-color)' : 'var(--text-secondary)'
          }}>
            <input
              type="checkbox"
              checked={useRegex}
              onChange={(e) => setUseRegex(e.target.checked)}
              style={{ display: 'none' }}
            />
            {useRegex ? <CheckSquare size={12} /> : <Square size={12} />}
            Regex
          </label>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {scopeOptions.map(option => (
            <button
              key={option.value}
              onClick={() => toggleScope(option.value)}
              style={{
                padding: '2px 6px',
                fontSize: 10,
                border: '1px solid var(--border-color)',
                borderRadius: 2,
                backgroundColor: searchScopes.includes(option.value)
                  ? 'var(--accent-color)'
                  : 'transparent',
                color: searchScopes.includes(option.value)
                  ? 'var(--text-active)'
                  : 'var(--text-primary)',
                cursor: 'pointer'
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="panel-content" style={{ overflow: 'auto' }}>
        {results.length === 0 ? (
          <div style={{
            padding: '20px',
            textAlign: 'center',
            color: 'var(--text-secondary)',
            fontSize: 12
          }}>
            {query.trim() ? 'No matching results found' : 'Enter search content'}
          </div>
        ) : (
          <>
            <div style={{
              padding: '4px 8px',
              backgroundColor: 'var(--bg-tertiary)',
              borderBottom: '1px solid var(--border-color)',
              fontSize: 11,
              color: 'var(--text-secondary)'
            }}>
              Found {results.length} results
            </div>
            {results.map(result => (
              <div
                key={result.id}
                className="list-item"
                onClick={() => handleResultClick(result)}
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
                  gap: '6px'
                }}>
                  {getResultTypeIcon(result.type)}
                  <span style={{
                    flex: 1,
                    fontFamily: 'Consolas, monospace',
                    fontSize: 11,
                    color: result.type === 'function' ? 'var(--function-color)' : 'var(--text-primary)'
                  }}>
                    {result.name}
                  </span>
                  <span style={{
                    fontSize: 10,
                    padding: '1px 4px',
                    backgroundColor: 'var(--bg-tertiary)',
                    borderRadius: 2,
                    color: 'var(--text-secondary)'
                  }}>
                    {getResultTypeLabel(result.type)}
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
                    {formatAddress(result.address)}
                  </span>
                </div>
                <div style={{
                  width: '100%',
                  paddingLeft: 18,
                  fontFamily: 'Consolas, monospace',
                  fontSize: 10,
                  color: 'var(--text-secondary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {result.preview}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

export default SearchPanel