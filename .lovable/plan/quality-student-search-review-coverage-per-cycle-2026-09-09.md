# Quality: student search + review coverage per cycle

## 1. Search reviews by student

Add a "Student" filter to the shared Quality filter bar (Reviews, Session Details, Mentor Comments, Summary, Overview).

- Accepts a student ID number or part of a student name.
- Matches the student attached to the reviewed session.
- The Reviews and Session Details tables gain a Student column (name + ID), included in CSV exports.
- Works together with every existing filter (dates, team leader, tutor, status, cycle, organization, flag).

Note on the data: in the iSchool system a session is linked to one student (about 97% of reviewed sessions) or to a group. Group sessions have no single student, so they only appear when no student filter is applied.

## 2. New "Coverage" tab (tutors without a review)

A new tab next to the existing Quality tabs showing, for the selected review cycle, every tutor in the current scope and whether they were reviewed.

Columns: T-ID, tutor name, team leader, mentor, organization, tutor status, sessions held in the cycle, reviews in the cycle, coverage state.

Coverage state:
- Reviewed — has at least one review in the cycle.
- Missing review — had sessions in the cycle but no review (this is the alert case).
- No sessions — had no active session in the cycle, so no review is expected (shown separately, not counted as missing).

Tab features:
- KPI cards: total tutors, reviewed, missing review, no sessions, coverage %.
- Default view filtered to "Missing review", with a toggle to show all states.
- Uses the same filters as the rest of Quality: cycle (defaults to the newest cycle), tutor status, team leader, mentor, organization, tutor name/ID.
- CSV export of the list.
- Respects the existing scoping: team leaders see their own team, mentors see their tutors, admins see everything.
- An alert badge on the tab showing the missing count for the selected cycle.

## Technical notes

Backend (`supabase/functions/ischool-replica-query/queries.ts`, then redeploy `ischool-replica-query`):
- Extend the shared quality filter set with a `student` param ($14) matching `s.student_id::text` or the student name (`students.name` / `name_en`), joining `public.students st on st.id = s.student_id`; expose `student_id`, `student_name` in list/detail/session queries and in `quality_filter_options` exclusion logic.
- New named queries:
  - `quality_coverage_list` — from `public.tutors t` left joined to team lead/mentor admins and organizations, with lateral counts of sessions in the cycle window (`sessions.start_at` between cycle start and the next cycle start, excluding cancelled statuses) and of `quality_reviews` with `review_cycle = $cycle`; filters for tutor status, team lead, mentor, organization, tutor text, coverage state; paginated.
  - `quality_coverage_summary` — counts per coverage state for the KPI cards and tab badge.
  - `quality_cycles_list` — distinct `review_cycle` values so the tab can default to the newest cycle independent of review filters.

Frontend:
- `src/hooks/useQualityReviews.ts` — add `student` to `QualityFilters`, `emptyQualityFilters`, and `toBaseParams`.
- `src/components/tracking/quality/QualityFilterBar.tsx` — add the Student input field.
- `src/components/tracking/quality/QualityReviewsTab.tsx` and `QualitySessionDetailsTab.tsx` — Student column + export field.
- New `src/components/tracking/quality/QualityCoverageTab.tsx` plus a new hook `useQualityCoverage.ts`; register the tab in `QualitySection.tsx` (`sub=coverage`).
