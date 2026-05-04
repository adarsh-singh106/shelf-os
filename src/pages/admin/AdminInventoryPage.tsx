import { Loader2, Sparkles, X, Edit2, PlusCircle, Upload, Image as ImageIcon, Search } from 'lucide-react'
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
        query = query.ilike('searchable_text', `%${term}%`)
      }

      const { data, error } = await query.limit(term ? 500 : 1000).returns<BookRow[]>()

      if (error) throw error
      return data ?? []
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
      const payload = (await response.json()) as Record<string, unknown>
      const key = `ISBN:${isbn.trim()}`
      const data = payload[key] as {
        title?: string
        authors?: { name: string }[]
        publishers?: { name: string }[]
        publish_date?: string
        notes?: unknown
        excerpts?: { text: string }[]
      } | undefined

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
    setFormat((book.format as typeof format) ?? 'novel')
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
    <main className="min-h-screen bg-void px-4 py-6 sm:px-8 sm:py-7 lg:px-10 lg:py-12">
      <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[3fr_2fr] xl:gap-12">
        <section className="order-2 lg:order-1">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="font-display text-3xl italic text-white lg:text-4xl">Book Inventory</h1>
              <p className="mt-1 text-sm text-muted">{books.length} books in library collection</p>
            </div>
          </div>

          <div className="relative mb-6 group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted transition-colors group-focus-within:text-accent" size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by title, ISBN, or author..."
              className="h-12 w-full rounded-2xl border border-white/5 bg-surface pl-11 pr-4 text-sm text-white outline-none ring-accent/20 transition-all focus:border-accent/40 focus:ring-4 shadow-inner"
            />
          </div>

          <div className="overflow-hidden rounded-[24px] border border-border bg-surface/50 backdrop-blur-md">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/4 text-[10px] font-bold uppercase tracking-widest text-muted border-b border-border">
                    <th className="px-6 py-4">Item</th>
                    <th className="px-6 py-4">Format</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Rating</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredBooks.slice(0, 50).map((book) => (
                    <tr key={book.id} className="hover:bg-white/2 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="relative h-12 w-9 shrink-0 overflow-hidden rounded border border-border bg-white/5">
                            <div
                              className="absolute inset-0 grid place-items-center font-display text-[11px] italic text-white"
                              style={{ background: FALLBACK_GRADIENTS[(book.title?.charCodeAt(0) || 0) % FALLBACK_GRADIENTS.length] }}
                            >
                              {book.title?.[0]?.toUpperCase() ?? 'B'}
                            </div>
                            {book.cover_url && (
                              <img
                                src={book.cover_url}
                                alt=""
                                className="relative z-10 h-full w-full object-cover"
                              />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-white group-hover:text-accent transition-colors">{book.title}</p>
                            <p className="truncate text-[11px] text-muted">{book.authors?.[0] ?? 'Unknown Author'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-bold uppercase text-muted">
                          {book.format}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-mono text-xs">
                          <p className={(book.available_copies ?? 0) > 0 ? 'text-ok' : 'text-danger'}>
                            {book.available_copies ?? 0}/{book.total_copies ?? 0}
                          </p>
                          {(book.waitlist_count ?? 0) > 0 && (
                            <p className="text-waitlist text-[10px] font-bold">{book.waitlist_count} waiting</p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                         <div className="flex items-center gap-1 font-mono text-xs text-warn">
                           <span>★</span>
                           <span>{(book.avg_rating ?? 0).toFixed(1)}</span>
                         </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleEdit(book)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-accent/10 hover:text-accent transition-colors"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => book.id && deleteBook(book.id, book.title ?? 'Book')}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-danger/10 hover:text-danger transition-colors"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-border/60">
              {filteredBooks.slice(0, 50).map((book) => (
                <div key={book.id} className="p-4 hover:bg-white/2 transition-colors">
                  <div className="flex gap-4">
                    <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-white/5">
                      <div
                        className="absolute inset-0 grid place-items-center font-display text-lg italic text-white"
                        style={{ background: FALLBACK_GRADIENTS[(book.title?.charCodeAt(0) || 0) % FALLBACK_GRADIENTS.length] }}
                      >
                        {book.title?.[0]?.toUpperCase() ?? 'B'}
                      </div>
                      {book.cover_url && (
                        <img src={book.cover_url} alt="" className="relative z-10 h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="line-clamp-2 text-sm font-bold text-white">{book.title}</p>
                          <p className="mt-0.5 truncate text-xs text-muted">{book.authors?.[0] ?? 'Unknown Author'}</p>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleEdit(book)}
                            className="h-8 w-8 flex items-center justify-center rounded-lg bg-white/5 text-muted"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => book.id && deleteBook(book.id, book.title ?? 'Book')}
                            className="h-8 w-8 flex items-center justify-center rounded-lg bg-danger/10 text-danger"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <span className="rounded-full bg-white/8 px-2 py-0.5 text-[9px] font-bold uppercase text-muted">
                          {book.format}
                        </span>
                        <div className="flex items-center gap-1.5 font-mono text-[11px]">
                          <span className={(book.available_copies ?? 0) > 0 ? 'text-ok' : 'text-danger'}>
                            {book.available_copies ?? 0}/{book.total_copies ?? 0}
                          </span>
                          {(book.waitlist_count ?? 0) > 0 && (
                            <span className="text-waitlist font-bold">• {book.waitlist_count} waiting</span>
                          )}
                        </div>
                        <span className="font-mono text-[11px] text-warn">★ {(book.avg_rating ?? 0).toFixed(1)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {filteredBooks.length === 0 && (
            <div className="py-20 text-center">
              <p className="text-muted">No books matching your search</p>
            </div>
          )}
        </section>

        <section className="order-1 lg:order-2">
          <div className="sticky top-[80px]">
            <div className="rounded-[28px] border border-border bg-surface px-6 py-7 shadow-2xl shadow-black/40">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    {editingId ? <Edit2 size={18} className="text-accent" /> : <PlusCircle size={18} className="text-ok" />}
                    {editingId ? 'Modify Entry' : 'Registry Entry'}
                  </h2>
                  <p className="text-xs text-muted mt-0.5">
                    {editingId ? `Editing ID: #${editingId}` : 'Add a new volume to the library'}
                  </p>
                </div>
                {editingId && (
                  <button 
                    onClick={resetForm}
                    className="h-8 rounded-lg bg-white/5 px-3 text-[10px] font-bold uppercase tracking-wider text-muted hover:bg-white/10 hover:text-white transition-all"
                  >
                    Cancel
                  </button>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input 
                      value={isbn} 
                      onChange={(event) => setIsbn(event.target.value)} 
                      placeholder="Standard ISBN" 
                      className="h-11 w-full rounded-xl border border-border bg-base px-4 text-sm text-white outline-none ring-accent/20 transition-all focus:border-accent/40 focus:ring-4" 
                    />
                  </div>
                  <button 
                    type="button" 
                    onClick={() => void autofill()} 
                    disabled={fetchingIsbn || !!editingId} 
                    className="flex h-11 items-center justify-center gap-2 rounded-xl border border-accent/20 bg-accent/5 px-4 text-xs font-bold text-accent transition-all hover:bg-accent/10 disabled:opacity-50"
                  >
                    {fetchingIsbn ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    <span className="hidden sm:inline">Autofill</span>
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted px-1">Vital Details</label>
                    <input 
                      value={title} 
                      onChange={(event) => setTitle(event.target.value)} 
                      placeholder="Book Title*" 
                      className="h-11 w-full rounded-xl border border-border bg-base px-4 text-sm text-white outline-none focus:border-accent/40" 
                    />
                    <input 
                      value={authorNames} 
                      onChange={(event) => setAuthorNames(event.target.value)} 
                      placeholder="Primary Author(s)" 
                      className="h-11 w-full rounded-xl border border-border bg-base px-4 text-sm text-white outline-none focus:border-accent/40" 
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted px-1">Taxonomy</label>
                      <select 
                        value={genreId} 
                        onChange={(event) => setGenreId(event.target.value ? Number(event.target.value) : '')} 
                        className="h-11 w-full rounded-xl border border-border bg-base px-3 text-sm text-white outline-none focus:border-accent/40 appearance-none cursor-pointer"
                      >
                        <option value="">Select Genre</option>
                        {genres.map((genre) => (
                          <option key={genre.id} value={genre.id}>{genre.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted px-1">Origin</label>
                      <input
                        list="publisher-list"
                        value={publisherName}
                        onChange={(event) => setPublisherName(event.target.value)}
                        placeholder="Publisher"
                        className="h-11 w-full rounded-xl border border-border bg-base px-4 text-sm text-white outline-none focus:border-accent/40"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted px-1">Medium</label>
                      <select 
                        value={format} 
                        onChange={(event) => setFormat(event.target.value as typeof format)} 
                        className="h-11 w-full rounded-xl border border-border bg-base px-3 text-sm text-white outline-none focus:border-accent/40 appearance-none cursor-pointer"
                      >
                        <option value="novel">Novel</option>
                        <option value="manga">Manga</option>
                        <option value="magazine">Magazine</option>
                        <option value="textbook">Textbook</option>
                        <option value="digital">Digital</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted px-1">Year</label>
                      <input 
                        type="number" 
                        min={1800} 
                        max={2026} 
                        value={publishedYear} 
                        onChange={(event) => setPublishedYear(event.target.value)} 
                        placeholder="YYYY" 
                        className="h-11 w-full rounded-xl border border-border bg-base px-4 text-sm text-white outline-none focus:border-accent/40" 
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted px-1">Narrative Context</label>
                    <textarea 
                      value={description} 
                      onChange={(event) => setDescription(event.target.value)} 
                      rows={4} 
                      placeholder="Book summary and details..." 
                      className="w-full rounded-xl border border-border bg-base px-4 py-3 text-sm text-white outline-none focus:border-accent/40 resize-none" 
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted px-1">Visual Identity</label>
                    <div className="flex gap-4">
                      <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-xl border border-border bg-base shadow-inner">
                        {coverUrl ? (
                          <img src={coverUrl} alt="Preview" className="h-full w-full object-cover" />
                        ) : (
                          <div className="grid h-full place-items-center text-muted/30">
                            <ImageIcon size={24} />
                          </div>
                        )}
                        {uploading && (
                          <div className="absolute inset-0 grid place-items-center bg-black/60 backdrop-blur-sm">
                            <Loader2 size={18} className="animate-spin text-accent" />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-1 flex-col gap-2">
                        <input
                          value={coverUrl}
                          onChange={(event) => setCoverUrl(event.target.value)}
                          placeholder="Image URL"
                          className="h-11 rounded-xl border border-border bg-base px-4 text-sm text-white outline-none focus:border-accent/40"
                        />
                        <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                          className="flex h-11 items-center justify-center gap-2 rounded-xl border border-white/5 bg-white/5 text-xs font-bold text-white transition-all hover:bg-white/10"
                        >
                          <Upload size={14} />
                          {uploading ? 'Processing...' : 'Upload Cover'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {!editingId && format !== 'digital' && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted px-1">Initial Stock</label>
                      <input 
                        type="number" 
                        min={1} 
                        max={50} 
                        value={copies} 
                        onChange={(event) => setCopies(Number(event.target.value) || 1)} 
                        placeholder="Number of physical copies" 
                        className="h-11 w-full rounded-xl border border-border bg-base px-4 text-sm text-white outline-none focus:border-accent/40" 
                      />
                    </div>
                  )}
                </div>
              </div>

              <button 
                type="button" 
                onClick={() => void submit()} 
                disabled={saving} 
                className={`mt-8 h-12 w-full rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all active:scale-[0.98] shadow-lg ${
                  editingId ? 'bg-accent shadow-accent/20' : 'bg-ok shadow-ok/20'
                }`}
              >
                {saving ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    <span>Synchronizing...</span>
                  </div>
                ) : (
                  editingId ? 'Apply Modifications' : 'Commit to Registry'
                )}
              </button>

              {message && (
                <div className="mt-4 rounded-xl border border-ok/20 bg-ok/5 px-4 py-3 text-[11px] font-bold text-ok animate-in fade-in slide-in-from-top-2">
                  {message}
                </div>
              )}
              {error && (
                <div className="mt-4 rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-[11px] font-bold text-danger animate-in fade-in slide-in-from-top-2">
                  {error}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      <datalist id="publisher-list">
        {publishers.map((pub) => (
          <option key={pub.id} value={pub.name} />
        ))}
      </datalist>
    </main>
  )
}
