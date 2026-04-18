
## Per-Tutor Drill-Down Modal

### Goal
Click any row in the "All Tutors" table to open a modal showing that tutor's complete evaluation history.

### UX
- Rows in "All Tutors" table become clickable (cursor pointer + hover highlight already present).
- Modal opens with:
  - **Header**: Tutor name + Tutor ID + current Team Leader
  - **Summary strip**: Avg score, # evaluations, highest score, lowest score
  - **History table**: Date (sorted newest first), Score (color-coded badge), Team Leader
  - Empty/edge handling for tutors with a single evaluation

### Implementation

**File: `src/components/tracking/QualityTab.tsx`** (only file touched)

1. Add state: `selectedTutor: AgentStat | null`.
2. Make `<TableRow>` in the "All Tutors" table clickable (`onClick`, `cursor-pointer`).
3. Compute `tutorHistory` via memo: filter `rows` (or `filteredRows` if date filter exists) by matching `tutor_id` (fallback to `agent_name` when ID missing), sort by `session_date` desc.
4. Render a `<Dialog>` (shadcn) with:
   - `DialogHeader` showing tutor identity
   - 4 small summary tiles (avg / count / high / low)
   - History `<Table>` with Date, Score (Badge: green ≥90, orange 75-89, red <75), Team Leader
5. Dialog respects existing 85vh max-height + internal scroll convention.

### Technical Notes
- Pure client-side; no DB/edge function/migration changes.
- Reuses already-loaded `rows` data — no extra queries.
- Uses existing `Dialog`, `Table`, `Badge` components.
- Date formatting via `date-fns` `format(..., "PP")` (already in project).
