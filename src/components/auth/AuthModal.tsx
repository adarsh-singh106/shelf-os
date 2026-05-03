import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Eye, EyeOff, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'

type AuthView = 'signin' | 'signup'

type AuthModalProps = {
  isOpen: boolean
  initialView?: AuthView
  onClose: () => void
  onSuccess: () => void
}

type AuthErrorLike = {
  message: string
  status?: number
}

function getAuthErrorMessage(error: AuthErrorLike | null) {
  if (!error) return 'Authentication failed. Please try again.'

  const normalizedMessage = error.message.toLowerCase()
  const isRateLimitError =
    error.status === 429 ||
    normalizedMessage.includes('rate limit') ||
    normalizedMessage.includes('too many requests')

  if (isRateLimitError) {
    return 'Too many attempts. Please wait about a minute before trying again.'
  }

  return error.message
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4.5 w-4.5" focusable="false">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.8-5.5 3.8-3.3 0-6-2.8-6-6.2s2.7-6.2 6-6.2c1.9 0 3.2.8 4 1.5l2.7-2.7C17 2.7 14.8 1.8 12 1.8 6.9 1.8 2.8 6 2.8 11.2S6.9 20.6 12 20.6c6.9 0 9.2-4.9 9.2-7.4 0-.5 0-.8-.1-1.1z"
      />
      <path fill="#34A853" d="M2.8 11.2c0 1.7.6 3.3 1.6 4.6l3.5-2.7c-.2-.6-.3-1.2-.3-1.9s.1-1.3.3-1.9l-3.5-2.7c-1 1.3-1.6 2.9-1.6 4.6z" />
      <path fill="#4A90E2" d="M12 20.6c2.8 0 5.1-.9 6.9-2.4l-3.3-2.7c-.9.6-2.1 1-3.6 1-2.5 0-4.7-1.7-5.5-4L3 15c1.8 3.5 5.3 5.6 9 5.6z" />
      <path fill="#FBBC05" d="M6.5 12.5c-.2-.6-.3-1.2-.3-1.9s.1-1.3.3-1.9L3 6C2.3 7.4 1.8 9.2 1.8 11s.5 3.6 1.2 5l3.5-2.7z" />
    </svg>
  )
}

export default function AuthModal({ isOpen, initialView = 'signin', onClose, onSuccess }: AuthModalProps) {
  const [view, setView] = useState<AuthView>(initialView)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const raf1 = requestAnimationFrame(() => setView(initialView))
    const raf2 = requestAnimationFrame(() => setError(null))
    const raf3 = requestAnimationFrame(() => setNotice(null))
    const raf4 = requestAnimationFrame(() => setPassword(''))

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }

      if (event.key !== 'Tab' || !modalRef.current) return

      const focusable = modalRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled])',
      )

      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
      cancelAnimationFrame(raf3)
      cancelAnimationFrame(raf4)
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [initialView, isOpen, onClose])

  const passwordStrength = useMemo(() => {
    if (password.length === 0) return 0
    if (password.length < 6) return 1
    if (password.length < 8) return 2
    if (password.length < 12) return 3
    return 4
  }, [password.length])

  if (!isOpen) {
    return null
  }

  const resetError = () => {
    if (error) setError(null)
  }

  const resetNotice = () => {
    if (notice) setNotice(null)
  }

  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loading) return
    resetError()
    resetNotice()

    setLoading(true)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)

    if (signInError) {
      setError(getAuthErrorMessage(signInError))
      return
    }

    onSuccess()
  }

  const handleSignUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loading) return
    resetError()
    resetNotice()

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/discover`,
      },
    })

    if (signUpError) {
      setLoading(false)
      setError(getAuthErrorMessage(signUpError))
      return
    }
    setLoading(false)
    setNotice('We sent a magic link to your email. Open it to verify your account and sign in.')
  }

  const handleGoogleSignIn = async () => {
    if (loading) return
    resetError()
    resetNotice()

    setLoading(true)
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/discover` },
    })
    setLoading(false)

    if (oauthError) {
      setError(getAuthErrorMessage(oauthError))
    }
  }

  const renderError = () => {
    if (!error) return null

    return (
      <div className="rounded-lg border border-danger/20 bg-danger/10 px-3.5 py-2.5 text-sm text-danger" role="alert">
        {error}
      </div>
    )
  }

  const renderNotice = () => {
    if (!notice) return null

    return (
      <div className="rounded-lg border border-ok/25 bg-ok/10 px-3.5 py-2.5 text-sm text-ok" role="status">
        {notice}
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <style>{`
        @keyframes auth-modal-enter {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <div
        ref={modalRef}
        className="relative w-full max-w-[440px] rounded-card border border-border bg-raised px-8 py-7 shadow-2xl shadow-black/50"
        style={{ animation: 'auth-modal-enter 150ms ease-out' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
      >
        <button
          type="button"
          aria-label="Close authentication modal"
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors duration-150 hover:bg-white/8 hover:text-white"
        >
          <X size={18} />
        </button>

        <div className="mb-6 space-y-3">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-lg font-semibold text-white">
            S
          </div>
          <div>
            <h2 id="auth-modal-title" className="font-display text-3xl italic text-white">
              {view === 'signin' ? 'Welcome back' : 'Create account'}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {view === 'signin'
                ? 'Sign in to your GECA ShelfOS account'
                : 'Join ShelfOS - free for all GECA students'}
            </p>
          </div>
        </div>

        {view === 'signin' && (
          <form className="space-y-4" onSubmit={handleSignIn}>
            <label className="sr-only" htmlFor="auth-signin-email">Email</label>
            <input
              id="auth-signin-email"
              type="email"
              value={email}
              onChange={(event) => {
                resetError()
                resetNotice()
                setEmail(event.target.value)
              }}
              className="h-11 w-full rounded-lg border border-border bg-surface px-3.5 text-sm text-white outline-none transition-colors duration-150 focus:border-accent"
              placeholder="your@geca.ac.in"
              autoComplete="email"
              required
            />

            <label className="sr-only" htmlFor="auth-signin-password">Password</label>
            <div className="relative">
              <input
                id="auth-signin-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => {
                  resetError()
                  resetNotice()
                  setPassword(event.target.value)
                }}
                className="h-11 w-full rounded-lg border border-border bg-surface px-3.5 pr-11 text-sm text-white outline-none transition-colors duration-150 focus:border-accent"
                placeholder="Enter password"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted transition-colors duration-150 hover:text-white"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <button
              type="submit"
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-accent text-sm font-semibold text-white transition duration-150 ease hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>

            {renderError()}
            {renderNotice()}

            <div className="flex items-center gap-3 py-1 text-xs uppercase tracking-[0.14em] text-ghost">
              <span className="h-px flex-1 bg-white/10" />
              or
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <button
              type="button"
              onClick={() => void handleGoogleSignIn()}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface text-sm font-medium text-white/90 transition duration-150 ease hover:bg-overlay"
              disabled={loading}
            >
              <GoogleIcon />
              Continue with Google
            </button>

            <p className="text-center text-sm text-muted">
              Don&apos;t have an account?{' '}
              <button
                type="button"
                className="font-semibold text-accent"
                onClick={() => {
                  setError(null)
                  setNotice(null)
                  setView('signup')
                }}
              >
                Sign up
              </button>
            </p>
          </form>
        )}

        {view === 'signup' && (
          <form className="space-y-4" onSubmit={handleSignUp}>
            <label className="sr-only" htmlFor="auth-signup-email">Email</label>
            <input
              id="auth-signup-email"
              type="email"
              value={email}
              onChange={(event) => {
                resetError()
                resetNotice()
                setEmail(event.target.value)
              }}
              className="h-11 w-full rounded-lg border border-border bg-surface px-3.5 text-sm text-white outline-none transition-colors duration-150 focus:border-accent"
              placeholder="your@geca.ac.in"
              autoComplete="email"
              required
            />

            <label className="sr-only" htmlFor="auth-signup-password">Password</label>
            <div className="relative">
              <input
                id="auth-signup-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => {
                  resetError()
                  resetNotice()
                  setPassword(event.target.value)
                }}
                className="h-11 w-full rounded-lg border border-border bg-surface px-3.5 pr-11 text-sm text-white outline-none transition-colors duration-150 focus:border-accent"
                placeholder="Create password"
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted transition-colors duration-150 hover:text-white"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-4 gap-1.5">
                {Array.from({ length: 4 }).map((_, index) => {
                  let activeColor = 'bg-border'
                  if (passwordStrength === 1) activeColor = 'bg-danger'
                  if (passwordStrength === 2) activeColor = 'bg-warn'
                  if (passwordStrength === 3) activeColor = 'bg-accent'
                  if (passwordStrength === 4) activeColor = 'bg-ok'

                  const isActive = index < passwordStrength
                  return <div key={index} className={`h-[3px] rounded-sm ${isActive ? activeColor : 'bg-border'}`} />
                })}
              </div>
              <p className="text-xs text-muted">Use 8+ characters for a stronger password.</p>
            </div>

            <button
              type="submit"
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-accent text-sm font-semibold text-white transition duration-150 ease hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={loading}
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>

            {renderError()}
            {renderNotice()}

            <button
              type="button"
              onClick={() => void handleGoogleSignIn()}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface text-sm font-medium text-white/90 transition duration-150 ease hover:bg-overlay"
              disabled={loading}
            >
              <GoogleIcon />
              Continue with Google
            </button>

            <p className="text-center text-sm text-muted">
              Already have an account?{' '}
              <button
                type="button"
                className="font-semibold text-accent"
                onClick={() => {
                  setError(null)
                  setNotice(null)
                  setView('signin')
                }}
              >
                Sign in
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
