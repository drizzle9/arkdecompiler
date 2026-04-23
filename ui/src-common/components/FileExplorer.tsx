import React, { useCallback, useMemo, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { BinaryFile, Section } from '../types'
import {
  FileCode,
  ChevronRight,
  ChevronDown,
  Folder,
  Layers,
  File
} from 'lucide-react'

interface TreeNode {
  id: string
  name: string
  type: 'file' | 'section'
  children?: TreeNode[]
  data?: Section | BinaryFile
}

const FileExplorer: React.FC = () => {
  const { files, currentFile, setCurrentFile, setCurrentAddress } = useAppStore()
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['root']))

  const toggleNode = useCallback((nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev)
      if (next.has(nodeId)) {
        next.delete(nodeId)
      } else {
        next.add(nodeId)
      }
      return next
    })
  }, [])

  const handleFileSelect = useCallback((file: BinaryFile) => {
    setCurrentFile(file)
    // TODO: Call engine to get actual data
    console.log('File selected - Engine integration pending:', file.name)
  }, [setCurrentFile])

  const handleSectionSelect = useCallback((section: Section) => {
    setCurrentAddress(section.virtualAddress)
    // TODO: Navigate to section
    console.log('Section selected - Engine integration pending:', section.name)
  }, [setCurrentAddress])

  // Build file tree structure
  const tree = useMemo<TreeNode[]>(() => {
    return files.map(file => ({
      id: file.id,
      name: file.name,
      type: 'file' as const,
      data: file,
      children: file.sections.map(section => ({
        id: `${file.id}-${section.id}`,
        name: section.name,
        type: 'section' as const,
        data: section
      }))
    }))
  }, [files])

  const renderNode = (node: TreeNode, depth: number = 0) => {
    const isExpanded = expandedNodes.has(node.id)
    const hasChildren = node.children && node.children.length > 0
    const isSelected = node.type === 'file' && (node.data as BinaryFile)?.id === currentFile?.id

    const getIcon = () => {
      switch (node.type) {
        case 'file':
          return <FileCode size={14} style={{ color: 'var(--type-color)' }} />
        case 'section':
          return <Layers size={14} style={{ color: 'var(--warning-color)' }} />
        default:
          return <File size={14} />
      }
    }

    return (
      <div key={node.id}>
        <div
          className={`tree-item ${isSelected ? 'selected' : ''}`}
          style={{ paddingLeft: depth * 16 + 8 }}
          onClick={() => {
            if (node.type === 'file' && node.data) {
              handleFileSelect(node.data as BinaryFile)
            } else if (node.type === 'section' && node.data) {
              handleSectionSelect(node.data as Section)
            }
            if (hasChildren) {
              toggleNode(node.id)
            }
          }}
        >
          <div className="tree-item-icon">
            {hasChildren ? (
              isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
            ) : null}
          </div>
          {getIcon()}
          <span style={{ marginLeft: 6 }}>{node.name}</span>
        </div>
        {hasChildren && isExpanded && (
          <div>
            {node.children!.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  // If no file, show placeholder
  if (files.length === 0) {
    return (
      <div className="panel">
        <div className="panel-header">
          <Folder size={14} style={{ marginRight: 6 }} />
          File Explorer
        </div>
        <div className="panel-content" style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: 'var(--text-secondary)',
          padding: '20px'
        }}>
          <File size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
          <p style={{ textAlign: 'center', fontSize: 12 }}>
            Open an .abc file to start analysis
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <Folder size={14} style={{ marginRight: 6 }} />
        File Explorer
      </div>
      <div className="panel-content">
        {/* Root node - Loaded files */}
        <div
          className="tree-item"
          style={{ paddingLeft: 8 }}
          onClick={() => toggleNode('root')}
        >
          <div className="tree-item-icon">
            {expandedNodes.has('root') ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </div>
          <Folder size={14} />
          <span style={{ marginLeft: 6 }}>Loaded Files</span>
          <span style={{ marginLeft: 'auto', color: 'var(--text-secondary)', fontSize: 11 }}>
            {files.length}
          </span>
        </div>
        
        {expandedNodes.has('root') && (
          <div>
            {tree.map(node => renderNode(node, 1))}
          </div>
        )}
      </div>
    </div>
  )
}

export default FileExplorer