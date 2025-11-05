import React from 'react'

interface ErrorFallbackProps {
  error: Error
  resetErrorBoundary: () => void
}

export const ErrorFallback: React.FC<ErrorFallbackProps> = ({ error, resetErrorBoundary }) => {
  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1>Something went wrong</h1>
      <pre style={{ color: 'red', textAlign: 'left', background: '#f5f5f5', padding: '10px' }}>
        {error.message}
      </pre>
      <button onClick={resetErrorBoundary} style={{ marginTop: '10px' }}>
        Try again
      </button>
    </div>
  )
}