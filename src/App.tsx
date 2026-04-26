import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import LandingPage from './pages/LandingPage'

// TODO: Import pages and components
// import AppShell from './components/layout/AppShell'
// import Discover from './pages/Discover'
// import MyShelf from './pages/MyShelf'
// import MySpace from './pages/MySpace'

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          {/* TODO: Add protected routes with AppShell */}
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
