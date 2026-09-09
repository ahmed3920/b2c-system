# Count real sessions (group sessions counted once)

## The problem

In the Review Coverage tab, the "Sessions" number counts one row per student. For a
tutor teaching groups, one real session with 20 students shows as 20 sessions.

Confirmed on the live data: tutor T-22355 in the 2026-07-26 cycle shows 1,501 rows,
which are in fact only 80 real group sessions (every one of those rows belongs to a
group session; none are one-to-one).

## The fix

Count a group session once, and keep one-to-one sessions counted per session:

actual sessions = (number of distinct group sessions) + (number of one-to-one sessions)

The Coverage table will then show, per tutor and cycle:

- Sessions — the real number of sessions held (group ones counted once)
- Students — kept as a secondary number so the reach is still visible
- Review count and coverage state (Reviewed / Missing review / No sessions) stay
  exactly as they are; only the counting changes, so a tutor with only group
  sessions is no longer inflated

The CSV export gets the same two columns.

## Technical notes

In `supabase/functions/ischool-replica-query/queries.ts`, inside `COVERAGE_CTE`,
replace the `count(*)` session subquery with:

```sql
count(distinct s.group_session_id) filter (where s.group_session_id is not null)
+ count(*) filter (where s.group_session_id is null)
```

over `public.sessions s` for the tutor, within the cycle window
(`start_at >= cycle` and `< cycle + 1 month`, `coalesce(status,0) <> 2`), and add a
second `count(*)` aggregate exposed as `student_sessions`.

Frontend: `src/hooks/useQualityCoverage.ts` adds `student_sessions` to `CoverageRow`;
`src/components/tracking/quality/QualityCoverageTab.tsx` shows Sessions (real) plus a
Students column, and includes both in the CSV export.

Then redeploy `ischool-replica-query` and re-check the Coverage tab numbers.
