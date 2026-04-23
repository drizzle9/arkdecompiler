import React, { Component, ErrorInfo, ReactNode, Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import './styles/globals.css'
import { initializeTauriRuntime } from './utils/tauri-utils'
import { notifyNativeWindowReady } from './services/runtime-adapter'
const App = lazy(() => import('./App'))

// Error boundary component: captures child component rendering errors
interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('React rendering error:', error?.message || String(error))
    console.error('React rendering error stack:', error?.stack || '(no stack)')
    console.error('React component stack:', errorInfo?.componentStack || '(no component stack)')
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1e1e1e',
          color: '#cccccc',
          fontFamily: 'Segoe UI, sans-serif',
          padding: '40px'
        }}>
          <h2 style={{ color: '#f14c4c', marginBottom: '16px' }}>Rendering Error</h2>
          <p style={{ marginBottom: '8px' }}>{this.state.error?.message || 'Unknown error'}</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '20px',
              padding: '8px 20px',
              backgroundColor: '#0e639c',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Reload Application
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

const root = ReactDOM.createRoot(document.getElementById('root')!)

const BootFallback: React.FC = () => (
  <div className="boot-screen">
    <div className="boot-dot"></div>
    <div>Starting arkdecompiler...</div>
  </div>
)

const appTree = (
  <ErrorBoundary>
    <Suspense fallback={<BootFallback />}>
      <App />
    </Suspense>
  </ErrorBoundary>
)

root.render(import.meta.env.DEV ? <React.StrictMode>{appTree}</React.StrictMode> : appTree)
window.setTimeout(() => {
  initializeTauriRuntime()
  // Wait for first frame to avoid showing a white native webview surface.
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      void notifyNativeWindowReady()
    })
  })
}, 0)