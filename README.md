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

Apply the SQL migrations in `supabase/migrations/` in filename order. For an existing database, apply `202609140001_cardio.sql` to add Cardio and its four optional activities. Cardio durations are displayed and entered in minutes; the existing `seconds` column stores the duration.

Apply `202609280001_glute_bridge.sql` to replace Workout A's dumbbell Romanian deadlift with the dumbbell glute bridge: 3 sets of 10-15 reps, starting at bodyweight and progressing by 5 lb after all sets reach 15 reps. Existing RDL workout records are preserved. The replacement takes effect for newly started workouts.

Supabase Auth settings required for this app:

- Enable email magic links
- Disable open signups
- Invite only the one approved user email

## Cloudflare Pages setup

Use Cloudflare Pages GitHub integration, not Direct Upload.

Recommended Pages build settings:

- Framework preset: `Vite`
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: `/`

Required Cloudflare Pages environment variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Do not add a separate deploy command like `npx wrangler deploy` for a standard Pages Git-integrated project.
If Cloudflare auto-detects the app as a Vite static-assets Worker deploy, it already configures SPA fallback, so a `_redirects` file is redundant and can fail validation.

## Scripts

- `npm run dev`
- `npm run build`
- `npm run typecheck`
- `npm run test`
