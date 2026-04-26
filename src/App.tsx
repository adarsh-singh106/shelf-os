import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'

// TODO: Import pages and components
// import AppShell from './components/layout/AppShell'
// import LandingPage from './pages/LandingPage'
// import Discover from './pages/Discover'
// import MyShelf from './pages/MyShelf'
// import MySpace from './pages/MySpace'

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* TODO: Add routes */}
          <Route path="/" element={<div className="w-full h-screen bg-base flex items-center justify-center text-muted">ShelfOS — Coming Soon</div>} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
