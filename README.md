# Workout Tracker

Single-user workout tracker built with React, Supabase, and Cloudflare Pages.

## Stack

- Vite + React + TypeScript
- Tailwind CSS
- TanStack Query
- React Hook Form
- Supabase Auth + Postgres + RLS
- GitHub Actions for CI
- Cloudflare Pages for hosting

## Local development

1. Copy `.env.example` to `.env`.
2. Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Install dependencies:

```bash
npm install
```

4. Run the app:

```bash
npm run dev
```

## Supabase setup

Apply the SQL migration in `supabase/migrations/202604050001_init.sql`.

Supabase Auth settings required for this app:

- Enable email magic links
- Disable open signups
- Invite only the one approved user email

## Cloudflare Pages setup

Use Cloudflare Pages GitHub integration, not Direct Upload.

Recommended Pages build settings:

- Framework preset: `Vite`
- Build command: `npm install && npm run build`
- Build output directory: `dist`
- Root directory: `/`

Required Cloudflare Pages environment variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

SPA fallback is handled by `public/_redirects`.

## Scripts

- `npm run dev`
- `npm run build`
- `npm run typecheck`
- `npm run test`
