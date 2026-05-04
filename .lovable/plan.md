# Trainings Management Tab

Add a fully functional **Trainings** sub-tab inside `/tracking` for **Admins** and **Team Leaders** (and Super Team Leaders). It replaces the current placeholder.

## Scope

1. **Backend (database + storage)**
2. **"Add Training" form dialog**
3. **Trainings list view (cards/table)**
4. **Insights panel with charts + global filters**

---

## 1. Backend

### New table: `trainings`
- `team_leader` (text) — owning team leader's name
- `creator_type` (enum: `team_leader` / `mentor` / `tutor`) — who *created* the training entry
- `creator_name` (text) — display label for creator
- `conducted_by` (jsonb array of `{ id, name, role }`) — multi-select people who delivered it
- `training_date` (date), `training_time` (time)
- `title` (text), `notes` (text, nullable)
- `sub_teams` (text[]) — optional list of sub-team / mentor names
- `material_urls` (jsonb array of `{ name, url, type: 'file'|'link' }`)
- `record_urls` (jsonb array, same shape)
- `created_by` (uuid), standard timestamps

### RLS
- Admins: full access.
- Team leaders / super team leaders: full access **only when `team_leader` matches their `mentor_name`** (via existing `team_leader_name_matches` helper).

### Storage
- Reuse the existing private bucket pattern. Create a new public bucket `training-materials` for uploaded files (publicly readable links, writes restricted to TL/Admin via policy on `storage.objects`).

---

## 2. Add Training Form

Dialog opened from a prominent **"Add Training"** button at the top of the Trainings sub-tab.

Fields (matching the spec):
- **Training Creator** (required, single select among `Me` / `Mentor` / `Tutor`, then a follow-up select to pick the actual person from the team roster when not "Me").
- **Conducted By** (required, **multi-select**) — combobox listing: `Me`, all mentors in the team, all tutors in the team.
- **Training Date** (required) — shadcn datepicker (`pointer-events-auto`).
- **Training Time** (required) — `<input type="time">`.
- **Training Title / Topic** (required) — text input.
- **Sub-Team** (optional, multi-select) — for TLs we use their mentors list as "sub-teams"; for admins, list of team leaders.
- **Training Material** (optional) — file upload (multi) + URL input → stored as array.
- **Training Record (if available)** (optional) — same widget as material.
- **Notes** (optional) — textarea.

Validation via `zod`. On submit: upload files to storage, then insert row.

Roster source: existing `tutorRoster` filtered by `team_leader` (admins pick a team leader first via dropdown).

---

## 3. List View

Table with columns:
- Title • Date (+ time) • Conducted By (chips) • Creator (type + name) • Sub-Team • Attachments (paperclip icons for material/record counts) • Actions (view / edit / delete for owner+admin).

Click a row → details dialog showing all fields and clickable attachment links.

---

## 4. Insights Panel

Collapsible panel above the list. Uses **native `recharts`** (per project rule — no `@/components/ui/chart`).

KPI cards:
- Total trainings
- Trainings this month
- Unique trainers
- % with material / % with record

Charts:
- **Bar chart**: trainings per month (last 12 months)
- **Bar chart**: trainings per sub-team
- **Donut**: breakdown by creator type
- **Horizontal bar**: top 5 most active trainers

### Global Filters (apply to both list + insights)
- Month / date range (from–to date pickers)
- Sub-team (multi)
- Conducted by (multi, from roster)
- Creator type (`all` / `team_leader` / `mentor` / `tutor`)
- Has Material (`all` / `yes` / `no`)
- Has Record (`all` / `yes` / `no`)

Filter state lives in the Trainings component; both the list and the analytics derive from the same filtered array.

---

## Files

**New**
- `supabase/migrations/...sql` — table, RLS, storage bucket + policies.
- `src/hooks/useTrainings.ts` — fetch/create/update/delete + filters.
- `src/components/tracking/trainings/TrainingsTab.tsx` — main container, filters, list, insights.
- `src/components/tracking/trainings/AddTrainingDialog.tsx` — the form (also handles edit).
- `src/components/tracking/trainings/TrainingDetailsDialog.tsx` — read-only details.
- `src/components/tracking/trainings/TrainingsInsights.tsx` — KPI cards + charts.

**Modified**
- `src/pages/Tracking.tsx` — wire `<TrainingsTab />` into the `trainings` `TabsContent`.

---

## Technical notes

- Roster: derive mentors/tutors per team via `tutorRoster` + `teamLeaderMatches`, excluding `useInactiveTutorIds`.
- For admins viewing all teams, add a "Team" filter; the form requires picking a team leader before showing roster.
- File uploads: max 25 MB each, accepted types `pdf, docx, pptx, png, jpg, jpeg, mp4`. URL inputs validated with `z.string().url()`.
- All access gated client-side via `useUserRole` (`isAdmin || isTeamLeader`) and server-side via RLS.
- Charts use `ResponsiveContainer` from `recharts` directly.

After approval I'll create the migration first, then build the UI.
