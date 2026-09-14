# Project Uploads: show "not started yet" students separately

## Goal
Track students with zero projects who have an upcoming session but have never attended a session yet — as a separate group, without changing the existing 1445-style count.

## Changes

### 1. Replica gateway query (`supabase/functions/ischool-replica-query/queries.ts`)
- Extend `analytics_projects_summary` to also return:
  - `not_started_students` — org-1 students with `next_session_id` set, `total_attended_sessions_count = 0`, `projects_count = 0`
  - `not_started_zero_students` same as above (kept explicit for clarity)
- Add a new query `analytics_projects_not_started` returning the list of those students (s_id, name, grade, tutor, team leader, next session date if easily available) with the same team-leader/grade/search filters, limit/offset pagination.

### 2. Frontend hook (`src/hooks/useProjectUploads.ts`)
- Read the new summary fields and fetch the not-started list.

### 3. Project Uploads tab (`src/components/analytics/ProjectUploadsTab.tsx`)
- New KPI card: "Not started yet (0 sessions, 0 projects)" showing the count.
- A second table (or a toggle on the existing students table) listing the not-started students, with CSV export.

## Technical details
- Replica SQL verified: org 1, `next_session_id is not null`, `coalesce(total_attended_sessions_count,0) = 0`, `coalesce(projects_count,0) = 0` → 186 students currently.
- Existing count rule stays unchanged (attended ≥ 1 + upcoming session).
- Daily snapshot function unchanged for now (baseline tracking stays on the attended group).
- Redeploy `ischool-replica-query` after the query change.
