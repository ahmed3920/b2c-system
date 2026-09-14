# Verify and correct the Project Uploads numbers

I checked the live project records directly. Here is what they show and what needs fixing.

## What the data says

Projects created per day (organization 1 students):

| Day | Projects uploaded | Students who uploaded |
|---|---|---|
| 10 Sep | 83 | 74 |
| 11 Sep | 520 | 455 |
| 12 Sep | 782 | 699 |
| 13 Sep | 950 | 840 |
| 14 Sep (so far) | 9 | 9 |

Students with zero projects, rebuilt day by day from the upload dates (same rule as the tab: organization 1, has an upcoming session, has attended at least one session):

| As of | Zero-project students |
|---|---|
| 9 Sep | 1,615 |
| 10 Sep | 1,597 |
| 11 Sep | 1,595 |
| 12 Sep | 1,563 |
| 13 Sep | 1,527 |
| 14 Sep | 1,442 |

## Two things that don't match today's tab

1. **The 1,820 baseline for 9 Sep is too high.** Rebuilt from the actual upload dates, the number on 9 Sep was 1,615 for the students we track today. The 1,820 in your earlier sample likely used a slightly wider student group.
2. **Today shows 1,445, the real number is 1,442.** The tab uses the students' stored project counter; 3 students have a counter of 0 but do have project records (unpublished or archived). Counting real project records is the accurate way.

Note: far more projects are uploaded per day than the drop in zero-project students, because most uploads come from students who already had projects.

## What I'll change

- Count zero-project students from actual project records instead of the stored counter, so the tab matches reality (1,442 today).
- Replace the 1,820 baseline with the verified 1,615 for 9 Sep.
- Backfill the daily trend with the verified 9–13 Sep values so the chart shows the real history instead of two points.
- Add a "projects uploaded per day" line to the tab so you can see upload volume next to the zero-project decline.

## Technical notes

- Replace the `projects_count` condition in `PROJECTS_BASE` / breakdown / distribution queries in `supabase/functions/ischool-replica-query/queries.ts` with a `not exists` check against `public.projects` (and derive the distribution buckets from a per-student count of project rows).
- Add `analytics_projects_uploads_by_day` (org 1, grouped by `date(created_at)`, respecting the team leader / grade filters) for the new upload-volume chart.
- Update `PROJECTS_BASELINE` in `src/hooks/useProjectUploads.ts` to `{ date: "2026-09-09", zero: 1615 }` and fetch the new daily-uploads series.
- Backfill `project_upload_snapshots` rows for 2026-09-09 through 2026-09-13 with the verified values (and correct 2026-09-14 to 1,442) via a migration; keep the daily cron as is.
- Add the uploads-per-day chart to `src/components/analytics/ProjectUploadsTab.tsx`; redeploy `ischool-replica-query` and typecheck.
