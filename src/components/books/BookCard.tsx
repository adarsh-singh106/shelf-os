import { Star } from 'lucide-react'
import { useState } from 'react'

export interface BookCardProps {
  id: number
  title: string
  authors: string[]
  coverUrl: string | null
  isbn: string | null
  format: 'novel' | 'manga' | 'magazine' | 'textbook' | 'digital'
  availableCopies: number
  totalCopies: number
  avgRating: number
  genres: string[]
  onClick: () => void
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

function AvailabilityBadge({ format, availableCopies }: { format: BookCardProps['format']; availableCopies: number }) {
  if (format === 'digital') {
    return <span className="rounded-md bg-accent/20 px-1.5 py-0.5 text-[9px] font-semibold text-accent">Digital</span>
  }

  if (availableCopies > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-ok/20 px-1.5 py-0.5 text-[9px] font-semibold text-ok">
        <span className="h-1.25 w-1.25 rounded-full bg-ok" />
        {availableCopies} avail
      </span>
    )
  }

  return <span className="rounded-md bg-waitlist/20 px-1.5 py-0.5 text-[9px] font-semibold text-waitlist">Waitlist</span>
}

export default function BookCard(props: BookCardProps) {
  const {
    title,
    authors,
    coverUrl,
    format,
    availableCopies,
    totalCopies,
    avgRating,
    onClick,
  } = props

  const [coverReady, setCoverReady] = useState(true)
  const firstAuthor = authors[0] ?? 'Unknown Author'
  const authorLabel = authors.length > 1 ? `${firstAuthor} et al.` : firstAuthor
  const gradient = FALLBACK_GRADIENTS[(title.charCodeAt(0) || 0) % FALLBACK_GRADIENTS.length]
  const showFallback = !coverUrl || !coverReady
  const actionLabel =
    format === 'digital' ? 'Read Now' : availableCopies > 0 ? 'Request Borrow' : 'Join Waitlist'
  const actionClass =
    format === 'digital'
      ? 'bg-ok text-[#05070a]'
      : availableCopies > 0
        ? 'bg-accent text-white'
        : 'bg-waitlist text-white'

  return (
    <div onClick={onClick} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onClick()} className="group w-[150px] shrink-0 cursor-pointer text-left">
      <div className="relative h-[225px] overflow-hidden rounded-[10px] border border-border transition-transform duration-150 ease group-hover:-translate-y-1.5">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={title}
            className="h-full w-full object-cover"
            loading="lazy"
            onError={(event) => {
              setCoverReady(false)
              event.currentTarget.style.display = 'none'
            }}
          />
        ) : null}

        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            background: gradient,
            opacity: showFallback ? 1 : 0,
            transition: 'opacity 150ms ease',
          }}
        >
          <span className="font-display text-5xl italic text-white">{title[0]?.toUpperCase() ?? 'B'}</span>
        </div>

        <div className="absolute right-2 top-2">
          <AvailabilityBadge format={format} availableCopies={availableCopies} />
        </div>

        <div className="absolute inset-x-2 bottom-2 translate-y-4 opacity-0 transition duration-150 group-hover:translate-y-0 group-hover:opacity-100">
          <div className="rounded-md bg-black/75 p-1.5">
            <button
              type="button"
              className={`h-8 w-full rounded-md border-none text-[11px] font-semibold ${actionClass}`}
              onClick={(e) => {
                e.stopPropagation()
                onClick()
              }}
            >
              {actionLabel}
            </button>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-0 bg-black/0 transition duration-150 group-hover:bg-black/75" />
      </div>

      <h3 className="mt-2 line-clamp-2 font-display text-xs italic leading-[1.35] text-white">{title}</h3>
      <p className="mt-0.75 truncate text-[10px] text-muted">{authorLabel}</p>

      {avgRating > 0 ? (
        <div className="mt-1 inline-flex items-center gap-1">
          <Star size={10} className="fill-warn text-warn" />
          <span className="font-mono text-[10px] text-warn">{avgRating.toFixed(1)}</span>
        </div>
      ) : (
        <p className="mt-1 text-[10px] text-muted">{availableCopies}/{totalCopies} copies</p>
      )}
    </div>
  )
}
