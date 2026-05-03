import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthFlowContext } from '../../hooks/useAuthFlow'
import { supabase } from '../../lib/supabase'
import { ensureUserProfile } from '../../lib/profile'
import AuthModal from './AuthModal'
import OnboardingModal from './OnboardingModal'
import type { TableRow } from '../../types/db'

type AuthInitialView = 'signin' | 'signup'

type UserRow = Pick<TableRow<'users'>, 'role' | 'preferences'>

type AuthFlowProviderProps = {
  children: ReactNode
}

function resolveRouteByRole(role: string | null | undefined) {
  return role === 'admin' ? '/admin' : '/discover'
}

export default function AuthFlowProvider({ children }: AuthFlowProviderProps) {
  const navigate = useNavigate()
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [authInitialView, setAuthInitialView] = useState<AuthInitialView>('signup')
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false)
  const [onboardingUserId, setOnboardingUserId] = useState<string | null>(null)
  const [postOnboardingRoute, setPostOnboardingRoute] = useState('/discover')

  const runPostAuthFlow = useCallback(async (userId: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      await ensureUserProfile(user)
    }

    const { data, error } = await supabase
      .from('users')
      .select('role, preferences')
      .eq('id', userId)
      .single<UserRow>()

    if (error) {
      navigate('/discover')
      return
    }

    const targetRoute = resolveRouteByRole(data?.role)
    const preferences = data?.preferences
    const onboarded =
      typeof preferences === 'object' &&
      preferences !== null &&
      'onboarded' in preferences &&
      Boolean((preferences as { onboarded?: boolean }).onboarded)

    if (onboarded) {
      setIsOnboardingOpen(false)
      setOnboardingUserId(null)
      navigate(targetRoute)
      return
    }

    setPostOnboardingRoute(targetRoute)
    setOnboardingUserId(userId)
    setIsOnboardingOpen(true)
  }, [navigate])

  const openSignIn = () => {
    setAuthInitialView('signin')
    setIsAuthModalOpen(true)
  }

  const openSignUp = () => {
    setAuthInitialView('signup')
    setIsAuthModalOpen(true)
  }

  const handleAuthSuccess = async () => {
    setIsAuthModalOpen(false)

    const {
      data: { session },
    } = await supabase.auth.getSession()

    const userId = session?.user?.id
    if (!userId) {
      navigate('/discover')
      return
    }

    await ensureUserProfile(session.user)
    // onAuthStateChange handles post-auth routing/onboarding to avoid duplicate flow runs.
  }

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user?.id) {
        void ensureUserProfile(session.user).then(() => runPostAuthFlow(session.user.id))
      }
      if (event === 'SIGNED_OUT') {
        setIsOnboardingOpen(false)
        setOnboardingUserId(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [navigate, runPostAuthFlow])

  const contextValue = useMemo(
    () => ({
      openSignIn,
      openSignUp,
    }),
    [],
  )

  return (
    <AuthFlowContext.Provider value={contextValue}>
      {children}

      <AuthModal
        isOpen={isAuthModalOpen}
        initialView={authInitialView}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={() => {
          void handleAuthSuccess()
        }}
      />

      {onboardingUserId && (
        <OnboardingModal
          isOpen={isOnboardingOpen}
          userId={onboardingUserId}
          onComplete={() => {
            setIsOnboardingOpen(false)
            navigate(postOnboardingRoute)
          }}
        />
      )}
    </AuthFlowContext.Provider>
  )
}
