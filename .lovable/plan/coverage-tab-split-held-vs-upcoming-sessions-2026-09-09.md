# Coverage tab: split held vs upcoming sessions

## Background (confirmed on live data)

Sessions per tutor are counted from the iSchool replica's `public.sessions` table,
within the selected review cycle window: `start_at >= cycle date` and
`< cycle date + 1 month` (Aug 26 cycle = 26 Aug 00:00 → 26 Sep 00:00).
Cancelled sessions (`status = 2`) are excluded. Group sessions count once via
distinct `group_session_id`; one-to-one sessions count per row.

Example, tutor T-12898 (Hagar Emad Hamdy Qassim) in cycle Aug 26:
- 97 sessions counted, all one-to-one (no group sessions)
- Breakdown by status: 86 normal (status 0), 11 scheduled/upcoming (status 1),
  5 cancelled (excluded)
- 0 reviews this cycle → shown as "Missing review"

Problem: some of those counted sessions are bookings scheduled in the future
(up to 23 Sep) that haven't happened yet, so they inflate the number and can
mark a tutor "Missing review" before a review could even exist.

## The change

Split the Sessions number into two, per tutor and cycle:

- **Held** — sessions whose start time has already passed (group ones counted
  once, cancelled excluded). This drives the coverage state.
- **Upcoming** — sessions booked later in the cycle window that haven't
  happened yet (same counting rules).

Consequences:

- Coverage state is decided from Held only: a tutor with reviews → Reviewed;
  held sessions but no review → Missing review; no held sessions yet →
  No sessions (upcoming count still visible).
- Table columns become: Sessions held · Upcoming · Students · Reviews · State.
- KPI cards and the CSV export get the same split.
- Student-reach column stays based on all rows as today.

## Technical notes

Backend (`supabase/functions/ischool-replica-query/queries.ts`, redeploy
`ischool-replica-query`): in `COVERAGE_CTE`, split the `sessions` subquery into
`sessions_held` (same expression plus `and s.start_at < now()`) and
`sessions_upcoming` (same plus `and s.start_at >= now()`); keep
`student_sessions` as-is; classify from `sessions_held`; expose both in
`quality_coverage_list` and keep summary logic (now driven by held).

Frontend: `src/hooks/useQualityCoverage.ts` adds `sessions_held` and
`sessions_upcoming` to `CoverageRow` (keep `sessions` mapped to held for the
existing column); `src/components/tracking/quality/QualityCoverageTab.tsx`
shows Held and Upcoming columns and includes both in the CSV export.

Then verify against T-12898 (expect held 86-ish depending on current time,
upcoming 11, state recalculated) and a group tutor like T-22355.
