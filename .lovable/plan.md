# Analytics section (Team Composition + 1:1 Occupation)

A new admin-only **Analytics** area in the left menu, reading live from the iSchool replica.

## Tab 1 — Team Composition

For each team leader, show how their team is made up:

- Total people, Tutors vs Mentors (from the tutor record's mentor flag: 0 = Tutor, 1 = Mentor)
- Full-time vs Part-time (employment type: 0 = Full-time, 1 = Part-time)
- Only people in organization id = 1 are counted
- Optional filter on tutor status (Working / Training / Resigned / ...) reusing the existing status list
- A table (one row per team leader, with totals row) plus a stacked bar chart, and CSV export

## Tab 2 — One to One Occupation Sessions

Sub-tabs: **All**, **Tutors**, **Mentors** (same table, filtered by the mentor flag).

- Date range filter (defaults to the current month)
- Occupation is based on **active delivered sessions** (session status = 0, one-to-one only, start time inside the range and already passed)
- Target = 5 sessions x working days in the range, where working days exclude each person's own weekend days from their record
- Each row: person, T-ID, team leader, employment type, sessions delivered, working days, target, occupation % with a progress bar
- Filters: team leader, tutor status, search by name/T-ID; sortable by occupation; CSV export
- KPI cards: average occupation, people at/over target, people under target

## Before building

The exact column names for the mentor flag, employment type and weekend days need to be confirmed against the replica schema (via the existing read-only column listing) before the queries are written. If any is named differently or stored in another table, the queries adapt to the real schema and the definitions above stay the same.

## Technical notes

- New named queries in `supabase/functions/ischool-replica-query/queries.ts`:
  `analytics_team_composition`, `analytics_occupation_list`, `analytics_occupation_summary`,
  plus a small `analytics_filter_options` for team-leader lists. No raw SQL from the browser.
- Working days per person computed in SQL with `generate_series` over the range minus that person's weekend days; group sessions are irrelevant here since only one-to-one sessions are counted.
- New hook `src/hooks/useAnalytics.ts` on top of the existing `useReplicaQuery`.
- New page `src/pages/Analytics.tsx` with `TeamCompositionTab.tsx` and `OccupationTab.tsx` under `src/components/analytics/`, route `/analytics`, sidebar entry restricted to `admin`, reusing the existing `SearchableSelect`, cards, table and recharts patterns.
- Gateway redeploy plus typecheck after implementation.
