# Project Upload Tracking (new Analytics tab)

A third tab in Analytics — **Project Uploads** — tracking how many students have uploaded zero projects, starting from the 1820 baseline recorded on 9 Sep 2026, then following the daily change.

## Who is counted

- Students in organization 1 only.
- A student counts as "zero projects" when their uploaded project count is 0.
- Students who have not attended any session yet are excluded — they cannot have uploaded a project.
- Baseline: 1820 zero-project students as of 2026-09-09, stored as the first point of the trend.

## What the tab shows

- KPI cards: current zero-project students, change vs the 1820 baseline, change vs yesterday, total students covered.
- Daily trend line: zero-project count per day since the baseline date.
- Zero-project students by grade (bar chart, includes group grades).
- Zero-project students by team leader (share chart + counts).
- Students by project count, 0 to 12+ (bar chart).
- A searchable table of zero-project students (student ID, name, grade, tutor, team leader, next lesson) with filters for team leader, grade and tutor status, plus CSV export.

## Daily tracking

A small daily snapshot keeps history, since the live system only shows the current state:

- One row per day storing the overall zero-project count plus the per-grade and per-team-leader breakdown.
- The 2026-09-09 baseline row (1820) is seeded so the trend starts there.
- A scheduled daily job writes the day's snapshot once; re-runs on the same day overwrite instead of duplicating. The trend chart reads these snapshots; all other charts read live.

## Technical notes

- Verify against the replica before writing SQL: the projects count column on `students`, how "has attended a session" is expressed (completed/past sessions vs `next_session_id`), and grade/team-leader joins as used in the provided sample query.
- New named queries in `supabase/functions/ischool-replica-query/queries.ts`: `analytics_projects_summary`, `analytics_projects_by_grade`, `analytics_projects_by_team_leader`, `analytics_projects_distribution`, `analytics_projects_students` (paged). No raw SQL from the browser.
- New Cloud table `project_upload_snapshots` (date unique, totals, jsonb breakdowns) with RLS + grants; admin read, service role write.
- New edge function `snapshot-project-uploads` pulling from the replica and upserting today's row, scheduled daily via cron; seeded with the 2026-09-09 = 1820 baseline.
- New hook `src/hooks/useProjectUploads.ts` and component `src/components/analytics/ProjectUploadsTab.tsx`, added as a third tab in `src/pages/Analytics.tsx`, reusing `SearchableSelect`, card/table patterns and native recharts.
- Gateway redeploy plus typecheck after implementation.
