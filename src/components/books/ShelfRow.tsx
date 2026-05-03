import BookCard, { type BookCardProps } from './BookCard'

export interface ShelfRowProps {
  title: string
  books: BookCardProps[]
  onBookClick: (book: BookCardProps) => void
  loading?: boolean
}

function SkeletonCard({ index }: { index: number }) {
  return (
    <div key={index} className="w-[150px] shrink-0">
      <div
        className="h-[225px] rounded-[10px] border border-border"
        style={{
          background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)',
          backgroundSize: '200% 100%',
          animation: 'shelf-shimmer 1.5s infinite',
        }}
      />
      <div className="mt-2 h-3 w-5/6 rounded bg-white/10" />
      <div className="mt-1 h-2.5 w-3/5 rounded bg-white/8" />
    </div>
  )
}

export default function ShelfRow({ title, books, onBookClick, loading = false }: ShelfRowProps) {
  return (
    <section className="mb-9">
      <style>{`
        @keyframes shelf-shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>

      <header className="mb-3.5 flex items-center justify-between">
        <h2 className="font-display text-[15px] italic text-white">{title}</h2>
      </header>

      <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {loading
          ? Array.from({ length: 6 }).map((_, index) => <SkeletonCard key={index} index={index} />)
          : books.map((book) => (
              <BookCard key={book.id} {...book} onClick={() => onBookClick(book)} />
            ))}
      </div>

      {!loading && books.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-muted">No books found</p>
      ) : null}
    </section>
  )
}
