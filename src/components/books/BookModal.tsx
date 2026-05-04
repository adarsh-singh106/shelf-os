import { Star, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useRequestBorrow } from '../../hooks/useBorrow'
import type { TableRow } from '../../types/db'

type ModalBook = {
  id: number
  title: string
  authors: string[]
  genres: string[]
  publisherName?: string | null
  coverUrl: string | null
  isbn: string | null
  format: string
  language: string
  publishedDate: string | null
  description: string | null
  avgRating: number
  reviewCount: number
  availableCopies: number
  totalCopies: number
  waitlistCount?: number
}

interface BookModalProps {
  book: ModalBook | null
  isOpen: boolean
  onClose: () => void
  userId: string | null
}

type WaitlistEntry = Pick<TableRow<'waitlist'>, 'id'>
type ReviewRow = TableRow<'reviews'> & {
  users: Pick<TableRow<'users'>, 'username' | 'avatar_url'> | null
}

const FALLBACK_GRADIENTS = [
  'linear-gradient(135deg, #1a3a5c, #2d6b9e)',
  'linear-gradient(135deg, #3a1a1a, #8c3030)',
  'linear-gradient(135deg, #1a3a1a, #2d7a2d)',
  'linear-gradient(135deg, #2d1a3a, #6b2d8c)',
  'linear-gradient(135deg, #3a2a1a, #8c6b2d)',
  'linear-gradient(135deg, #1a2d3a, #2d6b8c)',
  'linear-gradient(135deg, #3a1a2d, #8c2d6b)',
  'linear-gradient(135deg, #1a1a3a, #3a3a8c)',
]

export default function BookModal({ book, isOpen, onClose, userId }: BookModalProps) {
  const queryClient = useQueryClient()
  const [expandedDescription, setExpandedDescription] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [coverReady, setCoverReady] = useState(true)

  const requestBorrowMutation = useRequestBorrow()

  useEffect(() => {
    if (!isOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  useEffect(() => {
    if (book?.coverUrl) {
      const raf = requestAnimationFrame(() => setCoverReady(true))
      return () => cancelAnimationFrame(raf)
    }
  }, [book?.coverUrl])

  const { data: waitlistEntry } = useQuery<WaitlistEntry | null>({
    queryKey: ['book-waitlist', book?.id, userId],
    enabled: Boolean(book?.id && userId && book?.format !== 'digital'),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('waitlist')
        .select('id')
        .eq('book_id', book!.id)
        .eq('user_id', userId!)
        .maybeSingle()
        .returns<WaitlistEntry>()

      if (error) throw error
      return data
    },
  })

  const { data: reviews = [] } = useQuery<ReviewRow[]>({
    queryKey: ['book-reviews', book?.id],
    enabled: Boolean(book?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reviews')
        .select('id, rating, body, created_at, users(username, avatar_url)')
        .eq('book_id', book!.id)
        .order('created_at', { ascending: false })
        .limit(5)
        .returns<ReviewRow[]>()

      if (error) throw error
      return data ?? []
    },
  })

  const gradient = useMemo(() => {
    if (!book) return FALLBACK_GRADIENTS[0]
    return FALLBACK_GRADIENTS[(book.title.charCodeAt(0) || 0) % FALLBACK_GRADIENTS.length]
  }, [book])

  if (!isOpen || !book) return null

  const isOnWaitlist = Boolean(waitlistEntry)

  const requestBorrow = async () => {
    if (!userId || !book) return

    setActionError(null)
    setStatusMessage(null)

    try {
      const response = await requestBorrowMutation.mutateAsync({
        userId,
        bookId: book.id,
      })

      const normalized = String(response).toUpperCase()
      if (normalized.includes('WAITLIST')) {
        setStatusMessage('Added to waitlist successfully.')
      } else {
        setStatusMessage('Visit the library counter to collect your book. Librarian will confirm within the day.')
      }

      await queryClient.invalidateQueries({ queryKey: ['landing-stats'] })
      await queryClient.invalidateQueries({ queryKey: ['inventory-books'] })
      await queryClient.invalidateQueries({ queryKey: ['book-waitlist', book.id, userId] })
      await queryClient.invalidateQueries({ queryKey: ['shelf-active', userId] })
      await queryClient.invalidateQueries({ queryKey: ['shelf-waitlist', userId] })
      await queryClient.invalidateQueries({ queryKey: ['books'] })
      await queryClient.invalidateQueries({ queryKey: ['trending'] })
    } catch (err) {
      setActionError((err as Error).message)
    }
  }

  const showReadMore = (book.description?.length ?? 0) > 220

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[4px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <style>{`
        @keyframes modal-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modal-card {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <section className="relative mx-auto mt-[7vh] max-h-[85vh] w-[min(900px,92vw)] overflow-hidden rounded-card border border-border" style={{ animation: 'modal-fade 150ms ease' }}>
        <div
          className="pointer-events-none absolute inset-[-40px] scale-110"
          style={{
            backgroundImage: book.coverUrl && coverReady ? `url(${book.coverUrl})` : gradient,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(60px) saturate(0.6) brightness(0.25)',
          }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(5,7,10,0.85)_0%,rgba(5,7,10,0.7)_100%)]" />

        <div className="relative z-10 flex max-h-[85vh] flex-col overflow-hidden md:flex-row" style={{ animation: 'modal-card 150ms ease' }}>
          <aside className="shrink-0 px-8 pb-4 pt-8 md:w-[220px]">
            <div className="mx-auto h-[210px] w-[140px] overflow-hidden rounded-[10px] shadow-[0_40px_80px_rgba(0,0,0,0.8)] md:h-[285px] md:w-[190px]">
              {book.coverUrl && coverReady ? (
                <img
                  src={book.coverUrl}
                  alt={book.title}
                  className="h-full w-full object-cover"
                  onError={() => setCoverReady(false)}
                />
              ) : (
                <div className="grid h-full place-items-center" style={{ background: gradient }}>
                  <span className="font-display text-5xl italic text-white">{book.title[0]?.toUpperCase() ?? 'B'}</span>
                </div>
              )}
            </div>

            <div className="mx-auto mt-4 w-[190px]">
              {book.totalCopies > 5 ? (
                <p className="text-[11px] text-muted">{book.availableCopies} of {book.totalCopies} available</p>
              ) : (
                <>
                  <div className="flex gap-1">
                    {Array.from({ length: book.totalCopies }).map((_, index) => (
                      <span
                        key={index}
                        className={`h-1.5 w-1.5 rounded-full ${index < book.availableCopies ? 'bg-ok' : 'bg-white/30'}`}
                      />
                    ))}
                  </div>
                  <p className="mt-1 text-[11px] text-muted">{book.availableCopies} of {book.totalCopies} available</p>
                </>
              )}
              {book.waitlistCount !== undefined && book.waitlistCount > 0 && (
                <p className="mt-1 text-[11px] text-waitlist font-bold italic">
                  {book.waitlistCount} {book.waitlistCount === 1 ? 'person' : 'people'} already waiting
                </p>
              )}
            </div>
          </aside>

          <div className="relative flex-1 overflow-y-auto px-6 pb-8 pt-8 md:pr-8">
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/8 hover:bg-white/15"
              aria-label="Close"
            >
              <X size={16} />
            </button>

            <span className="inline-flex rounded-full bg-white/8 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              {book.format.toUpperCase()} · {book.language}
            </span>

            <h2 className="mt-3 font-display text-[22px] italic leading-tight text-white md:text-[32px]">{book.title}</h2>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {book.authors.map((author) => (
                <span key={author} className="rounded-full border border-accent/20 bg-accent/12 px-3 py-1 text-xs text-accent">
                  {author}
                </span>
              ))}
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {book.genres.map((genre) => (
                <span key={genre} className="rounded-full border border-border bg-white/6 px-2.5 py-1 text-[11px] text-muted">
                  {genre}
                </span>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-5">
              <div className="inline-flex items-center gap-1">
                <Star size={14} className="fill-warn text-warn" />
                <span className="font-mono text-[15px] text-warn">{book.avgRating.toFixed(1)}</span>
              </div>
              <span className="text-sm text-muted">{book.reviewCount} reviews</span>
              <span className="text-sm text-muted">{book.publishedDate ? new Date(book.publishedDate).getFullYear() : '—'}</span>
              {book.publisherName && (
                <span className="text-sm text-muted">Published by <span className="text-white/80">{book.publisherName}</span></span>
              )}
            </div>

            <div className="my-4 h-px bg-border" />

            <p className={`text-sm leading-7 text-muted ${expandedDescription ? '' : 'line-clamp-4'}`}>
              {book.description || 'No description available.'}
            </p>
            {showReadMore ? (
              <button type="button" onClick={() => setExpandedDescription((value) => !value)} className="mt-1 text-xs text-accent transition-colors duration-150 hover:text-white">
                {expandedDescription ? 'Read less' : 'Read more'}
              </button>
            ) : null}

            <div className="mt-6">
              {book.format === 'digital' ? (
                <button type="button" disabled className="h-12 w-full rounded-lg bg-white/10 text-[15px] font-semibold text-muted">
                  Digital copy unavailable
                </button>
              ) : book.availableCopies > 0 ? (
                <button
                  type="button"
                  onClick={() => void requestBorrow()}
                  disabled={requestBorrowMutation.isPending || statusMessage?.includes('Visit the library counter')}
                  className={`h-12 w-full rounded-lg text-[15px] font-semibold ${
                    statusMessage?.includes('Visit the library counter') ? 'bg-ok text-[#05070a]' : 'bg-accent text-white'
                  }`}
                >
                  {requestBorrowMutation.isPending ? 'Processing...' : statusMessage?.includes('Visit the library counter') ? 'Requested ✓' : 'Request Borrow'}
                </button>
              ) : isOnWaitlist || statusMessage?.includes('waitlist') ? (
                <button type="button" disabled className="h-12 w-full rounded-lg border border-waitlist bg-waitlist/20 text-[15px] font-semibold text-waitlist">
                  On Waitlist ✓
                </button>
              ) : (
                <button 
                  type="button" 
                  onClick={() => void requestBorrow()} 
                  disabled={requestBorrowMutation.isPending} 
                  className="h-12 w-full rounded-lg border border-waitlist text-[15px] font-semibold text-waitlist hover:bg-waitlist/10 transition-colors"
                >
                  {requestBorrowMutation.isPending ? 'Joining...' : 'Join Waitlist'}
                </button>
              )}

              {book.format !== 'digital' ? (
                <p className="mt-2 text-xs text-muted">Borrow period: 14 days · Pick up at GECA library counter</p>
              ) : null}
              {statusMessage ? <p className="mt-2 text-xs text-ok">{statusMessage}</p> : null}
              {actionError ? <p className="mt-2 text-xs text-danger">{actionError}</p> : null}
            </div>

            <div className="mt-6">
              <h3 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-muted">Reviews</h3>
              {reviews.length === 0 ? (
                <p className="mt-3 text-sm italic text-muted">No reviews yet. Be the first!</p>
              ) : (
                <div className="mt-2 space-y-0">
                  {reviews.map((review) => {
                    const username = review.users?.username ?? 'Reader'
                    const initials = username
                      .split(' ')
                      .slice(0, 2)
                      .map((segment) => segment[0]?.toUpperCase() ?? '')
                      .join('')
                      .slice(0, 2)

                    return (
                      <article key={review.id} className="border-b border-border/60 py-3">
                        <div className="flex items-center gap-2">
                          <div className="grid h-7 w-7 place-items-center rounded-full bg-accent text-[10px] font-semibold text-white">{initials || 'R'}</div>
                          <p className="text-[13px] text-white">{username}</p>
                          <p className="font-mono text-xs text-warn">★ {Number(review.rating ?? 0).toFixed(1)}</p>
                          <p className="text-[11px] text-muted">{review.created_at ? new Date(review.created_at).toLocaleDateString() : '—'}</p>
                        </div>
                        <p className="mt-1 text-[13px] text-white/80">{review.body ?? ''}</p>
                      </article>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
