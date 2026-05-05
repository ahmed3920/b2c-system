# CMS Check-out + Activity Tracking

Extend the CMS with check-out, real-time activity tracking, and an admin monitoring page.

## 1. Database changes

**Extend `cms_attendance`:**
- `check_out_time timestamptz`
- `working_minutes integer` (computed on check-out: `(check_out_time - check_in_time)/60`, stored)
- `active_minutes integer` (rolled up from activity logs at check-out, optional integration)
- `activity_status text` ('active' | 'idle' | 'inactive', last known)

**New table `cms_user_activity_logs`:**
- `id uuid pk`
- `user_id uuid`
- `date date` (Cairo)
- `bucket_start timestamptz` — minute-bucket
- `status text` ('active' | 'idle' | 'inactive')
- `seconds integer` (how many seconds in this state, capped per heartbeat)
- index on (user_id, date)

RLS:
- Users insert/select their own rows
- `cms_admin` selects all (`cms_supervisor` selects all read-only too, gated by permission `view_all_activity`)

## 2. Permission matrix additions
Add capabilities in `cmsPermissions.ts`:
- `check_out` (all roles, requires prior check-in — enforced in UI/DB)
- `view_all_activity` (Admin, TL)
- `view_own_activity` (all)

## 3. Check-out flow
- Extend `useCmsAttendance` with `checkOut()`:
  - Guard: must have `check_in_time` and no `check_out_time`
  - Update row → set `check_out_time = now()`, `working_minutes = diff`
- Update `CmsCheckinCard` → after check-in show:
  - Check-in time
  - "Check Out" button
  - After check-out: check-out time + total working hours (HH:MM)
- Dashboard already renders this card; no layout change needed.

## 4. Activity tracking (client)
New hook `useCmsActivityTracker` mounted inside `CmsLayout` (only when authenticated CMS user):
- Listen to `mousemove`, `mousedown`, `keydown`, `scroll`, `touchstart`, `visibilitychange`
- Maintain `lastActivityAt`
- Compute current status every 30s:
  - `< 5 min` since activity → `active`
  - `5–15 min` → `idle`
  - `> 15 min` or tab hidden long → `inactive`
- Heartbeat every 60s: insert/upsert a `cms_user_activity_logs` row with `seconds=60` for the current bucket+status
- On `beforeunload` / tab hidden: flush pending seconds
- Privacy notice: small one-time toast / footer line in `CmsLayout`: "Your activity is tracked while using the CMS"

## 5. Today's Attendance card
Augment `CmsCheckinCard` (or new `CmsTodayAttendanceCard`) showing:
- Check-in time, Check-out time
- Current activity status badge (color: green/yellow/red)
- Working hours so far (live tick) and active time today

## 6. Admin Activity Monitoring page
New page `src/pages/cms/CmsActivityMonitoring.tsx` at `/cms/activity` (gated by `view_all_activity`):
- Table of CMS users with today's data:
  - Name | Current Status (colored dot) | Active | Idle | Inactive | Check-in | Check-out | Working hours
- Auto-refresh every 30s
- Filter by status
- Sidebar entry in `CmsSidebar` (only shown when capability granted)

## 7. Edge cases
- Closing browser → no heartbeat → admin view computes "inactive" if last log > 15 min ago
- Multiple tabs → each tab heartbeats independently; daily totals sum but are capped per minute via upsert (`(user_id,date,bucket_start)` unique → `seconds = greatest(existing, new)`)
- Past dates locked (no edits)

## 8. Files

**New**
- `supabase/migrations/<ts>_cms_checkout_activity.sql`
- `src/hooks/useCmsActivityTracker.ts`
- `src/hooks/useCmsActivitySummary.ts`
- `src/pages/cms/CmsActivityMonitoring.tsx`

**Edited**
- `src/hooks/useCmsAttendance.ts` (+ checkOut, working_minutes)
- `src/components/cms/CmsCheckinCard.tsx` (check-out UI, working hours, status)
- `src/components/cms/CmsLayout.tsx` (mount tracker, privacy notice)
- `src/components/cms/CmsSidebar.tsx` (add Activity link)
- `src/lib/cmsPermissions.ts` + `useCmsPermissions.ts` (new capabilities)
- `src/App.tsx` (route)

## Open questions before building

1. **Idle/Inactive thresholds** — use 5 min idle / 15 min inactive (per spec) or make admin-configurable?
2. **Working hours definition** — total elapsed time (check-in → check-out) OR active-only time (excluding inactive)?
3. **Who can see Activity Monitoring** — Admin only, or also Team Leader (matches spec "Admin")?
