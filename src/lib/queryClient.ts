import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0, // Live data is better for a library system
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
})
