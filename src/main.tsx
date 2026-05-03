import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      retry: 1,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  // StrictMode removed — it double-fires useEffect which breaks Supabase auth
  // subscriptions in development. Safe to re-enable in production builds.
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1E293B',
            color: '#F1F5F9',
            border: '1px solid rgba(51, 65, 85, 0.5)',
            borderRadius: '10px',
          },
          success: { iconTheme: { primary: '#10B981', secondary: '#1E293B' } },
          error: { iconTheme: { primary: '#EF4444', secondary: '#1E293B' } },
        }}
      />
    </BrowserRouter>
  </QueryClientProvider>
)
