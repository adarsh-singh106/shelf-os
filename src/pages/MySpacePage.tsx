import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { deriveUsername } from '../lib/profile'
import type { TableUpdate } from '../types/db'

type EditForm = {
  username: string
  avatar_url: string
  reader_type: string
  genres: string[]
  reading_style: string
  reading_pace: string
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

function cleanPreferenceLabel(value: string) {
  return value.replace(/^[^\p{L}\p{N}]+/u, '').trim()
}

export default function MySpacePage() {
  const { profile, user, loading, refreshProfile } = useAuth()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<EditForm>({
    username: '',
    avatar_url: '',
    reader_type: '',
    genres: [],
    reading_style: '',
    reading_pace: '',
  })

  const startEditing = () => {
    if (profile) {
      setForm({
        username: profile.username ?? '',
        avatar_url: profile.avatar_url ?? '',
        reader_type: (profile.preferences as Record<string, unknown>)?.reader_type as string ?? '',
        genres: ((profile.preferences as Record<string, unknown>)?.genres as string[]) ?? [],
        reading_style: (profile.preferences as Record<string, unknown>)?.reading_style as string ?? '',
        reading_pace: (profile.preferences as Record<string, unknown>)?.reading_pace as string ?? '',
      })
    }
    setEditing(true)
  }

  const handleSave = async () => {
    if (!user) return
    setError(null)
    setSaving(true)

    const username = form.username.trim() || deriveUsername(user)
    const existingPreferences = (profile?.preferences as Record<string, unknown>) ?? {}
    
    const updatePayload = {
      username,
      avatar_url: form.avatar_url || null,
      preferences: {
        ...existingPreferences,
        reader_type: cleanPreferenceLabel(form.reader_type),
        genres: form.genres.map(cleanPreferenceLabel).filter(Boolean),
        reading_style: cleanPreferenceLabel(form.reading_style),
        reading_pace: cleanPreferenceLabel(form.reading_pace),
      },
    } satisfies TableUpdate<'users'>

    const { error: updateError } = await supabase
      .from('users')
      .update(updatePayload)
      .eq('id', user.id)
      .select('id')
      .single()

    setSaving(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    await refreshProfile(user.id)
    setEditing(false)
  }

  const toggleGenre = (genre: string) => {
    setForm((prev) => ({
      ...prev,
      genres: prev.genres.includes(genre)
        ? prev.genres.filter((g) => g !== genre)
        : prev.genres.length < 4
          ? [...prev.genres, genre]
          : prev.genres,
    }))
  }

  if (loading) {
    return (
      <section className="rounded-card border border-border bg-surface px-6 py-5">
        <p className="text-sm text-muted">Loading...</p>
      </section>
    )
  }

  const preferences = (profile?.preferences as Record<string, unknown>) ?? {}

  return (
    <section className="space-y-6">
      <div className="rounded-card border border-border bg-surface px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-accent">My Space</p>
            <h1 className="mt-1 font-display text-3xl italic text-white">Your Profile</h1>
          </div>
          {!editing && (
            <button
              type="button"
              onClick={startEditing}
              className="h-9 rounded-lg bg-accent px-4 text-sm font-semibold text-white transition hover:bg-accent/90"
            >
              Edit Profile
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="space-y-6 rounded-card border border-border bg-surface px-6 py-5">
          <h2 className="font-display text-xl italic text-white">Edit Profile</h2>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-muted">Username</label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
                className="h-10 w-full rounded-lg border border-border bg-raised px-3 text-sm text-white placeholder-muted focus:border-accent focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-muted">Avatar URL</label>
              <input
                type="text"
                value={form.avatar_url}
                onChange={(e) => setForm((prev) => ({ ...prev, avatar_url: e.target.value }))}
                placeholder="https://..."
                className="h-10 w-full rounded-lg border border-border bg-raised px-3 text-sm text-white placeholder-muted focus:border-accent focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-muted">Reader Type</label>
              <div className="flex flex-wrap gap-2">
                {readerTypes.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, reader_type: prev.reader_type === type ? '' : type }))}
                    className={`h-9 rounded-full border px-4 text-sm transition ${
                      form.reader_type === type
                        ? 'border-accent bg-accent/15 text-accent'
                        : 'border-border bg-surface text-white/80 hover:bg-overlay'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-muted">Favorite Genres (up to 4)</label>
              <div className="flex flex-wrap gap-2">
                {genres.map((genre) => {
                  const selected = form.genres.includes(genre)
                  const disabled = !selected && form.genres.length >= 4
                  return (
                    <button
                      key={genre}
                      type="button"
                      disabled={disabled}
                      onClick={() => toggleGenre(genre)}
                      className={`h-9 rounded-full border px-4 text-sm transition ${
                        selected
                          ? 'border-accent bg-accent/15 text-accent'
                          : disabled
                            ? 'cursor-not-allowed border-border bg-surface text-muted opacity-40'
                            : 'border-border bg-surface text-white/80 hover:bg-overlay'
                      }`}
                    >
                      {genre}
                    </button>
                  )
                })}
              </div>
              <p className="mt-1 text-xs text-muted">{form.genres.length}/4 selected</p>
            </div>

            <div>
              <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-muted">Reading Style</label>
              <div className="flex flex-wrap gap-2">
                {styles.map((style) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, reading_style: prev.reading_style === style ? '' : style }))}
                    className={`h-9 rounded-full border px-4 text-sm transition ${
                      form.reading_style === style
                        ? 'border-accent bg-accent/15 text-accent'
                        : 'border-border bg-surface text-white/80 hover:bg-overlay'
                    }`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-muted">Reading Pace</label>
              <div className="flex flex-wrap gap-2">
                {paces.map((pace) => (
                  <button
                    key={pace}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, reading_pace: prev.reading_pace === pace ? '' : pace }))}
                    className={`h-9 rounded-full border px-4 text-sm transition ${
                      form.reading_pace === pace
                        ? 'border-accent bg-accent/15 text-accent'
                        : 'border-border bg-surface text-white/80 hover:bg-overlay'
                    }`}
                  >
                    {pace}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-danger/20 bg-danger/10 px-3.5 py-2.5 text-sm text-danger" role="alert">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-accent px-6 text-sm font-semibold text-white transition hover:bg-accent/90 disabled:opacity-40"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="h-10 rounded-lg border border-border px-6 text-sm text-muted transition hover:bg-overlay"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-card border border-border bg-surface px-6 py-5">
            <h2 className="mb-4 font-display text-xl italic text-white">Profile Information</h2>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-[0.08em] text-muted">Username</dt>
                <dd className="mt-0.5 text-sm text-white">{profile?.username ?? 'Not set'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.08em] text-muted">Email</dt>
                <dd className="mt-0.5 text-sm text-white">{user?.email ?? 'Not set'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.08em] text-muted">Role</dt>
                <dd className="mt-0.5 text-sm text-white capitalize">{profile?.role ?? 'user'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.08em] text-muted">Member Since</dt>
                <dd className="mt-0.5 text-sm text-white">
                  {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'Unknown'}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-card border border-border bg-surface px-6 py-5">
            <h2 className="mb-4 font-display text-xl italic text-white">Reading Preferences</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-xs uppercase tracking-[0.08em] text-muted">Reader Type</dt>
                <dd className="mt-0.5 text-sm text-white">{String(preferences.reader_type ?? 'Not set')}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.08em] text-muted">Favorite Genres</dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {((preferences.genres as string[]) ?? []).length > 0 ? (
                    ((preferences.genres as string[]) ?? []).map((g) => (
                      <span key={g} className="rounded-full bg-accent/15 px-3 py-1 text-xs text-accent">
                        {g}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-muted">Not set</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.08em] text-muted">Reading Style</dt>
                <dd className="mt-0.5 text-sm text-white">{String(preferences.reading_style ?? 'Not set')}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.08em] text-muted">Reading Pace</dt>
                <dd className="mt-0.5 text-sm text-white">{String(preferences.reading_pace ?? 'Not set')}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </section>
  )
}
