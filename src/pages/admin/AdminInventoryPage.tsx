import { Loader2, Sparkles, X, Edit2, PlusCircle, Upload, Image as ImageIcon } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Navigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import type { TableInsert, TableRow, ViewRow } from '../../types/db'

// book_details view: authors is string[]
type BookRow = ViewRow<'book_details'>

type GenreRow = TableRow<'genres'>
type PublisherRow = TableRow<'publishers'>

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

function readOpenLibraryNotes(value: unknown) {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'value' in value) {
    const nestedValue = (value as { value?: unknown }).value
    return typeof nestedValue === 'string' ? nestedValue : ''
  }
  return ''
}

export default function AdminInventoryPage() {
  const { isAdmin } = useAuth()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [editingId, setEditingId] = useState<number | null>(null)
  const [isbn, setIsbn] = useState('')
  const [title, setTitle] = useState('')
  const [authorNames, setAuthorNames] = useState('')
  const [genreId, setGenreId] = useState<number | ''>('')
  const [publisherName, setPublisherName] = useState('')
  const [format, setFormat] = useState<'novel' | 'manga' | 'magazine' | 'textbook' | 'digital'>('novel')
  const [publishedYear, setPublishedYear] = useState('')
  const [language, setLanguage] = useState('English')
  const [description, setDescription] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [copies, setCopies] = useState(3)
  const [search, setSearch] = useState('')

  const [fetchingIsbn, setFetchingIsbn] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { data: books = [] } = useQuery<BookRow[]>({
    queryKey: ['inventory-books', search],
    queryFn: async () => {
      let query = supabase
        .from('book_details')
        .select('*')
        .order('id', { ascending: false })

      const term = search.trim()
      
      if (term) {
        query = query.or(`title.ilike.%${term}%,isbn.ilike.%${term}%`)
      }

      const { data, error } = await query.limit(term ? 500 : 1000).returns<BookRow[]>()

      if (error) throw error
      
      const rows = data ?? []
      if (!term) return rows

      const lowerTerm = term.toLowerCase()
      return rows.filter((book) => {
        const searchStr = [
          book.title,
          book.isbn,
          book.format,
          ...(book.authors ?? []),
          ...(book.genres ?? []),
        ].join(' ').toLowerCase()
        return searchStr.includes(lowerTerm)
      })
    },
  })

  const { data: genres = [] } = useQuery<GenreRow[]>({
    queryKey: ['inventory-genres'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('genres')
        .select('id, name')
        .order('name')
        .returns<GenreRow[]>()
      if (error) throw error
      return data ?? []
    },
  })

  const { data: publishers = [] } = useQuery<PublisherRow[]>({
    queryKey: ['inventory-publishers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('publishers')
        .select('id, name')
        .order('name')
        .returns<PublisherRow[]>()
      if (error) throw error
      return data ?? []
    },
  })

  const filteredBooks = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return books
    return books.filter((book) => (book.title ?? '').toLowerCase().includes(term))
  }, [books, search])

  if (!isAdmin) return <Navigate to="/discover" replace />

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`
      const filePath = `${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('book-covers')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('book-covers')
        .getPublicUrl(filePath)

      setCoverUrl(publicUrl)
      setMessage('✓ Image uploaded successfully')
    } catch (err) {
      setError(`Upload failed: ${(err as Error).message}`)
    } finally {
      setUploading(false)
    }
  }

  const autofill = async () => {
    if (!isbn.trim()) return

    setFetchingIsbn(true)
    setError(null)
    setMessage(null)

    try {
      const response = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(isbn.trim())}&format=json&jscmd=data`)
      const payload = (await response.json()) as Record<string, any>
      const key = `ISBN:${isbn.trim()}`
      const data = payload[key]

      if (!data) {
        setMessage('ISBN not found. Fill in details manually.')
        return
      }

      setTitle(data.title ?? '')
      setAuthorNames((data.authors ?? []).map((author: { name: string }) => author.name).join(', '))
      setPublisherName((data.publishers ?? [])[0]?.name ?? '')
      setPublishedYear(String(data.publish_date ?? '').slice(-4))
      setDescription(readOpenLibraryNotes(data.notes) || (data.excerpts?.[0]?.text ?? ''))
      setCoverUrl(`https://covers.openlibrary.org/b/isbn/${isbn.trim()}-L.jpg`)
      setMessage('✓ Book details fetched!')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setFetchingIsbn(false)
    }
  }

  const resetForm = () => {
    setEditingId(null)
    setTitle('')
    setIsbn('')
    setAuthorNames('')
    setGenreId('')
    setPublisherName('')
    setFormat('novel')
    setPublishedYear('')
    setLanguage('English')
    setDescription('')
    setCoverUrl('')
    setCopies(3)
    setError(null)
    setMessage(null)
  }

  const handleEdit = async (book: BookRow) => {
    setEditingId(book.id ?? null)
    setTitle(book.title ?? '')
    setIsbn(book.isbn ?? '')
    setAuthorNames((book.authors ?? []).join(', '))
    setPublisherName(book.publisher_name ?? '')
    setFormat(book.format as any ?? 'novel')
    setPublishedYear(book.published_date ? book.published_date.slice(0, 4) : '')
    setLanguage(book.language ?? 'English')
    setDescription(book.description ?? '')
    setCoverUrl(book.cover_url ?? '')
    setCopies(book.total_copies ?? 3)
    setError(null)
    setMessage(null)

    if (book.genres?.[0]) {
      const g = genres.find(genre => genre.name === book.genres![0])
      if (g) setGenreId(g.id)
    } else {
      setGenreId('')
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const submit = async () => {
    if (!title.trim()) {
      setError('Title is required')
      return
    }

    setSaving(true)
    setError(null)
    setMessage(null)

    try {
      let publisherId: number | null = null
      if (publisherName.trim()) {
        const { data: publisher, error: publisherError } = await supabase
          .from('publishers')
          .upsert({ name: publisherName.trim() }, { onConflict: 'name' })
          .select('id')
          .single()
        
        if (publisherError) throw publisherError
        publisherId = publisher.id
      }

      const bookData = {
        title,
        isbn: isbn || null,
        format,
        language: language || null,
        published_date: publishedYear ? `${publishedYear}-01-01` : null,
        description: description || null,
        cover_url: coverUrl || null,
        publisher_id: publisherId,
      } satisfies TableInsert<'books'>

      let bookId: number

      if (editingId) {
        const { error: updateError } = await supabase
          .from('books')
          .update(bookData)
          .eq('id', editingId)
        
        if (updateError) throw updateError
        bookId = editingId

        await supabase.from('book_authors').delete().eq('book_id', bookId)
        await supabase.from('book_genres').delete().eq('book_id', bookId)
      } else {
        const { data: bookResult, error: bookError } = await supabase
          .from('books')
          .insert(bookData)
          .select('id')
          .single()

        if (bookError || !bookResult) throw bookError || new Error('Failed to create book')
        bookId = bookResult.id
      }

      if (genreId) {
        const { error: genreError } = await supabase
          .from('book_genres')
          .insert({ book_id: bookId, genre_id: genreId })
        if (genreError) throw genreError
      }

      const names = authorNames.split(',').map((name) => name.trim()).filter(Boolean)
      for (const name of names) {
        const { data: author, error: authorError } = await supabase
          .from('authors')
          .upsert({ name }, { onConflict: 'name' })
          .select('id')
          .single()

        if (authorError || !author) throw authorError || new Error(`Failed to handle author ${name}`)

        const { error: linkError } = await supabase
          .from('book_authors')
          .insert({ book_id: bookId, author_id: author.id })
        if (linkError) throw linkError
      }

      if (!editingId && format !== 'digital') {
        const copiesRows = Array.from({ length: copies }).map(() => ({
          book_id: bookId,
          status: 'available',
          acquired_at: new Date().toISOString(),
        })) satisfies TableInsert<'book_copies'>[]
        const { error: copiesError } = await supabase.from('book_copies').insert(copiesRows)
        if (copiesError) throw copiesError
      }

      setMessage(`✓ '${title}' ${editingId ? 'updated' : 'added'} successfully`)
      if (!editingId) resetForm()
      
      void queryClient.invalidateQueries({ queryKey: ['books'] })
      void queryClient.invalidateQueries({ queryKey: ['trending'] })
      void queryClient.invalidateQueries({ queryKey: ['inventory-books'] })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const deleteBook = async (bookId: number, bookTitle: string) => {
    if (!window.confirm(`Are you sure you want to delete '${bookTitle}'? This will remove all copies and history.`)) {
      return
    }

    setSaving(true)
    setError(null)
    setMessage(null)

    try {
      await supabase.from('book_copies').delete().eq('book_id', bookId)
      await supabase.from('book_authors').delete().eq('book_id', bookId)
      await supabase.from('book_genres').delete().eq('book_id', bookId)
      await supabase.from('borrow_history').delete().eq('book_id', bookId)
      await supabase.from('waitlist').delete().eq('book_id', bookId)
      await supabase.from('reviews').delete().eq('book_id', bookId)
      
      const { error: deleteError } = await supabase
        .from('books')
        .delete()
        .eq('id', bookId)

      if (deleteError) throw deleteError

      setMessage(`✓ '${bookTitle}' deleted from library`)
      void queryClient.invalidateQueries({ queryKey: ['books'] })
      void queryClient.invalidateQueries({ queryKey: ['trending'] })
      void queryClient.invalidateQueries({ queryKey: ['inventory-books'] })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="min-h-screen bg-void" style={{ padding: '28px 32px' }}>
      <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
        <section>
          <h1 className="font-display text-[24px] italic text-white">Book Inventory</h1>
          <p className="mb-3 text-sm text-muted">{books.length} books in library</p>

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by title"
            className="mb-3 h-[38px] w-full rounded-lg border border-border bg-surface px-3 text-sm text-white outline-none"
          />

          <div className="overflow-hidden rounded-card border border-border bg-surface">
            <div className="grid grid-cols-[52px_2fr_1fr_1fr_1fr_80px] bg-white/4 px-4 py-2 text-[11px] uppercase tracking-[0.05em] text-muted">
              <p>Cover</p><p>Title & Author</p><p>Format</p><p>Copies</p><p>Rating</p><p></p>
            </div>

            {filteredBooks.slice(0, 50).map((book) => (
              <div key={book.id} className="grid grid-cols-[52px_2fr_1fr_1fr_1fr_80px] items-center border-b border-border/60 px-4 py-3 hover:bg-white/2 transition-colors">
                <div className="relative h-12 w-8 overflow-hidden rounded border border-border bg-white/8">
                  <div
                    className="absolute inset-0 grid place-items-center font-display text-[11px] italic text-white"
                    style={{ background: FALLBACK_GRADIENTS[(book.title?.charCodeAt(0) || 0) % FALLBACK_GRADIENTS.length] }}
                  >
                    {book.title?.[0]?.toUpperCase() ?? 'B'}
                  </div>
                  {book.cover_url ? (
                    <img
                      src={book.cover_url}
                      alt={book.title ?? ''}
                      className="relative z-10 h-full w-full object-cover"
                      onError={(event) => {
                        event.currentTarget.style.display = 'none'
                      }}
                    />
                  ) : null}
                </div>
                <div>
                  <p className="truncate text-sm text-white font-medium">{book.title}</p>
                  <p className="text-[11px] text-muted">{book.authors?.[0] ?? 'Unknown Author'}</p>
                </div>
                <span className="w-fit rounded-full bg-white/8 px-2 py-0.5 text-[10px] text-muted">{book.format}</span>
                <p className={`font-mono text-xs ${(book.available_copies ?? 0) > 0 ? 'text-ok' : 'text-danger'}`}>
                  {book.available_copies ?? 0}/{book.total_copies ?? 0}
                </p>
                <p className="font-mono text-xs text-warn">★ {(book.avg_rating ?? 0).toFixed(1)}</p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleEdit(book)}
                    className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-accent/10 hover:text-accent"
                    title="Edit Book"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => book.id && deleteBook(book.id, book.title ?? 'Book')}
                    className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-danger/10 hover:text-danger"
                    title="Delete Book"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="sticky top-20 h-fit rounded-card border border-border bg-surface px-6 py-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              {editingId ? <Edit2 size={16} className="text-accent" /> : <PlusCircle size={16} className="text-ok" />}
              {editingId ? 'Edit Book' : 'Add New Book'}
            </h2>
            {editingId && (
              <button 
                onClick={resetForm}
                className="text-[11px] uppercase tracking-wider text-muted hover:text-white underline"
              >
                Cancel Edit
              </button>
            )}
          </div>

          <div className="mb-3 flex gap-2">
            <input value={isbn} onChange={(event) => setIsbn(event.target.value)} placeholder="Enter ISBN" className="h-10 flex-1 rounded-lg border border-border bg-surface px-3 text-sm text-white outline-none focus:border-accent/50" />
            <button type="button" onClick={() => void autofill()} disabled={fetchingIsbn || !!editingId} className="inline-flex h-10 items-center gap-1 rounded-lg border border-accent/30 bg-accent/15 px-3 text-sm font-semibold text-accent disabled:opacity-50">
              {fetchingIsbn ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} {fetchingIsbn ? 'Fetching...' : 'Autofill'}
            </button>
          </div>

          <div className="grid gap-2">
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title*" className="h-10 rounded-lg border border-border bg-surface px-3 text-sm text-white outline-none focus:border-accent/50" />
            <input value={authorNames} onChange={(event) => setAuthorNames(event.target.value)} placeholder="Author(s), comma separated" className="h-10 rounded-lg border border-border bg-surface px-3 text-sm text-white outline-none focus:border-accent/50" />

            <div className="grid grid-cols-2 gap-2">
              <select value={genreId} onChange={(event) => setGenreId(event.target.value ? Number(event.target.value) : '')} className="h-10 rounded-lg border border-border bg-overlay px-3 text-sm text-white outline-none focus:border-accent/50">
                <option value="">Genre</option>
                {genres.map((genre) => (
                  <option key={genre.id} value={genre.id}>{genre.name}</option>
                ))}
              </select>
              <div className="relative">
                <input
                  list="publisher-list"
                  value={publisherName}
                  onChange={(event) => setPublisherName(event.target.value)}
                  placeholder="Publisher"
                  className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-white outline-none focus:border-accent/50"
                />
                <datalist id="publisher-list">
                  {publishers.map((pub) => (
                    <option key={pub.id} value={pub.name} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <select value={format} onChange={(event) => setFormat(event.target.value as typeof format)} className="h-10 rounded-lg border border-border bg-overlay px-3 text-sm text-white outline-none focus:border-accent/50">
                <option value="novel">Novel</option>
                <option value="manga">Manga</option>
                <option value="magazine">Magazine</option>
                <option value="textbook">Textbook</option>
                <option value="digital">Digital</option>
              </select>
              <input type="number" min={1800} max={2026} value={publishedYear} onChange={(event) => setPublishedYear(event.target.value)} placeholder="Published year" className="h-10 rounded-lg border border-border bg-surface px-3 text-sm text-white outline-none focus:border-accent/50" />
            </div>

            <input value={language} onChange={(event) => setLanguage(event.target.value)} placeholder="Language" className="h-10 rounded-lg border border-border bg-surface px-3 text-sm text-white outline-none focus:border-accent/50" />

            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} placeholder="Description" className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-white outline-none focus:border-accent/50" />
            
            <div className="space-y-2">
              <label className="text-[11px] uppercase tracking-wider text-muted">Book Cover</label>
              <div className="flex gap-3">
                <div className="relative h-24 w-16 overflow-hidden rounded border border-border bg-white/4">
                  {coverUrl ? (
                    <img src={coverUrl} alt="Preview" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center text-muted">
                      <ImageIcon size={20} />
                    </div>
                  )}
                  {uploading && (
                    <div className="absolute inset-0 grid place-items-center bg-black/60">
                      <Loader2 size={16} className="animate-spin text-accent" />
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-2">
                  <input
                    value={coverUrl}
                    onChange={(event) => setCoverUrl(event.target.value)}
                    placeholder="Cover URL (paste or upload)"
                    className="h-10 rounded-lg border border-border bg-surface px-3 text-sm text-white outline-none focus:border-accent/50"
                  />
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border bg-white/6 text-xs font-medium text-white transition-colors hover:bg-white/10"
                  >
                    <Upload size={14} />
                    {uploading ? 'Uploading...' : 'Upload Image'}
                  </button>
                </div>
              </div>
            </div>

            {!editingId && format !== 'digital' ? (
              <input type="number" min={1} max={50} value={copies} onChange={(event) => setCopies(Number(event.target.value) || 1)} placeholder="Physical copies" className="h-10 rounded-lg border border-border bg-surface px-3 text-sm text-white outline-none focus:border-accent/50" />
            ) : null}
          </div>

          <button type="button" onClick={() => void submit()} disabled={saving} className={`mt-3 h-12 w-full rounded-lg text-sm font-semibold text-white transition-colors ${editingId ? 'bg-accent hover:bg-accent/90' : 'bg-ok hover:bg-ok/90'}`}>
            {saving ? 'Processing...' : editingId ? 'Update Book' : 'Add Book to Library'}
          </button>

          {message ? <p className="mt-2 text-xs text-ok">{message}</p> : null}
          {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
        </section>
      </div>
    </main>
  )
}
