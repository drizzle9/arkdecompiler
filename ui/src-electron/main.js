const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const { execFile } = require('child_process')

// Main window reference
let mainWindow = null
let splashWindow = null
let mainWindowReady = false
let rendererReady = false
let startupFallbackTimer = null

function resolveSplashHtmlPath() {
  const candidates = [
    path.join(process.cwd(), 'target', 'dist', 'splash.html'),
    path.join(__dirname, '..', 'target', 'dist', 'splash.html'),
    path.join(process.cwd(), 'public', 'splash.html'),
    path.join(__dirname, '..', 'public', 'splash.html')
  ]
  return candidates.find((candidate) => fs.existsSync(candidate)) || null
}

function createSplashWindow() {
  if (splashWindow && !splashWindow.isDestroyed()) return splashWindow

  splashWindow = new BrowserWindow({
    width: 420,
    height: 260,
    frame: false,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false,
    backgroundColor: '#1e1e1e',
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  })

  splashWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.show()
    }
  })

  const splashPath = resolveSplashHtmlPath()
  if (splashPath) {
    splashWindow.loadFile(splashPath)
  } else {
    splashWindow.loadURL('data:text/html;charset=UTF-8,Starting%20arkdecompiler...')
  }

  splashWindow.on('closed', () => {
    splashWindow = null
  })

  return splashWindow
}

function closeSplashWindow() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close()
    splashWindow = null
  }
}

function clearStartupFallbackTimer() {
  if (startupFallbackTimer) {
    clearTimeout(startupFallbackTimer)
    startupFallbackTimer = null
  }
}

function revealMainWindowIfReady() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (!mainWindowReady || !rendererReady) return
  if (!mainWindow.isVisible()) {
    mainWindow.show()
  }
  closeSplashWindow()
  clearStartupFallbackTimer()
}

function resolveCommonIconPath() {
  if (process.platform === 'darwin') {
    return null
  }

  const iconFile = process.platform === 'win32' ? 'icon.ico' : 'icon.png'
  const candidates = [
    path.join(process.resourcesPath || '', iconFile),
    path.join(__dirname, '..', 'src-common', 'icons', iconFile),
    path.join(process.cwd(), 'src-common', 'icons', iconFile),
    path.join(app.getAppPath(), 'src-common', 'icons', iconFile)
  ]

  return candidates.find((iconPath) => fs.existsSync(iconPath))
}

// Create browser window
function createWindow() {
  createSplashWindow()
  mainWindowReady = false
  rendererReady = false

  const windowOptions = {
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    title: 'arkdecompiler',
    backgroundColor: '#1e1e1e'
  }

  const iconPath = resolveCommonIconPath()
  if (iconPath && process.platform !== 'darwin') {
    windowOptions.icon = iconPath
  }

  mainWindow = new BrowserWindow(windowOptions)
  mainWindow.once('ready-to-show', () => {
    mainWindowReady = true
    revealMainWindowIfReady()
  })

  // Load application interface
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:1420')
    if (process.env.ELECTRON_OPEN_DEVTOOLS === '1') {
      mainWindow.webContents.openDevTools({ mode: 'detach' })
    }
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'target', 'dist', 'index.html'))
  }

  // Create menu
  createMenu()

  // Print renderer process logs for debugging runtime errors
  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const levelTag = ['LOG', 'WARN', 'ERROR'][level] || `LEVEL-${level}`
    console.log(`[renderer:${levelTag}] ${message} (${sourceId}:${line})`)
  })

  mainWindow.on('closed', () => {
    clearStartupFallbackTimer()
    mainWindowReady = false
    rendererReady = false
    mainWindow = null
  })

  // Safety fallback: never keep splash forever if renderer signal is lost.
  startupFallbackTimer = setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show()
    }
    closeSplashWindow()
    clearStartupFallbackTimer()
  }, 8000)
}

// Create application menu
function createMenu() {
  // Use frontend React menu bar, disable Electron native menu to avoid duplicate menus
  Menu.setApplicationMenu(null)
}

// Electron initialization complete
app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// Quit when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// IPC communication handling
const TOOL_CONFIG_FILE = 'tools.json'
const LEGACY_TOOL_CONFIG_FILE = 'engine-tools.config.json'
const LEGACY_BROKEN_TOOL_CONFIG_FILE = 'engine-tools.-config.json'
const TOOL_CONFIG_FILE_CANDIDATES = [TOOL_CONFIG_FILE, LEGACY_TOOL_CONFIG_FILE, LEGACY_BROKEN_TOOL_CONFIG_FILE]

const TOOL_DEFINITIONS = {
  disasm: {
    configKey: 'arkDisasm',
    envKey: 'ARK_DISASM_COMMAND',
    displayName: 'ark_disasm',
    actionName: 'Disassembly',
    outputExt: '.pa',
    binaryNames: {
      win32: ['ark_disasm.exe', 'ark_disasm'],
      other: ['ark_disasm']
    }
  },
  decompile: {
    configKey: 'arkDecompile',
    envKey: 'ARK_DECOMPILE_COMMAND',
    displayName: 'ark_decompile',
    actionName: 'Decompile',
    outputExt: '.decompile.txt',
    binaryNames: {
      win32: ['ark_decompile.exe', 'ark_decompile', 'ark_decompiler.exe', 'ark_decompiler'],
      other: ['ark_decompile', 'ark_decompiler']
    }
  }
}

const OUTPUT_LOG_FILE = 'output-logs.jsonl'
const MAX_OUTPUT_LOG_READ_LINES = 50000
const OUTPUT_LOG_READ_CHUNK_SIZE = 64 * 1024

function outputLogFilePath() {
  return path.join(app.getPath('userData'), OUTPUT_LOG_FILE)
}

function ensureOutputLogFile() {
  const filePath = outputLogFilePath()
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '', 'utf8')
  }
  return filePath
}

function normalizeOutputLogEntry(raw = {}) {
  const type = ['info', 'success', 'warning', 'error'].includes(raw?.type) ? raw.type : 'info'
  const id = typeof raw?.id === 'string' && raw.id.trim() ? raw.id.trim() : `log-${Date.now()}`
  const message = typeof raw?.message === 'string' ? raw.message : ''
  const details = typeof raw?.details === 'string' ? raw.details : ''
  const timestamp = typeof raw?.timestamp === 'string' && raw.timestamp.trim()
    ? raw.timestamp
    : new Date().toISOString()

  return {
    id,
    type,
    message,
    details,
    timestamp
  }
}

function appendOutputLogEntry(entry) {
  const filePath = ensureOutputLogFile()
  const normalized = normalizeOutputLogEntry(entry)
  fs.appendFileSync(filePath, `${JSON.stringify(normalized)}\n`, 'utf8')
}

function clearOutputLogEntries() {
  const filePath = ensureOutputLogFile()
  fs.writeFileSync(filePath, '', 'utf8')
}

function readLastJsonlLines(filePath, maxLines) {
  let stat
  try {
    stat = fs.statSync(filePath)
  } catch (_) {
    return []
  }
  if (!stat.size || maxLines <= 0) return []

  const fd = fs.openSync(filePath, 'r')
  try {
    let position = stat.size
    let carry = ''
    const lines = []

    while (position > 0 && lines.length < maxLines) {
      const readSize = Math.min(OUTPUT_LOG_READ_CHUNK_SIZE, position)
      position -= readSize
      const chunk = Buffer.alloc(readSize)
      fs.readSync(fd, chunk, 0, readSize, position)

      const chunkText = chunk.toString('utf8')
      const merged = chunkText + carry
      const parts = merged.split(/\r?\n/)
      carry = parts.shift() || ''

      for (let i = parts.length - 1; i >= 0; i -= 1) {
        const line = parts[i].trim()
        if (!line) continue
        lines.push(line)
        if (lines.length >= maxLines) break
      }
    }

    const prefix = carry.trim()
    if (prefix && lines.length < maxLines) {
      lines.push(prefix)
    }

    return lines.reverse()
  } finally {
    fs.closeSync(fd)
  }
}

function readOutputLogEntries(filter = 'all') {
  const filePath = ensureOutputLogFile()
  const lines = readLastJsonlLines(filePath, MAX_OUTPUT_LOG_READ_LINES)
  if (lines.length === 0) return []
  const parsed = []

  for (const line of lines) {
    try {
      const item = normalizeOutputLogEntry(JSON.parse(line))
      if (filter !== 'all' && item.type !== filter) {
        continue
      }
      parsed.push(item)
    } catch (_) {
      // Ignore malformed historical lines.
    }
  }

  return parsed
}

function readOutputLogPage(payload = {}) {
  const requestedFilter = payload?.filter
  const filter = ['all', 'info', 'success', 'warning', 'error'].includes(requestedFilter) ? requestedFilter : 'all'
  const all = readOutputLogEntries(filter)
  const total = all.length
  const requestedLimit = Math.floor(Number(payload?.limit) || 120)
  const limit = Math.max(1, Math.min(500, requestedLimit))
  const fromTail = Boolean(payload?.fromTail)
  const requestedStart = Math.floor(Number(payload?.start) || 0)
  const start = fromTail
    ? Math.max(0, total - limit)
    : Math.max(0, Math.min(total, requestedStart))
  const end = Math.min(total, start + limit)

  return {
    total,
    start,
    entries: all.slice(start, end)
  }
}

function isAbcFile(filePath) {
  return typeof filePath === 'string' && filePath.toLowerCase().endsWith('.abc')
}

function getToolDefinition(toolKind) {
  const definition = TOOL_DEFINITIONS[toolKind]
  if (!definition) {
    throw new Error(`Unknown tool type: ${toolKind}`)
  }
  return definition
}

function getToolBinaryNames(definition) {
  return process.platform === 'win32'
    ? definition.binaryNames.win32
    : definition.binaryNames.other
}

function getPlatformKey() {
  if (process.platform === 'win32') return 'win32'
  if (process.platform === 'darwin') return 'darwin'
  return 'linux'
}

function getDefaultConfigPath() {
  return path.join(app.getPath('documents'), 'arkdecompiler', TOOL_CONFIG_FILE)
}

function emptyToolConfig() {
  return {
    arkDisasm: {
      win32: '',
      linux: '',
      darwin: ''
    },
    arkDecompile: {
      win32: '',
      linux: '',
      darwin: ''
    },
    workspaceRoot: ''
  }
}

function normalizeToolConfigShape(raw = {}) {
  const getText = (value) => (typeof value === 'string' ? value.trim() : '')
  return {
    arkDisasm: {
      win32: getText(raw?.arkDisasm?.win32),
      linux: getText(raw?.arkDisasm?.linux),
      darwin: getText(raw?.arkDisasm?.darwin)
    },
    arkDecompile: {
      win32: getText(raw?.arkDecompile?.win32),
      linux: getText(raw?.arkDecompile?.linux),
      darwin: getText(raw?.arkDecompile?.darwin)
    },
    workspaceRoot: getText(raw?.workspaceRoot)
  }
}

function chooseValue(userValue, defaultValue) {
  const normalizedUser = typeof userValue === 'string' ? userValue.trim() : ''
  if (normalizedUser) return normalizedUser
  return typeof defaultValue === 'string' ? defaultValue.trim() : ''
}

function mergeWithDefaults(userConfig = {}, defaults = {}) {
  const user = normalizeToolConfigShape(userConfig)
  const base = normalizeToolConfigShape(defaults)
  return {
    arkDisasm: {
      win32: chooseValue(user.arkDisasm.win32, base.arkDisasm.win32),
      linux: chooseValue(user.arkDisasm.linux, base.arkDisasm.linux),
      darwin: chooseValue(user.arkDisasm.darwin, base.arkDisasm.darwin)
    },
    arkDecompile: {
      win32: chooseValue(user.arkDecompile.win32, base.arkDecompile.win32),
      linux: chooseValue(user.arkDecompile.linux, base.arkDecompile.linux),
      darwin: chooseValue(user.arkDecompile.darwin, base.arkDecompile.darwin)
    },
    workspaceRoot: user.workspaceRoot || base.workspaceRoot || ''
  }
}

function getDefaultTemplateConfigPaths() {
  const exeDir = path.dirname(app.getPath('exe'))
  const bases = [
    process.cwd(),
    exeDir,
    path.join(exeDir, 'resources'),
    path.join(__dirname, '..')
  ]
  const candidates = []
  for (const base of bases) {
    candidates.push(path.join(base, TOOL_CONFIG_FILE))
  }
  return [...new Set(candidates)]
}

function loadBundledDefaultConfig() {
  for (const candidate of getDefaultTemplateConfigPaths()) {
    try {
      if (!fs.existsSync(candidate)) continue
      const parsed = JSON.parse(fs.readFileSync(candidate, 'utf8'))
      return normalizeToolConfigShape(parsed)
    } catch (_) {
      // ignore invalid template and continue searching
    }
  }
  return emptyToolConfig()
}

function defaultToolConfig() {
  return loadBundledDefaultConfig()
}

function ensureDefaultToolConfigFile(configPath) {
  if (!configPath || fs.existsSync(configPath)) return
  try {
    fs.mkdirSync(path.dirname(configPath), { recursive: true })
    fs.writeFileSync(configPath, `${JSON.stringify(defaultToolConfig(), null, 2)}\n`, 'utf8')
  } catch (error) {
    console.warn(`[config] Failed to create default tool config at ${configPath}: ${error?.message || String(error)}`)
  }
}

function getCandidateConfigPaths() {
  const exeDir = path.dirname(app.getPath('exe'))
  const bases = [
    path.join(app.getPath('documents'), 'arkdecompiler'),
    app.getPath('userData'),
    process.cwd(),
    exeDir,
    path.join(exeDir, 'resources'),
    path.join(__dirname, '..')
  ]

  const candidates = []
  for (const base of bases) {
    for (const fileName of TOOL_CONFIG_FILE_CANDIDATES) {
      candidates.push(path.join(base, fileName))
    }
  }

  const unique = []
  for (const item of candidates) {
    if (!unique.includes(item)) unique.push(item)
  }
  return unique
}

function loadToolConfig() {
  const defaults = defaultToolConfig()
  const defaultPath = getDefaultConfigPath()
  ensureDefaultToolConfigFile(defaultPath)

  const configPaths = getCandidateConfigPaths()
  const existingPath = configPaths.find((p) => fs.existsSync(p))

  if (!existingPath) {
    return {
      ...defaults,
      configPath: defaultPath,
      searchedConfigPaths: configPaths
    }
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(existingPath, 'utf8'))
    const merged = mergeWithDefaults(parsed, defaults)
    return {
      arkDisasm: merged.arkDisasm,
      arkDecompile: merged.arkDecompile,
      workspaceRoot: merged.workspaceRoot,
      configPath: existingPath,
      searchedConfigPaths: configPaths
    }
  } catch (error) {
    throw new Error(`Config file parsing failed: ${existingPath}, ${error?.message || String(error)}`)
  }
}

function normalizeToolConfigInput(input = {}) {
  return normalizeToolConfigShape(input)
}

function findBinaryInDirectory(directoryPath, binaryNames) {
  const candidates = []

  for (const name of binaryNames) {
    candidates.push(path.join(directoryPath, name))
    candidates.push(path.join(directoryPath, 'bin', name))
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  return ''
}

function normalizeCommandPath(rawPath, binaryNames) {
  if (typeof rawPath !== 'string') return ''
  const candidate = rawPath.trim()
  if (!candidate) return ''

  try {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      const found = findBinaryInDirectory(candidate, binaryNames)
      return found || ''
    }
  } catch (_) {
    // ignore and fallback
  }

  return candidate
}

function resolveToolCommandPath(toolKind, binaryPath, config) {
  const definition = getToolDefinition(toolKind)
  const binaryNames = getToolBinaryNames(definition)
  const tried = []

  const fromPayload = normalizeCommandPath(binaryPath, binaryNames)
  if (fromPayload) return { commandPath: fromPayload, tried }

  const platformKey = getPlatformKey()
  const rawFromConfig = typeof config?.[definition.configKey]?.[platformKey] === 'string'
    ? config[definition.configKey][platformKey].trim()
    : ''
  if (rawFromConfig) tried.push(`config(${platformKey}): ${rawFromConfig}`)
  const fromConfig = normalizeCommandPath(rawFromConfig, binaryNames)
  if (fromConfig) return { commandPath: fromConfig, tried }

  const envValue = (process.env[definition.envKey] || '').trim()
  if (envValue) tried.push(`env(${definition.envKey}): ${envValue}`)
  const fromEnv = normalizeCommandPath(envValue, binaryNames)
  if (fromEnv) return { commandPath: fromEnv, tried }

  const searchedConfigPaths = Array.isArray(config?.searchedConfigPaths)
    ? config.searchedConfigPaths.join(' | ')
    : '-'

  throw new Error(
    `${definition.displayName} not found. Please check the following locations.\nSearched config paths: ${searchedConfigPaths}\nTried command sources: ${tried.join(' | ') || '(none)'}\nPlease set ${definition.configKey}.${platformKey} in ${config?.configPath || TOOL_CONFIG_FILE}`
  )
}

function unquoteToken(token) {
  if (typeof token !== 'string') return ''
  if (
    (token.startsWith('"') && token.endsWith('"')) ||
    (token.startsWith("'") && token.endsWith("'"))
  ) {
    return token.slice(1, -1)
  }
  return token
}

function tokenizeCommandSpec(commandSpec) {
  if (typeof commandSpec !== 'string') return []
  const trimmed = commandSpec.trim()
  if (!trimmed) return []
  const matches = trimmed.match(/"[^"]*"|'[^']*'|[^\s]+/g) || []
  return matches.map(unquoteToken).filter(Boolean)
}

function parseCommandSpec(commandSpec) {
  const tokens = tokenizeCommandSpec(commandSpec)
  const envVars = {}
  let cursor = 0

  while (cursor < tokens.length) {
    const token = tokens[cursor]
    const match = token.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match) break
    envVars[match[1]] = match[2]
    cursor += 1
  }

  let commandPath = tokens[cursor] || ''
  let argStart = cursor + 1

  if (process.platform === 'win32' && commandPath) {
    const looksLikeWindowsPath =
      commandPath.startsWith('\\\\') ||
      /^[A-Za-z]:/.test(commandPath) ||
      commandPath.includes('\\') ||
      commandPath.includes('/')

    if (looksLikeWindowsPath && !fs.existsSync(commandPath)) {
      for (let end = tokens.length; end > cursor + 1; end -= 1) {
        const candidate = tokens.slice(cursor, end).join(' ')
        if (fs.existsSync(candidate)) {
          commandPath = candidate
          argStart = end
          break
        }
      }
    }
  }

  const commandArgs = tokens.slice(argStart)
  return { commandPath, commandArgs, envVars }
}

function assertCommandPath(commandSpec, toolDisplayName) {
  if (!commandSpec) {
    throw new Error(`${toolDisplayName} path not configured`)
  }

  const parsed = parseCommandSpec(commandSpec)
  const executablePath = parsed.commandPath
  if (!executablePath) {
    throw new Error(`Failed to parse ${toolDisplayName} executable path: ${commandSpec}`)
  }

  const isPathLike = executablePath.includes('\\') || executablePath.includes('/') || path.isAbsolute(executablePath)
  if (isPathLike) {
    if (!fs.existsSync(executablePath)) {
      throw new Error(`${toolDisplayName} tool does not exist: ${executablePath}`)
    }
    return
  }

  const pathEnv = process.env.PATH || ''
  const pathEntries = pathEnv.split(path.delimiter).filter(Boolean)
  const names = process.platform === 'win32'
    ? [executablePath, `${executablePath}.exe`]
    : [executablePath]

  for (const entry of pathEntries) {
    for (const name of names) {
      const fullPath = path.join(entry, name)
      if (fs.existsSync(fullPath)) {
        return
      }
    }
  }

  throw new Error(`Executable not found in system PATH (${toolDisplayName}): ${executablePath}`)
}

function projectRootDirectory() {
  return process.cwd()
}

function targetElectronWorkspaceRoot() {
  return path.join(projectRootDirectory(), 'target', 'electron', 'work')
}

function pathContainsComponentCaseInsensitive(inputPath, targetName) {
  const parts = inputPath.split(/[\\/]+/).filter(Boolean)
  return parts.some((p) => p.toLowerCase() === targetName.toLowerCase())
}

function createWorkDirectory(inputFilePath, config) {
  const configuredRoot = typeof config?.workspaceRoot === 'string' ? config.workspaceRoot.trim() : ''
  // Default: create a hidden work subdir next to the abc file so outputs land
  // in a predictable location without polluting the file's parent directory.
  const preferredRoot = configuredRoot
    ? (path.isAbsolute(configuredRoot) ? configuredRoot : path.join(projectRootDirectory(), configuredRoot))
    : path.join(path.dirname(inputFilePath), '.arkdecompiler-work')
  let workspaceRoot = preferredRoot

  // Guard against accidentally writing into source code directories.
  if (pathContainsComponentCaseInsensitive(workspaceRoot, 'src-tauri')) {
    workspaceRoot = targetElectronWorkspaceRoot()
  }

  try {
    fs.mkdirSync(workspaceRoot, { recursive: true })
  } catch (error) {
    if (configuredRoot) {
      throw new Error(`Failed to create configured workspace directory: ${workspaceRoot}, ${error?.message || String(error)}`)
    }
    const fallbackRoot = targetElectronWorkspaceRoot()
    fs.mkdirSync(fallbackRoot, { recursive: true })
    workspaceRoot = fallbackRoot
  }

  const fileBaseName = path.basename(inputFilePath, path.extname(inputFilePath))
  const workDirName = `${fileBaseName}-${Date.now()}`
  const workDir = path.join(workspaceRoot, workDirName)
  fs.mkdirSync(workDir, { recursive: true })
  return workDir
}

function readOutputPreview(outputFilePath) {
  const text = fs.readFileSync(outputFilePath, 'utf8')
  const bytes = Buffer.byteLength(text, 'utf8')
  return {
    outputPreview: text,
    outputBytes: bytes,
    outputTruncated: false
  }
}

function runToolWithOutputFile(commandSpec, inputFilePath, outputFilePath, actionName) {
  return new Promise((resolve, reject) => {
    const parsed = parseCommandSpec(commandSpec)
    const executablePath = parsed.commandPath
    if (!executablePath) {
      reject(new Error(`${actionName} command has no executable path: ${commandSpec}`))
      return
    }

    execFile(
      executablePath,
      [...parsed.commandArgs, inputFilePath, outputFilePath],
      {
        windowsHide: true,
        maxBuffer: 20 * 1024 * 1024,
        timeout: 120000,
        env: {
          ...process.env,
          ...parsed.envVars
        }
      },
      (error, stdout, stderr) => {
        const stdoutText = (stdout || '').toString()
        const stderrText = (stderr || '').toString()

        if (error) {
          const raw = stderrText.trim() || stdoutText.trim() || error.message || `${actionName} command execution failed`
          const details = [
            raw,
            `command: ${commandSpec}`,
            stdoutText ? `stdout:\n${stdoutText}` : '',
            stderrText ? `stderr:\n${stderrText}` : ''
          ].filter(Boolean).join('\n')
          reject(new Error(details))
          return
        }

        try {
          if (!fs.existsSync(outputFilePath)) {
            if (stdoutText.trim()) {
              resolve({
                outputPreview: stdoutText,
                outputBytes: Buffer.byteLength(stdoutText, 'utf8'),
                outputTruncated: false,
                commandStdout: stdoutText,
                commandStderr: stderrText
              })
              return
            }
            reject(new Error(`${actionName} output file does not exist: ${outputFilePath}`))
            return
          }

          const output = readOutputPreview(outputFilePath)
          resolve({
            ...output,
            commandStdout: stdoutText,
            commandStderr: stderrText
          })
        } catch (readError) {
          reject(new Error(`${actionName} output read failed: ${readError?.message || String(readError)}`))
        }
      }
    )
  })
}

function toErrorMessage(error) {
  return error?.message || String(error)
}

function registerExternalToolHandler(channel, toolKind) {
  ipcMain.handle(channel, async (_event, payload = {}) => {
    try {
      return await runExternalTool(toolKind, payload)
    } catch (error) {
      return {
        success: false,
        error: toErrorMessage(error)
      }
    }
  })
}

const MAX_READ_SIZE = 1024 * 1024

function normalizeReadRange(fileSize, offset, size) {
  const readOffset = Math.max(0, Math.floor(Number(offset) || 0))
  const requestedSize = Math.max(0, Math.floor(Number(size) || 0))

  if (readOffset >= fileSize) {
    return null
  }

  const cappedSize = Math.min(requestedSize, MAX_READ_SIZE)
  const remaining = fileSize - readOffset
  const actualSize = Math.min(cappedSize, remaining)

  if (actualSize <= 0) {
    return null
  }

  return { readOffset, actualSize }
}

async function readBytesFromFile(filePath, offset, size) {
  let stat
  try {
    stat = await fs.promises.stat(filePath)
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error(`File does not exist: ${filePath}`)
    }
    throw error
  }
  const range = normalizeReadRange(stat.size, offset, size)
  if (!range) {
    return []
  }

  const buffer = Buffer.alloc(range.actualSize)
  const handle = await fs.promises.open(filePath, 'r')
  try {
    await handle.read(buffer, 0, range.actualSize, range.readOffset)
  } finally {
    await handle.close()
  }

  return buffer
}

async function runExternalTool(toolKind, payload = {}) {
  const { filePath, binaryPath } = payload

  if (!filePath || !isAbcFile(filePath)) {
    throw new Error('Only .abc files are supported')
  }
  if (!fs.existsSync(filePath)) {
    throw new Error('File does not exist')
  }

  const config = loadToolConfig()
  const resolved = resolveToolCommandPath(toolKind, binaryPath, config)
  const commandPath = resolved.commandPath
  const definition = getToolDefinition(toolKind)
  assertCommandPath(commandPath, definition.displayName)

  const workDir = createWorkDirectory(filePath, config)
  const stagedInputPath = path.join(workDir, path.basename(filePath))
  fs.copyFileSync(filePath, stagedInputPath)

  const outputFilePath = path.join(
    workDir,
    `${path.basename(filePath, path.extname(filePath))}${definition.outputExt}`
  )

  const toolResult = await runToolWithOutputFile(
    commandPath,
    stagedInputPath,
    outputFilePath,
    definition.actionName
  )
  const stat = fs.statSync(filePath)

  return {
    success: true,
    filePath,
    fileName: path.basename(filePath),
    fileSize: stat.size,
    output: toolResult.outputPreview,
    outputBytes: toolResult.outputBytes,
    outputTruncated: toolResult.outputTruncated,
    outputFilePath,
    workDir,
    commandPath,
    configPath: config.configPath,
    searchedConfigPaths: config.searchedConfigPaths || [],
    triedCommandSources: resolved.tried || [],
    commandStdout: toolResult.commandStdout || '',
    commandStderr: toolResult.commandStderr || ''
  }
}

ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'ABC Files', extensions: ['abc'] }
    ]
  })
  return result
})

registerExternalToolHandler('run-disassemble', 'disasm')
registerExternalToolHandler('run-decompile', 'decompile')

ipcMain.handle('get-tool-config', async () => {
  const config = loadToolConfig()
  return {
    arkDisasm: config.arkDisasm,
    arkDecompile: config.arkDecompile,
    workspaceRoot: config.workspaceRoot || '',
    configPath: config.configPath
  }
})

ipcMain.handle('save-tool-config', async (_event, payload = {}) => {
  const current = loadToolConfig()
  const nextConfig = normalizeToolConfigInput(payload?.config || {})
  const configPath = current.configPath || getDefaultConfigPath()

  fs.mkdirSync(path.dirname(configPath), { recursive: true })
  fs.writeFileSync(configPath, `${JSON.stringify(nextConfig, null, 2)}\n`, 'utf8')

  return {
    ...nextConfig,
    configPath
  }
})

ipcMain.handle('append-output-log', async (_event, payload = {}) => {
  appendOutputLogEntry(payload?.entry || {})
  return true
})

ipcMain.handle('read-output-logs', async (_event, payload = {}) => {
  return readOutputLogPage(payload)
})

ipcMain.handle('clear-output-logs', async () => {
  clearOutputLogEntries()
  return true
})

ipcMain.handle('read-bytes', async (_event, payload = {}) => {
  try {
    const { filePath, offset, size } = payload

    if (!filePath) {
      throw new Error('File path is required')
    }

    return await readBytesFromFile(filePath, offset, size)
  } catch (error) {
    console.error('read-bytes error:', error)
    throw error
  }
})

ipcMain.handle('save-file-dialog', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [
      { name: 'Project File', extensions: ['dproj'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  })
  return result
})

ipcMain.handle('renderer-startup-ready', async () => {
  rendererReady = true
  revealMainWindowIfReady()
  return true
})