# Split the admin task view into Mentors and Team Leaders tabs

## What changes

On the Task Tracker page, admins currently switch between "My View / Team Leader View / Mentor View / All System" with a person picker. This becomes clear tabs:

```text
[ My Tasks ] [ Mentors Tasks ] [ Team Leaders Tasks ] [ All System ]
```

- **My Tasks** — the admin's own tasks (unchanged behavior).
- **Mentors Tasks** — all tasks belonging to mentors (and mentor-like roles: community moderators, etc.), aggregated in one list. An optional person picker on the tab narrows it to one mentor.
- **Team Leaders Tasks** — all tasks belonging to team leaders, aggregated. An optional person picker narrows to one team leader; when a leader is picked, the existing "TL's Tasks / Team's Tasks" sub-toggle stays available.
- **All System** — unchanged.

Each tab keeps the existing filters (search, type, status, month), the task table, the Assign Task button, and export. Switching tabs is instant — no page reload.

## Technical details

- `src/hooks/useAdminView.ts`:
  - `AdminViewMode` stays `"my" | "team_leader" | "mentor" | "all"` but gains aggregated behavior: when `viewMode` is `"mentor"` with no selected user, fetch tasks for **all** mentor user IDs (`.in("user_id", mentorIds)`); same for `"team_leader"` with all team-leader IDs. A selected user keeps the current single-person behavior (including the TL own/team sub-view).
  - Existing 1,000-row pagination already handles the larger result sets.
- `src/components/admin/AdminViewSelector.tsx`:
  - Re-render the mode switcher as tab-style buttons labeled "My Tasks", "Mentors Tasks", "Team Leaders Tasks", "All System".
  - Person picker becomes an optional "Filter by person" dropdown inside the Mentors / Team Leaders tabs (clearable to return to the aggregated list).
- `src/pages/Tasks.tsx`: no logic change expected — it already reads `adminView.viewMode`/`tasks`; verify the breakdown card and filters still behave per tab.
- No database or permission changes; admin read access to all tasks already exists.

## Verification

- `npx tsgo --noEmit` passes; build log clean.
- Manual check in preview as admin: each tab loads, counts look right, person picker narrows the list, Assign Task and export still work.
