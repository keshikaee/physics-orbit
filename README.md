# Physics Orbit

A space-themed Learning Management System for Pearson Edexcel International AS Physics tuition classes.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 16 (App Router) + TypeScript |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Backend | Next.js route handlers + server actions |
| Database | Supabase PostgreSQL (Phase 2) |
| Auth | Supabase Auth (Phase 2) |
| Storage | Supabase Storage (Phase 2) |
| Maths | KaTeX (Phase 3) |
| Experiments | React + p5.js (Phase 5) |

## Prerequisites

- Node.js 20 or later
- npm 10 or later

## Local development setup

```bash
# 1. Install dependencies (Node 22+)
npm install

# 2. Copy environment configuration
cp .env.example .env.local
# Edit .env.local and fill in your Supabase credentials (required from Phase 2 onwards)

# 3. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available routes

| URL | Description |
|---|---|
| `/` | Public landing page |
| `/login` | Student / teacher sign in |
| `/forgot-password` | Request a password reset email |
| `/reset-password` | Set a new password (from email link) |
| `/register` | Student self-registration |
| `/dashboard` | Student dashboard |
| `/courses` | Course overview (unit cards) |
| `/courses/[unit]` | Unit overview (topic list) |
| `/teacher/dashboard` | Teacher dashboard |
| `/teacher/content` | Content manager: units & topics |

## Implementation phases

| Phase | Status | Description |
|---|---|---|
| 1 — Foundation | ✅ Complete | Next.js scaffold, design system, shell layouts |
| 2a — Auth | ✅ Built (needs Supabase project to run) | Register, login, logout, password reset, roles, RLS |
| 2b — Course structure | ✅ Built | Course → Unit → Topic → Lesson schema, Unit 1 + placeholders, student course pages, teacher content manager |
| 2c+ — LMS core | Pending | Lesson management, resource uploads, progress tracking |
| 3 — Unit 1 Content | Pending | Edexcel IAL topics, TipTap editor, KaTeX |
| 4 — Assessments | Pending | Quizzes, homework, mock exams |
| 5 — Virtual Lab | Pending | Interactive experiments, graph plotting |
| 6 — Polish | Pending | Analytics, gamification, deploy |

## Security notes

- Teacher accounts are provisioned by the administrator — not through public registration.
- Student submissions and private records are protected by Supabase Row Level Security.
- The Supabase service role key must never be exposed in client-side code.
- Never commit `.env.local` to version control.

## Supabase setup (required for sign-in)

1. Create a free project at [supabase.com](https://supabase.com).
2. **Run the migrations** — either:
   - add `SUPABASE_DB_URL` (Supabase → *Connect* → connection string, with your database password)
     to `.env.local` and run `npm run db:push`, or
   - open *SQL Editor* in the Supabase dashboard and run each file in `supabase/migrations/` in
     filename order.

   `npm run db:status` shows which migrations are applied.
3. **Add your keys:** copy `.env.example` to `.env.local` and fill in the values from
   *Project Settings → API Keys*.
4. **Email links:** in *Authentication → URL Configuration*, set **Site URL** to your app URL
   (e.g. `http://localhost:3000`) and add `http://localhost:3000/auth/callback` to
   **Redirect URLs**.
5. Restart `npm run dev`.

> **Seeded course structure needs review.** The unit names and Unit 1 topics come from the
> project plan, not from the official specification. They are flagged "Needs spec review" in the
> content manager until you tick "Checked against the spec".

> Supabase's built-in email sender is rate-limited (a few emails per hour) and intended for testing.
> Configure custom SMTP under *Authentication → Emails* before inviting a class.

## Creating the first teacher account

Teacher/admin accounts cannot be created through public registration. Create one from your own
machine with the secret key in `.env.local`:

```bash
npm run create-admin -- --email you@example.com --name "Your Name"
# You will be asked for a password (min 12 characters) at a hidden prompt.

# Promote an account that already registered as a student:
npm run create-admin -- --email you@example.com --promote
```

## Auth & security model

| Layer | What it does |
|---|---|
| `src/proxy.ts` | Refreshes the session cookie; redirects signed-out users away from protected pages. Convenience only. |
| `src/lib/auth/dal.ts` | `requireStudent()` / `requireStaff()` — server-side role checks used by every protected page. |
| Postgres RLS | Students can read/update only their own profile; staff can read all profiles. |
| `guard_profile_update` trigger | Blocks anyone except the service role from changing `role`; only staff can suspend students. |
| Sign-up trigger | Every new account is created as `student`, regardless of what the client sends. |

## Testing

```bash
npm test          # unit tests (vitest)
npm run test:rls  # database security tests against the Supabase project in .env.local
                  # (creates and removes temporary users — use a development project)
npm run typecheck
npm run lint
```

## Project structure

```
src/
  app/
    (auth)/          ← login, register — centred auth layout
    (student)/       ← student-facing pages with sidebar
    (teacher)/       ← teacher-facing pages at /teacher/* with sidebar
    globals.css      ← Tailwind v4 design tokens (soft green & white theme)
    layout.tsx       ← root layout with fonts
    page.tsx         ← public landing page
  components/
    landing/         ← hero section, feature grid
    layout/          ← logo, sidebars, site header
    ui/              ← shadcn/ui components
  lib/utils.ts       ← cn() utility
  types/index.ts     ← shared TypeScript types
.env.example         ← environment variable template
```
