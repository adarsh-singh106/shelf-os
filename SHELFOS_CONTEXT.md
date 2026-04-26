# ShelfOS — Complete AI Agent Prompt
# Paste this ENTIRE file as context into Cursor / v0 / Lovable before any request.
# Then say: "Build [component name] following this spec exactly."

---

## 0. PROJECT IDENTITY

**App name**: ShelfOS
**What it is**: A college library management system for GECA Aurangabad.
**Vibe**: OS-level dark interface. Not a SaaS app. Not a marketing page.
Think Linear.app meets JioHotstar — dense, tool-like, cinematic.
**Users**: Students (browse + request books), Librarians/Admin (manage inventory, confirm borrows, audit log).

---

## 1. TECH STACK — NON-NEGOTIABLE

| Layer | Tool | Notes |
|---|---|---|
| Framework | React 18 + Vite + TypeScript | Already scaffolded |
| Styling | Tailwind CSS v3 | Custom tokens in tailwind.config.js |
| Data fetching | @tanstack/react-query v5 | All Supabase queries via hooks |
| Backend/DB | Supabase (PostgreSQL) | Auth + RLS + stored procedures |
| Routing | react-router-dom v6 | |
| Animation | CSS transitions only | No Framer Motion (keep bundle small) |
| Icons | lucide-react | |
| Fonts | Google Fonts CDN | Fraunces, DM Sans, IBM Plex Mono |
| Deployment | Vercel | |

Install command:
```bash
npm install @supabase/supabase-js @tanstack/react-query react-router-dom lucide-react
npm install -D tailwindcss postcss autoprefixer
```

---

## 2. DESIGN TOKENS — USE EXACTLY THESE

```js
// tailwind.config.js
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'void':     '#05070a',   // true black canvas — page background
        'base':     '#0b0e13',   // app shell bg
        'surface':  '#111620',   // card background
        'raised':   '#181e2c',   // elevated card / modal
        'overlay':  '#1f2738',   // dropdown / tooltip bg
        'border':   'rgba(255,255,255,0.08)',
        'accent':   '#4f8ef7',   // electric cobalt — primary CTA
        'ok':       '#3dd68c',   // available / success
        'warn':     '#f5a623',   // rating / warning / due soon
        'danger':   '#f05252',   // overdue / error / delete
        'waitlist': '#c084fc',   // waitlist / queue status
        'muted':    'rgba(255,255,255,0.45)', // secondary text
        'ghost':    'rgba(255,255,255,0.18)', // tertiary text
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],    // book titles, hero headings
        ui:      ['DM Sans', 'system-ui', 'sans-serif'], // all UI labels
        mono:    ['IBM Plex Mono', 'monospace'],      // ratings, IDs, audit log
      },
      borderRadius: {
        'card': '12px',
        'pill': '999px',
      },
    },
  },
}
```

```html
<!-- index.html — add to <head> -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,600;1,400;1,600&family=DM+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
```

---

## 3. DATABASE SCHEMA — READ THIS BEFORE WRITING ANY QUERY

### Tables (all in public schema, Supabase):
```
users          — id(UUID), email, username, role('member'|'admin'), avatar_url, preferences(JSONB)
authors        — id(SERIAL), name UNIQUE
genres         — id(SERIAL), name UNIQUE
books          — id(SERIAL), title, isbn, format('novel'|'manga'|'magazine'|'textbook'|'digital'),
                 language, published_date, description, cover_url,
                 avg_rating(DECIMAL), review_count(INTEGER), search_vector(TSVECTOR)
book_authors   — book_id, author_id  [M:N junction]
book_genres    — book_id, genre_id   [M:N junction]
book_copies    — copy_id(SERIAL), book_id, status('available'|'borrowed'|'lost'|'maintenance')
reviews        — id, book_id, user_id, rating(1-5), body, created_at. UNIQUE(book_id, user_id)
borrow_history — id, user_id, book_id, copy_id, status('requested'|'active'|'returned'|'overdue'),
                 borrowed_at, due_date, returned_at
waitlist       — id, user_id, book_id, joined_at. UNIQUE(user_id, book_id)
user_follows   — follower_id, followed_id [self-referential M:N]
audit_log      — id, table_name, action, row_id, changed_by, old_data(JSONB), new_data(JSONB), changed_at
```

### Views (query these from frontend, NOT raw tables):
```sql
book_details        -- books + authors[] + genres[] + available_copies + total_copies
overdue_borrows     -- admin: users with overdue books
user_reading_history -- user's borrow history with book info
pending_requests    -- admin: borrow requests awaiting confirmation
trending_books      -- materialized: top 20 by borrows this week
genre_stats         -- materialized: genre name + book count + avg rating
```

### Stored Procedures (call via supabase.rpc()):
```
request_borrow(p_user_id, p_book_id)  → 'REQUESTED:...' | 'WAITLISTED:...' | 'ERROR:...'
confirm_borrow(p_borrow_id)           → 'SUCCESS:...' | 'ERROR:...'   [admin only]
return_book(p_user_id, p_book_id)     → 'SUCCESS:...' | 'ERROR:...'   [admin only]
mark_overdue()                        → INTEGER (count updated)        [cron only]
```

### CRITICAL SCHEMA RULES — Never violate these:
1. `authors` is always an array — never a single string. Always render as chips.
2. `available_copies` comes from `book_details` view — NOT a column on `books`.
3. Digital books (`format = 'digital'`) skip all copy/borrow logic. Show "Read Now" button.
4. Student clicks "Request Borrow" → `request_borrow()` → status becomes `requested`.
   Librarian then clicks "Confirm" in admin panel → `confirm_borrow()` → status becomes `active`.
5. `avg_rating` and `review_count` are updated by DB trigger — never update them from app code.
6. Never write to `audit_log` from app code — only triggers do this.
7. Admin tab/routes render ONLY when `user.role === 'admin'`. Route guard must exist.

---

## 4. SUPABASE CLIENT SETUP

```ts
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

```ts
// src/lib/queryClient.ts
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,   // 2 min
      retry: 1,
    },
  },
})
```

---

## 5. FOLDER STRUCTURE — CREATE EXACTLY THIS

```
src/
├── lib/
│   ├── supabase.ts
│   └── queryClient.ts
├── hooks/
│   ├── useAuth.ts          — Supabase auth state + helpers
│   ├── useBooks.ts         — book_details view queries
│   ├── useBorrow.ts        — request_borrow / return_book RPCs
│   ├── useSearch.ts        — full-text search via search_vector
│   └── useAdmin.ts         — admin-only queries (pending, overdue, audit)
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx    — sidebar + main content wrapper
│   │   ├── Sidebar.tsx     — collapsible icon sidebar
│   │   └── TopBar.tsx      — search bar + user avatar
│   ├── books/
│   │   ├── BookCard.tsx    — 2:3 cover card with availability badge
│   │   ├── ShelfRow.tsx    — horizontal scroll row with title
│   │   └── BookModal.tsx   — cover-bleed detail modal
│   ├── auth/
│   │   ├── AuthModal.tsx   — sign in / sign up / OTP views
│   │   └── OnboardingModal.tsx — 3-step chip profile setup
│   ├── shared/
│   │   ├── Badge.tsx
│   │   ├── StarRating.tsx
│   │   ├── Skeleton.tsx
│   │   ├── Toast.tsx
│   │   └── CommandPalette.tsx  — ⌘K global search + actions
├── pages/
│   ├── Discover.tsx        — home: hero + shelf rows (Hotstar style)
│   ├── MyShelf.tsx         — active borrows + waitlist + history
│   ├── MySpace.tsx         — profile + preferences editor
│   └── admin/
│       ├── Dashboard.tsx   — stats overview
│       ├── Requests.tsx    — pending borrow requests
│       ├── Inventory.tsx   — add/edit books (ISBN autofill)
│       └── AuditLog.tsx    — realtime audit log table
├── App.tsx                 — routes + query client provider
└── main.tsx
```

---

## 6. ROUTING

```tsx
// App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'

// Public route: redirect to /discover if logged in
// Protected route: redirect to / if not logged in
// Admin route: redirect to /discover if not admin

<QueryClientProvider client={queryClient}>
  <BrowserRouter>
    <Routes>
      <Route path="/"         element={<LandingPage />} />
      <Route element={<AppShell />}>
        <Route path="/discover"   element={<ProtectedRoute><Discover /></ProtectedRoute>} />
        <Route path="/shelf"      element={<ProtectedRoute><MyShelf /></ProtectedRoute>} />
        <Route path="/space"      element={<ProtectedRoute><MySpace /></ProtectedRoute>} />
        <Route path="/admin"      element={<AdminRoute><Dashboard /></AdminRoute>} />
        <Route path="/admin/requests"  element={<AdminRoute><Requests /></AdminRoute>} />
        <Route path="/admin/inventory" element={<AdminRoute><Inventory /></AdminRoute>} />
        <Route path="/admin/audit"     element={<AdminRoute><AuditLog /></AdminRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/discover" />} />
    </Routes>
  </BrowserRouter>
</QueryClientProvider>
```

---

## 7. KEY HOOKS

```ts
// src/hooks/useAuth.ts
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user) return
    supabase.from('users').select('*').eq('id', user.id).single()
      .then(({ data }) => setProfile(data))
  }, [user])

  return { user, profile, loading, isAdmin: profile?.role === 'admin' }
}
```

```ts
// src/hooks/useBooks.ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export function useBooks(filters?: { format?: string; genreId?: number; limit?: number }) {
  return useQuery({
    queryKey: ['books', filters],
    queryFn: async () => {
      let q = supabase.from('book_details').select('*')
        .order('avg_rating', { ascending: false })
        .limit(filters?.limit ?? 20)
      if (filters?.format) q = q.eq('format', filters.format)
      const { data, error } = await q
      if (error) throw error
      return data ?? []
    }
  })
}

export function useTrending() {
  return useQuery({
    queryKey: ['trending'],
    queryFn: async () => {
      const { data } = await supabase.from('trending_books').select('*').limit(20)
      return data ?? []
    }
  })
}

export function useSearch(query: string) {
  return useQuery({
    queryKey: ['search', query],
    enabled: query.trim().length > 2,
    queryFn: async () => {
      const { data } = await supabase
        .from('book_details')
        .select('*')
        .textSearch('search_vector', query, { type: 'websearch' })
        .limit(30)
      return data ?? []
    }
  })
}
```

```ts
// src/hooks/useBorrow.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export function useRequestBorrow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, bookId }: { userId: string; bookId: number }) => {
      const { data, error } = await supabase.rpc('request_borrow', {
        p_user_id: userId,
        p_book_id: bookId,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['books'] })
      qc.invalidateQueries({ queryKey: ['myBorrows'] })
    }
  })
}
```

---

## 8. COMPONENT SPECS

### 8.1 Sidebar
- Default width: **52px** — icons only, no labels
- Hover: expand to **220px** — labels slide in, glassmorphism overlay
- `position: fixed; left: 0; top: 0; height: 100vh`
- Main content: always `padding-left: 52px` — sidebar slides OVER content, never reflows it
- `backdrop-filter: blur(20px)` on expanded state
- Nav items: Home (📚), My Shelf (🗂), My Space (👤)
- Admin section appears below divider ONLY if `isAdmin === true`
- Active item: left border `3px solid #4f8ef7` + text in accent color

### 8.2 BookCard
- Aspect ratio: **2:3** (portrait, like a real book cover)
- Cover image: `object-fit: cover`, fallback = colored square with first letter of title in Fraunces
- Top-right badge:
  - `available_copies > 0` → green dot + "N available"
  - `available_copies === 0` → purple "Waitlist"
  - `format === 'digital'` → blue "Digital"
- On hover:
  - Card lifts: `transform: translateY(-6px)`, `transition: 150ms`
  - Dark overlay fades in (0 → 0.7 opacity)
  - "Request" or "Read Now" button appears
  - Author names and rating visible
- Title: Fraunces font, italic for fiction
- Rating: IBM Plex Mono, amber color

### 8.3 ShelfRow (Hotstar-style)
- Section title: DM Sans 16px, white, left-aligned
- Cards in `display: flex; gap: 12px; overflow-x: auto`
- Hide scrollbar: `scrollbar-width: none`
- Cards: fixed width 160px, never shrink
- Rows on Discover page:
  1. "Trending This Week" — from `trending_books` materialized view
  2. "Picked For You" — filtered by user's `preferences.genres`
  3. "Indian Literature" — filter by genre IN ('Fiction') + Indian author names
  4. "Academic & Textbooks" — `format = 'textbook'`
  5. "New Additions" — order by `created_at DESC`

### 8.4 BookModal (Cover-Bleed)
- Full screen overlay, `backdrop-filter: blur(4px)`
- Background = book cover, `filter: blur(60px) saturate(0.6) brightness(0.3)`, scaled 110%, position absolute inset -40px
- Left panel: cover art with glow shadow `box-shadow: 0 40px 80px rgba(0,0,0,0.8)`
- Right panel:
  - Title: Fraunces 32px italic
  - Authors: small chips, accent bg
  - Genre chips: ghost border
  - Stats row: ⭐ avg_rating (amber, mono) · N reviews · N copies (colored dots)
  - Description: 4-line clamp, "Read more" toggle
  - Action button (see Rule 3 above)
- Close: Escape key + X button top-right

### 8.5 Action Button Logic
```
if format === 'digital'       → "Read Now" (ok/green)
else if available_copies > 0  → "Request Borrow" (accent/blue) → calls request_borrow()
else if user is on waitlist   → "On Waitlist — #N" (waitlist/purple, disabled)
else                          → "Join Waitlist" (waitlist/purple outline) → adds to waitlist
```
After request_borrow() returns 'REQUESTED:...' → show toast:
"Visit the library counter to collect your book. Due in 14 days after confirmation."

### 8.6 AuthModal
- 3 views: SignIn → SignUp → OTP
- Backdrop blur on open
- Scale 0.95 → 1.0 animation on mount
- Email + password fields
- "Or continue with Google" button (calls `supabase.auth.signInWithOAuth`)
- OTP view: 6 individual digit inputs, auto-advance on fill, auto-submit on last digit
- After successful auth → check if `users.preferences` is empty → show OnboardingModal

### 8.7 OnboardingModal (Profile Setup)
- 3 steps, progress dots at top
- "Skip for now" always visible
- All chip-based (no text input)
- Step 1: "Who are you?" — Student / Researcher / Casual Reader / Professional
- Step 2: "Pick your genres" — multi-select max 4 — Fiction / Sci-Fi / History / Biography / Self-Help / Mystery / Fantasy / Technology / Poetry / Religion
- Step 3: "How do you read?" — One at a time / Multiple books · Deep reads / Quick reads
- Save to: `supabase.from('users').update({ preferences: { reader_type, genres, reading_style } })`

### 8.8 CommandPalette (⌘K)
- Global keyboard listener: `Ctrl+K` or `Cmd+K`
- Full-screen overlay, centered input
- Searches books in real-time as user types (useSearch hook, debounced 300ms)
- Results show: cover thumbnail + title + authors + availability badge
- Click result → opens BookModal
- Keyboard nav: arrow keys + Enter
- Built-in commands: "Go to My Shelf", "Go to Admin", "Sign Out"

### 8.9 Admin — Requests Page
- Table of `pending_requests` view
- Columns: Student name, Book title, Requested at, Action
- "Confirm Handover" button → calls `confirm_borrow(borrow_id)` → row disappears
- Real-time: subscribe to `borrow_history` INSERT via Supabase Realtime

### 8.10 Admin — AuditLog Page
- Table querying `audit_log` ordered by `changed_at DESC`
- IBM Plex Mono throughout
- Action badge: INSERT=green, UPDATE=amber, DELETE=red, NOTIFY=purple
- Real-time: new rows slide in from top via CSS animation
- Filter bar: by action type + table name

### 8.11 Admin — Inventory (Add Book)
- ISBN input field with "Autofill" button
- On autofill: fetch `https://openlibrary.org/api/books?bibkeys=ISBN:{isbn}&format=json&jscmd=data`
- Populate: title, author, published date, cover_url, description automatically
- Format selector: novel / manga / magazine / textbook / digital
- Number of copies input (default: 3)
- Submit → INSERT into books + book_authors + book_genres + book_copies

---

## 9. BORROW FLOW — EXACT SEQUENCE FOR DEMO

```
1. Student opens ShelfOS → browses Discover page
2. Clicks a book → BookModal opens
3. Clicks "Request Borrow"
   → supabase.rpc('request_borrow', { p_user_id, p_book_id })
   → Toast: "Visit library counter to collect your book"
   → borrow_history row created with status='requested'

4. Librarian opens Admin → Requests page
   → Sees pending request from student
   → Physically takes the book from shelf
   → Clicks "Confirm Handover"
   → supabase.rpc('confirm_borrow', { p_borrow_id })
   → book_copies status → 'borrowed'
   → borrow_history status → 'active'
   → audit_log entry created automatically by trigger

5. Student checks My Shelf → sees active borrow with due date

6. Student returns book to library counter
   → Librarian clicks "Mark Returned" in admin
   → supabase.rpc('return_book', { p_user_id, p_book_id })
   → book_copies status → 'available'
   → If waitlist exists → trigger notifies next user automatically
```

---

## 10. REALTIME (ADMIN AUDIT LOG)

```ts
// In AuditLog.tsx
useEffect(() => {
  const channel = supabase
    .channel('audit-log-realtime')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'audit_log'
    }, (payload) => {
      // Prepend new row to top of list
      setLogs(prev => [payload.new, ...prev])
    })
    .subscribe()
  return () => supabase.removeChannel(channel)
}, [])
```

---

## 11. COVER IMAGE STRATEGY

```ts
// Always try Open Library first, fallback to letter avatar
function getCoverUrl(isbn?: string, title?: string, coverUrl?: string): string {
  if (coverUrl && coverUrl.startsWith('https://')) return coverUrl
  if (isbn) return `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`
  return '' // render letter avatar
}

// Letter avatar fallback (in JSX):
// <div className="w-full h-full bg-surface flex items-center justify-center">
//   <span className="font-display text-4xl italic text-accent">
//     {title?.[0]?.toUpperCase()}
//   </span>
// </div>
```

---

## 12. DEPLOYMENT CHECKLIST

```bash
# 1. Push to GitHub
git init && git add . && git commit -m "feat: ShelfOS initial"
git remote add origin https://github.com/[you]/shelf-os.git
git push -u origin main

# 2. Deploy to Vercel
npx vercel
# Add env vars: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY

# 3. After deploy — update Supabase Auth
# Supabase → Authentication → URL Configuration
# Add: https://shelf-os.vercel.app to Redirect URLs

# 4. Add Vercel cron for mark_overdue()
# vercel.json:
{
  "crons": [{ "path": "/api/cron/overdue", "schedule": "0 0 * * *" }]
}
```

---

## 13. WHAT MAKES THIS STAND OUT (mention in demo)

1. **⌘K Command Palette** — type "borrow dune" and it executes the stored procedure. No other college DBMS project in India has this.
2. **Cover-bleed modal** — book cover becomes the entire background. Pure CSS, zero libraries.
3. **Real-time audit log** — Supabase Realtime subscription. New DB events tick in live during demo.
4. **ISBN autofill** — type ISBN in admin, entire form fills from Open Library API.
5. **Requested → Active flow** — models real library counter handoff. Not a button that teleports books.
6. **Indian books + GECA users** — Sudha Murty, APJ Kalam, Chetan Bhagat. Feels like OUR library.
7. **4 triggers + 3 stored procedures** — all DBMS concepts from textbook, live in production.

---

## HOW TO USE THIS PROMPT WITH AI AGENTS

### With Cursor:
1. Create `SHELFOS_CONTEXT.md` in project root with this content
2. Open Cursor → Chat → attach the file
3. Say: "Using the ShelfOS context, build [component]"

### With v0.dev:
1. Paste sections 1-4 + the specific component spec from section 8
2. Say: "Build this as a React component with Tailwind CSS"

### With Lovable:
1. Start a new project
2. Paste this entire file as the first message
3. Say: "Set up the project structure first, then we'll build component by component"

### BUILD ORDER (one at a time):
1. AppShell + Sidebar
2. AuthModal + OnboardingModal  
3. BookCard + ShelfRow
4. Discover (Home) page
5. BookModal
6. CommandPalette
7. MyShelf page
8. Admin — Requests
9. Admin — AuditLog (with Realtime)
10. Admin — Inventory (with ISBN autofill)
11. Landing page
12. Deploy
