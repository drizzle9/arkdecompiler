import React from 'react'
import { useAppStore } from '../store/useAppStore'
import { Cpu, Database, AlertCircle } from 'lucide-react'

const StatusBar: React.FC = () => {
  const { currentFile, viewState, isLoading, loadingMessage, error } = useAppStore()

  const formatAddress = (address: number): string => {
    return `0x${address.toString(16).toUpperCase().padStart(8, '0')}`
  }

  return (
    <div className="status-bar">
      {/* Left status info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* File info */}
        {currentFile && (
          <>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Database size={12} />
              {currentFile.name}
            </span>
            <span>{currentFile.format}</span>
            <span>{currentFile.architecture}</span>
          </>
        )}
        
        {/* Current address */}
        {viewState.currentAddress !== 0 && (
          <span>Address: {formatAddress(viewState.currentAddress)}</span>
        )}
        
        {/* Current function */}
        {viewState.currentFunction && (
          <span>Function: {viewState.currentFunction.name}</span>
        )}
      </div>

      {/* Center loading status */}
      <div style={{ flex: 1, textAlign: 'center' }}>
        {isLoading && (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <div className="loading-spinner" style={{ width: 12, height: 12, borderWidth: 1 }} />
            {loadingMessage || 'Processing...'}
          </span>
        )}
        {error && (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', color: '#f14c4c' }}>
            <AlertCircle size={12} />
            {error.length > 80 ? `${error.slice(0, 80)}...` : error}
          </span>
        )}
      </div>

      {/* Right status info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* View mode */}
        <span>View: {viewState.viewMode === 'graph' ? 'Graph' : viewState.viewMode === 'text' ? 'Text' : 'Mixed'}</span>
        
        {/* Engine status */}
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Cpu size={12} />
          Engine ready
        </span>
        
        {/* Cursor position */}
        <span>Line: 1, Col: 1</span>
      </div>
    </div>
  )
}

export default StatusBar