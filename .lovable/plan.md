## CMS (Content Management System) — Build Plan

A second, fully isolated workspace inside the same app, with its own login, users, roles, tasks and attendance — sharing only UI components.

### 1. Architecture & isolation

- **Single Supabase auth** (one `auth.users` table) — but a `system` flag decides who can log into what. Each user belongs to exactly one system: `b2c` or `cms`. This is the only safe way to keep one Supabase project while preventing cross-login.
- A new table `user_systems(user_id, system)` controls login eligibility. Existing users are auto-tagged `b2c`.
- A login-time guard on `/auth/cms` rejects any user not tagged `cms`, and the existing `/auth/admin|tl|mentor` pages reject any user tagged `cms`.
- A new `useSystem()` hook resolves the current user's system and is checked inside every CMS route + every existing route.

### 2. Database (new tables, all RLS-enabled)

- `user_systems` — `user_id`, `system` ('b2c' | 'cms')
- `cms_app_role` enum — `cms_admin`, `cms_supervisor`, `cms_member`
- `cms_user_roles` — `user_id`, `role` (mirrors b2c `user_roles` but separate)
- `cms_profiles` — `user_id`, `full_name`, `email`, `active_status`
- `cms_tasks` — same shape as `tasks` (title, description, status, priority, dates, assignee_id, created_by)
- `cms_attendance` — same shape as `team_leader_attendance` (user_id, date, check_in_time, status, minutes_late, late_reason) with the same Africa/Cairo 9:30 / 10:15 rules
- Security-definer helpers: `is_cms_user(uid)`, `has_cms_role(uid, role)`, `cms_can_view_user(uid, target_uid)` — to avoid RLS recursion
- Triggers: protect `cms_profiles` self-update (same pattern as b2c), auto-mark absent job for CMS

### 3. Auth & routing

- New page `/cms/login` titled **Content Management System** (email + password, Google sign-in disabled).
- New protected layout `CmsLayout` (mirrors `AppLayout`) with its own sidebar.
- Routes:
  - `/cms` → dashboard
  - `/cms/tasks`
  - `/cms/attendance`
  - `/cms/users` (cms_admin only)
- `App.tsx` updated to register the routes.
- `AppLayout` (b2c) blocks any user whose `system='cms'` and redirects to `/cms/login`. `CmsLayout` does the inverse.
- Optional: if a user has both flags (admins only), show a system switcher in the header.

### 4. Reused logic, separate data

- `useTasks` → new `useCmsTasks` (same shape, queries `cms_tasks`)
- `useTodayAttendance` → new `useCmsAttendance` (Cairo time, same windows, queries `cms_attendance`)
- UI components (Button, Card, Table, Dialog, Kanban) are reused as-is.

### 5. CMS modules

- **Dashboard**: KPI cards (my open tasks, today's check-in status, team attendance % this month) + quick links.
- **Tasks**: list + Kanban; Admin/Supervisor can create/assign to any cms user; Members see their own tasks.
- **Attendance**: today's check-in card (reuses 9:30 / 10:15 logic), monthly history table, monthly insights for Admin/Supervisor (on-time %, late count, absences).
- **Users (Admin only)**: list `cms_profiles`, create user (email + password + role via edge function `cms-admin-create-user`), toggle active, change role, reset password.

### 6. Edge functions

- `cms-admin-create-user` — Admin-only; creates auth user, inserts `user_systems(system='cms')`, `cms_profiles`, `cms_user_roles`. Manual JWT verify, role check.
- `cms-mark-absent-daily` — scheduled equivalent of `mark_absent_team_leaders` for cms members.

### 7. Files

**New**
- Migration: `..._cms_system.sql` (tables, enums, RLS, helpers, triggers)
- `src/hooks/useSystem.ts`, `src/hooks/useCmsRole.ts`, `src/hooks/useCmsTasks.ts`, `src/hooks/useCmsAttendance.ts`, `src/hooks/useCmsUsers.ts`
- `src/components/cms/CmsLayout.tsx`, `src/components/cms/CmsSidebar.tsx`, `src/components/cms/CmsCheckinCard.tsx`, `src/components/cms/CmsTaskDialog.tsx`, `src/components/cms/CmsCreateUserDialog.tsx`
- `src/pages/cms/CmsLogin.tsx`, `CmsDashboard.tsx`, `CmsTasks.tsx`, `CmsAttendance.tsx`, `CmsUsers.tsx`
- `supabase/functions/cms-admin-create-user/index.ts`

**Edited**
- `src/App.tsx` — register `/cms/*` routes
- `src/components/layout/AppLayout.tsx` — block cms-only users from b2c
- `src/pages/Auth.tsx` — block cms users on b2c login

### 8. Security guarantees

- Every `cms_*` table has RLS using `is_cms_user(auth.uid())` + role checks; b2c users get zero rows.
- Every b2c table policy is unchanged → cms users get zero rows there (they have no `user_roles` entry, no matching `team_leader`, etc.).
- Login pages enforce system membership both client-side (UX) and server-side (RLS makes any cross-query empty).

### Notes / decisions baked in
- One Supabase auth project (cannot create a second from inside the platform). Isolation is enforced by `user_systems` + RLS, which is the standard multi-tenant pattern.
- Sharing UI components but **not** tables — `tasks` and `cms_tasks` are physically separate.
- Default new login does NOT auto-confirm email (consistent with project memory) and uses email+password only.
