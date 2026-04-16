import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './styles/globals.css'
import { ThemeProvider } from './contexts/ThemeContext'
import { TooltipProvider } from '@/components/ui/tooltip'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      retry: 1,
      staleTime: 0,                  // Always treat cached data as stale for live ERP tables
      gcTime: 30 * 60 * 1000,        // 30 minutes - cache garbage collection
      refetchOnReconnect: true,       // Refetch on network reconnection
      refetchOnMount: 'always',       // Refresh whenever views mount/navigate
      refetchInterval: 15000,         // Poll active queries every 15s for near real-time updates
      refetchIntervalInBackground: true,
      networkMode: 'offlineFirst',    // Return cached data while offline
    },
    mutations: {
      retry: 1,
      networkMode: 'online',
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <BrowserRouter>
            <App />
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 3000,
                className: 'bg-white text-[#1d1d1f] border border-[#d2d2d7] shadow-card rounded-apple',
                success: {
                  duration: 3000,
                  iconTheme: {
                    primary: '#039855',
                    secondary: '#fff',
                  },
                },
                error: {
                  duration: 4000,
                  iconTheme: {
                    primary: '#d92d20',
                    secondary: '#fff',
                  },
                },
              }}
            />
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </React.StrictMode>,
)
