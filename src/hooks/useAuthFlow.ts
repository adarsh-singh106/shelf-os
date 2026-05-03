import { createContext, useContext } from 'react'

export type AuthFlowContextValue = {
  openSignIn: () => void
  openSignUp: () => void
}

export const AuthFlowContext = createContext<AuthFlowContextValue | null>(null)

export function useAuthFlow() {
  const context = useContext(AuthFlowContext)

  if (!context) {
    throw new Error('useAuthFlow must be used within AuthFlowProvider')
  }

  return context
}
