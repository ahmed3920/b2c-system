# Projects Audit under Quality

A new "Projects" area inside Quality, restricted to admins plus a named allow-list, with four tabs.

## Access

- New allow-list managed by admins (like the existing CS full-access list): admins always in, plus anyone added.
- Anyone else does not see the Projects tab at all, and the data gateway refuses their requests.

## Tab 1 — Projects Audit (list + detail)

- Table of uploaded projects: project title, student name and ID, grade, tutor name, team leader, module/lesson, upload date, published/archived, score, views/likes/comments, approval status.
- Filters: team leader, tutor, grade, date range, approval status, published, free-text search (student name/ID, project title).
- Pagination and CSV export.
- Clicking a row opens a detail view modelled on the screenshot: header with breadcrumb (Grade / Module / Lesson) and publish date, project title, description, a "Watch Code File" button linking to the project URL, and the project preview image/thumbnail on the right.
- Detail also shows student, tutor, engagement numbers and the approval panel.

## Tab 2 — Approval

- Approve or reject a project with a required reason on reject, kept in our own system and linked to the project row (the iSchool database stays read-only).
- Stores decision, reason, who decided, and when; visible in the audit list as a status column and filter.
- Queue view of pending projects with the same filters, plus quick approve/reject from the row.

## Tab 3 — Engagement

- Views, likes and comments per student, with totals and averages.
- Grouped views by grade and by team leader, with bar charts.
- Sortable table (most viewed / most liked / most commented), date range filter, CSV export.

## Tab 4 — Student dashboard

- Searchable student list with: projects uploaded, last upload date, sessions attended, next session, project status mix, and a stalled flag.
- Stalled = no project uploaded in 14 or more days while the student still has sessions.
- Opening a student shows their project timeline, their session history, and each project's approval status, with links into the audit detail view.

## Technical notes

- Read side: new named queries in `supabase/functions/ischool-replica-query/queries.ts` over `public.projects` joined to students, sessions, tutors and admins (team leader), reusing the existing param/pagination conventions. Engagement uses `views_count`, `likes_count`, `comments_count`; status uses `project_status`, `published`, `archived`.
- The gateway gains a projects-access check: admin role or membership in the new allow-list table; other roles are rejected for these query keys only.
- Write side: two new tables in our database — one allow-list table, one `project_audit_decisions` table keyed by the replica project id, storing status, reason, reviewer id/name and timestamps, with row-level rules limiting writes to admins and allow-listed users.
- Frontend: `src/components/quality/projects/` with the four tab components plus a detail dialog, a `useProjectAudit` hook, and a new "Projects" sub-tab in `QualitySection.tsx` rendered only when access is granted.
