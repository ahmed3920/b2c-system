# Move Quality out of Performance into its own nav item

Quality currently lives as a tab inside the Performance page. It becomes a top-level entry in the left navigation named "Quality", with its eight existing sub-tabs (Overview, Reviews, Session Details, Mentor Comments, Summary, Cycle Comparison, Review Coverage, Flag Follow-up) unchanged.

## What changes

- New "Quality" item in the left navigation, under Operations (next to Performance), visible to admins, team leaders, mentors and community moderators — the same people who can see it today.
- New page at `/quality` that shows the Quality section exactly as it looks now.
- The Quality tab is removed from the Performance page, for both the full view and the mentor/CS-only view. Performance keeps Live Issues, Lateness and CS Tickets.
- Existing links that point at Quality inside Performance (notification deep links to a specific review) keep working: they land on the new Quality page with the same review opened.

## Technical notes

- Add `src/pages/Quality.tsx` rendering `<AppLayout title="Quality" allowedRoles={["admin","team_leader","mentor","community_moderator"]}>` around `QualitySection`.
- Register route `/quality` in `src/App.tsx`.
- Add nav item `{ title: "Quality", url: "/quality", icon: ShieldCheck, roles: [...] }` to the `operations` array in `src/components/layout/AppSidebar.tsx`.
- In `src/pages/Performance.tsx`: drop the `quality` entry from `sections` and `mentorTabs`, remove both `QualitySection` usages and the import; default mentor tab stays `cs-tickets`.
- Backwards compatibility: in `Performance.tsx`, if `?tab=quality` is present, redirect to `/quality` preserving `sub` and `review` params (notification links use `/performance?tab=quality&review=<id>`). Optionally update the notification link generator later; the redirect covers existing rows.
- No changes to `QualitySection`, its sub-tabs, hooks, or the replica gateway.
