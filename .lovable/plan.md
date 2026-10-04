# Admin Task Tracker: complete team leader list + Admins tab

## What changes
1. **Team Leaders Tasks tab** lists every user whose role is Team Leader or Super Team Leader (currently 4 + 3 = 7 people), taken from User Management roles. Today Super Team Leaders are left out, so only some leaders appear.
2. **Mentors Tasks tab** keeps only mentors and community moderators. Admins and quality team users are no longer mixed in.
3. **New "Admins Tasks" tab** (between Team Leaders and All System) shows tasks owned by other admins. You can filter it to one admin or view all; your own tasks stay under My Tasks.
4. The person dropdown, stats cards, filters, search and export follow whichever tab is selected, as they do now.

Tab order: My Tasks · Mentors Tasks · Team Leaders Tasks · Admins Tasks · All System

## Technical details
- `useAdminView.ts`: replace the single-role `roleMap` with a per-user role set. `teamLeaders` = has `team_leader` or `super_team_leader`. `mentors` = has `mentor`/`community_moderator` and none of the leader or admin roles. New `admins` = has `admin`, excluding the current user. Add `"admin"` to `AdminViewMode`, with an aggregated query (`in user_id`) or a single-admin query, plus an empty-roster guard. Export `admins`.
- `AdminViewSelector.tsx`: add an "Admins Tasks" tab config (Shield icon). The person picker uses `admins` for that mode, labelled "All Admins". Show the leader's role (TL / Super TL) next to each name in the Team Leaders picker.
- Update callers (Tasks, Kanban, Reports, Progress) that switch on `viewMode` labels so the new mode gets a heading such as "Admins".
- The team leaders analysis panel uses the same `teamLeaders` list, so it will include Super Team Leaders automatically.
