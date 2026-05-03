import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import AppRoutes from './routes/AppRoutes'
import { AuthProvider } from './providers/AuthProvider'
import AuthFlowProvider from './components/auth/AuthFlowProvider'

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AuthFlowProvider>
            <AppRoutes />
          </AuthFlowProvider>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
