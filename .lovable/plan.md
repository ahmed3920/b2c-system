# Project Evaluation, Sorting and Daily Review Assignments

Adds the Phase 1 evaluation form to the Projects area, lets you sort projects by upload date, and gives each assigned reviewer a random daily batch of projects with an admin-controlled daily number.

## 1. Phase 1 evaluation form

Replaces the current approve / reject panel in the project detail view with the model from your document:

- Three confirmations: project access and launch, submission evidence match (title, description, screenshot belong to the opened project), core function works.
- One status: Fully Working (5), Partially Working (3), Not Working (0), Invalid Submission (0), External Technical Blocker (Pending, needs recheck).
- A note is required for anything other than Fully Working; a screenshot/evidence link field is shown and required in those cases too.
- Saved with who evaluated it and when; the project list shows the status as a column and a filter.

Scores roll up in a new summary strip:

- Coverage = uploaded projects / eligible students x 100
- QC Functionality = points earned / maximum sample points x 100 (5 points per reviewed project; Pending items excluded from the maximum)
- Phase 1 Outcome = Coverage x 40% + QC Functionality x 60%

Shown overall and per tutor, for the selected month, with CSV export.

## 2. Sorting by upload date

The audit list gets a sort control: newest first (current default) or oldest first. The choice also applies to the CSV export.

## 3. Daily random assignments

- A new "My Reviews" tab shows only the projects assigned to the signed-in reviewer for today, plus anything still unfinished from earlier days.
- Anyone on the Projects access list is a reviewer. Admins see an "Assignments" admin panel with the daily number per reviewer (one number for everyone) and a list of who got what today, with progress.
- Each day a batch is drawn at random from unassigned, not-yet-evaluated projects. Unfinished items stay with the same reviewer, and the batch is topped up so each reviewer holds the daily number of open items.
- Group sessions: the draw prefers spreading picks across different groups where possible.
- Admins can manually reassign or release an item, and can run "Generate today's batch" on demand.

## Technical notes

- New tables: `project_evaluations` (replica project id, checklist booleans, status enum, points, note, evidence URL, reviewer id/name, timestamps) and `project_review_assignments` (project id, denormalised student/tutor/team-leader fields, assigned_to, assigned_on date, state open/done/released, timestamps). Settings stored in `app_settings` under a `project_review_daily_limit` key. RLS: reviewers read/write their own rows, admins and allow-listed users read all, admins manage assignments.
- Assignment engine: an edge function `assign-project-reviews` that reads candidate projects from the read-only replica (`project_audit_list` style query, excluding already-assigned and already-evaluated ids), shuffles with a group-spread preference, and inserts assignments up to the limit per reviewer. Run by a daily `pg_cron` job at 04:00 UTC and callable from the admin panel button.
- Coverage numbers come from the replica: eligible students per tutor for the selected month, joined to submitted project records; new named queries in `supabase/functions/ischool-replica-query/queries.ts`.
- `project_audit_list` gains a `sort` param (`created_desc` / `created_asc`); `useProjectAudit` and `ProjectFilterBar` expose it.
- Frontend: `ProjectEvaluationPanel.tsx` inside `ProjectDetailDialog`, `MyReviewsTab.tsx`, `ReviewAssignmentsAdmin.tsx`, and a `Phase1SummaryCard`, all under `src/components/quality/projects/`, wired into `ProjectsSection.tsx`.
