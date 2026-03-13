/**
 * OncoLife - Ruby Patient Application
 * "Compassionate Care, Intelligent Triage"
 *
 * Entry point with:
 * - OncoLife Theme Provider: default = system (follows OS light/dark); user can override via toggle
 * - Global Styles with animations
 * - React Query for server state
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css' // Import Tailwind CSS FIRST before GlobalStyles
import {
  OncolifeThemeProvider,
  GlobalStyles,
  ErrorBoundary,
} from '@oncolife/ui-components'
import App from './App.tsx'

// Configure React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
})

// Theme: when no stored preference, follows system (prefers-color-scheme); storageKey persists user choice
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={(import.meta.env.BASE_URL ?? '/').replace(/\/$/, '') || '/'}>
      <OncolifeThemeProvider
        appType="patient"
        storageKey="oncolife-patient-theme"
      >
        <GlobalStyles />
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <App />
          </QueryClientProvider>
        </ErrorBoundary>
      </OncolifeThemeProvider>
    </BrowserRouter>
  </StrictMode>,
)
