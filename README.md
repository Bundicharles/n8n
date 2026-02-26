# The Brief — n8n × Supabase Blog

A production-ready static blog with dark glassmorphism design. Posts are published automatically via **n8n** workflows, stored in **Supabase**, and served from a **Vercel**-hosted static frontend.

---

## Folder Structure

```
blog/
├── index.html        # Homepage — post grid
├── post.html         # Single post page
├── styles.css        # Full design system (dark, glassmorphism)
├── main.js           # Homepage logic (fetch + render cards)
├── post.js           # Single post logic (fetch + SEO inject)
├── supabase.js       # Supabase client + data utilities
├── vercel.json       # Vercel headers + rewrites
├── .env.example      # Environment variable template
└── admin/            # Placeholder for future admin panel
    └── .gitkeep
```

---

## 1 — Supabase Setup

### Create the `posts` table

Run this SQL in the **Supabase SQL Editor**:

```sql
create table public.posts (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  slug           text not null unique,
  excerpt        text,
  content        text,           -- stored as HTML
  featured_image text,           -- public URL from Supabase Storage
  seo_title      text,
  seo_description text,
  created_at     timestamptz not null default now(),
  published      boolean not null default false
);

-- Index for fast slug lookups
create index on public.posts (slug);

-- Index for homepage query (published + newest-first)
create index on public.posts (published, created_at desc);

-- Enable Row Level Security
alter table public.posts enable row level security;

-- Allow anonymous read of published posts only
create policy "Public read published posts"
  on public.posts for select
  using (published = true);
```

### Storage bucket (for featured images)

1. Go to **Storage → New bucket**, name it `post-images`, set it to **Public**.
2. Your n8n workflow can upload images to this bucket and store the resulting public URL in `featured_image`.

---

## 2 — Environment Variables

### Local development

```bash
cp .env.example .env
# Fill in SUPABASE_URL and SUPABASE_ANON_KEY
```

Because this is a pure static site (no build step), inject the variables by editing `supabase.js` directly during local dev, **or** add a tiny build step that replaces the `window.__ENV__` pattern.

### Vercel deployment

1. Push the repo to GitHub.
2. Import in Vercel. Set these environment variables in the Vercel dashboard:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
3. Add a `_headers` or use `vercel.json` (already included) for security headers.

> **Note**: Because this is a static site, Vercel env vars are not automatically injected into JS at runtime. Use one of these approaches:
>
> **Option A (simplest):** Replace the placeholder strings in `supabase.js` directly before deploying. Keep them out of git using `.gitignore`.
>
> **Option B (build step):** Add a minimal `package.json` + `vite` or `esbuild` build that replaces `process.env.SUPABASE_URL` etc. at build time. Vercel will then inject them correctly.
>
> **Option C (edge config):** Serve a `/config.js` endpoint from a Vercel Edge Function that returns `window.__ENV__ = {...}` — the `supabase.js` already reads from `window.__ENV__`.

---

## 3 — n8n Workflow Integration

Your n8n workflow should `INSERT` a row into the `posts` table using the **Supabase node** or an **HTTP Request node**.

### Minimum payload

```json
{
  "title":          "My Post Title",
  "slug":           "my-post-title",
  "excerpt":        "A short summary for the card.",
  "content":        "<p>Full post body as <strong>HTML</strong>.</p>",
  "featured_image": "https://YOUR_PROJECT.supabase.co/storage/v1/object/public/post-images/my-image.jpg",
  "seo_title":      "My Post Title | The Brief",
  "seo_description":"A short summary used for Google and social sharing.",
  "published":      true
}
```

### Slug generation tip (n8n Expression)

```
{{ $json.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') }}
```

### Supabase REST insert (HTTP Request node)

- **Method**: `POST`
- **URL**: `https://YOUR_PROJECT.supabase.co/rest/v1/posts`
- **Headers**:
  - `apikey: YOUR_ANON_KEY`
  - `Authorization: Bearer YOUR_SERVICE_ROLE_KEY`  ← use service role for writes
  - `Content-Type: application/json`
  - `Prefer: return=minimal`

---

## 4 — Running Locally

Since the site uses native ES modules with `import` from a CDN (`esm.sh`), it must be served over HTTP (not opened as a file):

```bash
# Using Node
npx serve .

# Using Python
python3 -m http.server 3000

# Using VS Code — install "Live Server" extension
```

Then open `http://localhost:3000`.

---

## 5 — Admin Panel (Future)

The `admin/` folder is a placeholder. Authentication scaffold:

```javascript
// admin/auth.js — future implementation
import { supabase } from '../supabase.js';

async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

async function signOut() {
  await supabase.auth.signOut();
  window.location.href = '/';
}

async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}
```

---

## Security Notes

- The **anon key** is safe to expose in frontend code. It only allows operations permitted by RLS policies.
- **Never** expose the `service_role` key in frontend code — use it only in n8n or server-side environments.
- Post HTML is sanitised in `post.js` (script/iframe removal + event handler stripping). For maximum security, add [DOMPurify](https://github.com/cure53/DOMPurify).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JS (ES Modules) |
| Database | Supabase (PostgreSQL) |
| Storage | Supabase Storage |
| Hosting | Vercel (static) |
| Automation | n8n workflows |
| Fonts | Cormorant Garamond + DM Sans |
