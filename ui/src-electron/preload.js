const { contextBridge, ipcRenderer } = require('electron')

// Expose safe API to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Open file dialog
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  
  // Save file dialog
  saveFileDialog: () => ipcRenderer.invoke('save-file-dialog'),

  // Run disassembly
  runDisassemble: (payload) => ipcRenderer.invoke('run-disassemble', payload),

  // Run decompile
  runDecompile: (payload) => ipcRenderer.invoke('run-decompile', payload),

  // Read bytes from file
  readBytes: (payload) => ipcRenderer.invoke('read-bytes', payload),

  // Load tool config file
  getToolConfig: () => ipcRenderer.invoke('get-tool-config'),

  // Save tool config file
  saveToolConfig: (payload) => ipcRenderer.invoke('save-tool-config', payload),

  // Persist output logs
  appendOutputLog: (payload) => ipcRenderer.invoke('append-output-log', payload),
  readOutputLogs: (payload) => ipcRenderer.invoke('read-output-logs', payload),
  clearOutputLogs: () => ipcRenderer.invoke('clear-output-logs'),

  // Notify main process that renderer first frame is ready
  notifyRendererReady: () => ipcRenderer.invoke('renderer-startup-ready'),
  
  // Listen for file open event
  onFileOpened: (callback) => {
    ipcRenderer.on('file-opened', (event, filePath) => callback(filePath))
  },
  
  // Remove listener
  removeFileOpenedListener: () => {
    ipcRenderer.removeAllListeners('file-opened')
  }
})

// Engine interface placeholder (TODO: Implement communication with backend engine)
contextBridge.exposeInMainWorld('decompilerAPI', {
  // Load binary file
  loadFile: async (filePath) => {
    console.log('TODO: Implement loadFile for:', filePath)
    return { success: false, message: 'Engine not implemented' }
  },
  
  // Get function list
  getFunctions: async () => {
    console.log('TODO: Implement getFunctions')
    return []
  },
  
  // Decompile function
  decompileFunction: async (address) => {
    console.log('TODO: Implement decompileFunction for:', address)
    return null
  },
  
  // Search strings
  searchStrings: async (pattern) => {
    console.log('TODO: Implement searchStrings for:', pattern)
    return []
  },
  
  // Get cross references
  getXrefs: async (address) => {
    console.log('TODO: Implement getXrefs for:', address)
    return []
  }
})