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

Use Node.js 22.12 or newer (see `.nvmrc`). Tailwind CSS 4 requires Safari 16.4+, Chrome 111+, or Firefox 128+. Theme tokens live in `src/index.css`, and Tailwind is compiled by the Vite plugin.

1. Copy `.env.example` to `.env`.
2. Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Install dependencies:

```bash
npm ci
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

### Outside activities

Apply `202610230001_outside_activities.sql` to enable outside activity logging. It creates a separate `outside_activities` table with per-user row-level security. On Today, choose **Log outside activity** to open a separate page for walking, biking, or a custom activity with its local calendar date and distance in miles (up to two decimal places). You choose which walks are worth logging. In History, **Edit** opens the activity form inline, with removal available while editing.

Outside activity cards and calendar days use white text on blue; days with both a gym workout and an outside activity keep the yellow gym background and add a blue O badge. Outside activities never contribute to gym visit goals, monthly gym averages, exercise recommendations, or the next workout rotation.

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

### Gym visit goals

On Today, save the initial **2.5 visits/week** goal (or choose 0.5–7 in half-visit increments). Tracking begins on that local calendar day, using fixed 14-day periods; 2.5 visits/week means five visits per period. Later edits take effect at the next period boundary, preserving historical targets. Goal settings and their effective dates are stored in the signed-in user's Supabase Auth metadata (`gym_goal`), so no additional database migration is needed.

Completed workouts count as one visit per calendar day, including cardio. The timezone captured when tracking starts stays fixed across devices. Today displays current progress; Workout Saved shows the period's updated count; History shows average weekly visits beneath the selected calendar month, counting distinct workout days and dividing by the month’s length in weeks (through today for the current month). Completing or deleting workouts refreshes progress through the existing history query invalidation. Missed visits do not carry over into later periods.
