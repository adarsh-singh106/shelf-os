import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { TableUpdate } from '../../types/db'

type Step = 1 | 2 | 3

type OnboardingModalProps = {
  isOpen: boolean
  userId: string
  onComplete: () => void
}

const readerTypes = ['🎓 Student', '🔬 Researcher', '📖 Casual Reader', '💼 Professional'] as const
const genres = [
  '📚 Fiction',
  '🚀 Sci-Fi',
  '🏛️ History',
  '👤 Biography',
  '🧘 Self-Help',
  '🔍 Mystery',
  '🐉 Fantasy',
  '💻 Technology',
  '✍️ Poetry',
  '🕉️ Religion & Philosophy',
  '📰 Social Science',
  '🎨 Arts',
] as const
const styles = ['📗 One at a time', '📚 Multiple books'] as const
const paces = ['🏃 Quick reads', '🧠 Deep dives'] as const

function cleanPreferenceLabel(value: string | null) {
  return value?.replace(/^[^\p{L}\p{N}]+/u, '').trim() ?? null
}

export default function OnboardingModal({ isOpen, userId, onComplete }: OnboardingModalProps) {
  const [step, setStep] = useState<Step>(1)
  const [renderedStep, setRenderedStep] = useState<Step>(1)
  const [transitionPhase, setTransitionPhase] = useState<'idle' | 'leaving' | 'entering'>('idle')
  const [readerType, setReaderType] = useState<string | null>(null)
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  const [readingStyle, setReadingStyle] = useState<string | null>(null)
  const [readingPace, setReadingPace] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return

    const raf1 = requestAnimationFrame(() => setStep(1))
    const raf2 = requestAnimationFrame(() => setRenderedStep(1))
    const raf3 = requestAnimationFrame(() => setTransitionPhase('idle'))
    const raf4 = requestAnimationFrame(() => setReaderType(null))
    const raf5 = requestAnimationFrame(() => setSelectedGenres([]))
    const raf6 = requestAnimationFrame(() => setReadingStyle(null))
    const raf7 = requestAnimationFrame(() => setReadingPace(null))
    const raf8 = requestAnimationFrame(() => setError(null))

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
      cancelAnimationFrame(raf3)
      cancelAnimationFrame(raf4)
      cancelAnimationFrame(raf5)
      cancelAnimationFrame(raf6)
      cancelAnimationFrame(raf7)
      cancelAnimationFrame(raf8)
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  const canContinueStep1 = Boolean(readerType)
  const canContinueStep2 = selectedGenres.length > 0
  const canFinish = Boolean(readingStyle && readingPace)

  const transitionStep = (nextStep: Step) => {
    if (nextStep === step || transitionPhase !== 'idle') return

    setTransitionPhase('leaving')
    window.setTimeout(() => {
      setStep(nextStep)
      setRenderedStep(nextStep)
      setTransitionPhase('entering')
      window.setTimeout(() => {
        setTransitionPhase('idle')
      }, 150)
    }, 150)
  }

  const chipClassName = (selected: boolean, disabled = false) => {
    if (selected) {
      return 'bg-accent/15 border-accent text-accent'
    }

    if (disabled) {
      return 'cursor-not-allowed border-border bg-surface text-muted opacity-40'
    }

    return 'border-border bg-surface text-white/80 hover:bg-overlay'
  }

  const stepMotionClass = useMemo(() => {
    if (transitionPhase === 'leaving') return 'opacity-0 -translate-x-5'
    if (transitionPhase === 'entering') return 'opacity-0 translate-x-5'
    return 'opacity-100 translate-x-0'
  }, [transitionPhase])

  const toggleGenre = (genre: string) => {
    if (error) setError(null)
    setSelectedGenres((current) => {
      if (current.includes(genre)) {
        return current.filter((item) => item !== genre)
      }

      if (current.length >= 4) {
        return current
      }

      return [...current, genre]
    })
  }

  const savePreferences = async () => {
    if (!canFinish || saving) return

    setError(null)
    setSaving(true)

    const updatePayload = {
      preferences: {
        reader_type: cleanPreferenceLabel(readerType),
        genres: selectedGenres.map((genre) => cleanPreferenceLabel(genre)).filter((genre): genre is string => Boolean(genre)),
        reading_style: cleanPreferenceLabel(readingStyle),
        reading_pace: cleanPreferenceLabel(readingPace),
        onboarded: true,
      },
    } satisfies TableUpdate<'users'>

    const { error: updateError } = await supabase
      .from('users')
      .update(updatePayload)
      .eq('id', userId)
      .select('id')
      .single()

    setSaving(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    onComplete()
  }

  const skipOnboarding = async () => {
    if (saving) return

    setError(null)
    setSaving(true)

    const { data: existing, error: existingError } = await supabase
      .from('users')
      .select('preferences')
      .eq('id', userId)
      .single()

    if (existingError) {
      setSaving(false)
      setError(existingError.message)
      return
    }

    const existingPreferences =
      existing?.preferences && typeof existing.preferences === 'object'
        ? (existing.preferences as Record<string, unknown>)
        : {}

    const { error: updateError } = await supabase
      .from('users')
      .update({
        preferences: {
          ...existingPreferences,
          onboarded: true,
        },
      } satisfies TableUpdate<'users'>)
      .eq('id', userId)
      .select('id')
      .single()

    setSaving(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    onComplete()
  }

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
      <style>{`
        @keyframes onboarding-modal-enter {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <section
        className="relative w-full max-w-[480px] rounded-card border border-border bg-raised px-8 py-7 shadow-2xl shadow-black/60"
        style={{ animation: 'onboarding-modal-enter 150ms ease-out' }}
        aria-modal="true"
        role="dialog"
        aria-labelledby="onboarding-title"
      >
        <button
          type="button"
          onClick={() => void skipOnboarding()}
          disabled={saving}
          className="absolute right-8 top-7 text-xs text-muted transition-colors duration-150 hover:text-white"
        >
          {saving ? 'Saving...' : 'Skip for now'}
        </button>

        <header className="mb-8 flex justify-center">
          <div className="flex items-center gap-1.5">
            {[1, 2, 3].map((dot) => {
              const active = dot === step
              return (
                <span
                  key={dot}
                  className={`h-2 rounded-full transition-all duration-150 ${active ? 'w-6 bg-accent' : 'w-2 bg-border'}`}
                />
              )
            })}
          </div>
        </header>

        <div className={`transition-all duration-150 ${stepMotionClass}`}>
          {renderedStep === 1 && (
            <div>
              <h2 id="onboarding-title" className="font-display text-[26px] italic text-white">Who are you?</h2>
              <p className="mb-7 mt-2 text-[13px] text-muted">Helps us show you the right books</p>

              <div className="flex flex-wrap gap-2.5">
                {readerTypes.map((item) => {
                  const selected = readerType === item
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        if (error) setError(null)
                        setReaderType(item)
                      }}
                      className={`h-10 rounded-full border px-[18px] text-sm transition-colors duration-150 ${chipClassName(selected)}`}
                    >
                      {item}
                    </button>
                  )
                })}
              </div>

              <button
                type="button"
                disabled={!canContinueStep1}
                onClick={() => transitionStep(2)}
                className="mt-8 h-12 w-full rounded-lg bg-accent text-base font-semibold text-white transition duration-150 ease hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Continue →
              </button>
            </div>
          )}

          {renderedStep === 2 && (
            <div>
              <h2 id="onboarding-title" className="font-display text-[26px] italic text-white">What do you love reading?</h2>
              <p className="mb-7 mt-2 text-[13px] text-muted">Pick up to 4 genres</p>

              <div className="flex flex-wrap gap-2.5">
                {genres.map((item) => {
                  const selected = selectedGenres.includes(item)
                  const disabled = !selected && selectedGenres.length >= 4
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        if (!disabled || selected) toggleGenre(item)
                      }}
                      disabled={disabled && !selected}
                      className={`h-10 rounded-full border px-[18px] text-sm transition-colors duration-150 ${chipClassName(selected, disabled)}`}
                    >
                      {item}
                    </button>
                  )
                })}
              </div>

              <p className="mt-4 text-xs text-muted">{selectedGenres.length}/4 selected</p>

              <button
                type="button"
                disabled={!canContinueStep2}
                onClick={() => transitionStep(3)}
                className="mt-7 h-12 w-full rounded-lg bg-accent text-base font-semibold text-white transition duration-150 ease hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Continue →
              </button>

              <button
                type="button"
                className="mt-3 text-[13px] text-muted transition-colors duration-150 hover:text-white"
                onClick={() => transitionStep(1)}
              >
                ← Back
              </button>
            </div>
          )}

          {renderedStep === 3 && (
            <div>
              <h2 id="onboarding-title" className="font-display text-[26px] italic text-white">How do you read?</h2>
              <p className="mb-6 mt-2 text-[13px] text-muted">Your last step - we promise</p>

              <div className="space-y-6">
                <div>
                  <p className="mb-2 text-[12px] uppercase tracking-[0.08em] text-muted">Books at a time</p>
                  <div className="flex flex-wrap gap-2.5">
                    {styles.map((item) => {
                      const selected = readingStyle === item
                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => {
                            if (error) setError(null)
                            setReadingStyle(item)
                          }}
                          className={`h-10 rounded-full border px-[18px] text-sm transition-colors duration-150 ${chipClassName(selected)}`}
                        >
                          {item}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-[12px] uppercase tracking-[0.08em] text-muted">Reading depth</p>
                  <div className="flex flex-wrap gap-2.5">
                    {paces.map((item) => {
                      const selected = readingPace === item
                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => {
                            if (error) setError(null)
                            setReadingPace(item)
                          }}
                          className={`h-10 rounded-full border px-[18px] text-sm transition-colors duration-150 ${chipClassName(selected)}`}
                        >
                          {item}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              <button
                type="button"
                disabled={!canFinish || saving}
                onClick={() => void savePreferences()}
                className="mt-8 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-accent text-base font-semibold text-white transition duration-150 ease hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Set up my shelf ✓'
                )}
              </button>

              {error && (
                <div className="mt-3 rounded-lg border border-danger/20 bg-danger/10 px-3.5 py-2.5 text-sm text-danger" role="alert">
                  {error}
                </div>
              )}

              <button
                type="button"
                className="mt-3 text-[13px] text-muted transition-colors duration-150 hover:text-white"
                onClick={() => transitionStep(2)}
              >
                ← Back
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
