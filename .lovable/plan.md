## Session Incident Tickets (Edu → CS)

A new feature so Team Leaders and Mentors can log a "Session Incident Ticket" that captures session-level issues (separate from CS Tickets). Admin controls field requirements and case categories. Tutors can self-submit via a public link; submissions need TL/Mentor validation before being marked sendable to CS.

### Form fields
1. Student ID
2. Student Name
3. Student Grade (e.g. Grade 5, M2)
4. Tutor ID — auto-fills tutor name + team leader from roster
5. Session Date
6. Session Number (e.g. "Session 11" or "General")
7. Case Category (admin-managed dropdown, seeded with the 10 from the screenshot + Other)
8. Case Description
9. Supporting Document Link (Drive URL, optional)

### Admin controls
- New admin page: **Session Incident Settings** (`/admin/incident-settings`)
  - Tab 1: **Field Requirements** — toggle each field as required/optional/hidden (except Tutor ID + Case Category which stay required)
  - Tab 2: **Case Categories** — add/edit/reorder/disable categories (mirrors `cs_ticket_categories` admin UI)

### Tutor self-submission
- **Generic public link**: `/incident-submit` — anyone (incl. tutors) can fill the form. Tutor ID lookup auto-fills name/TL.
- **Per-tutor pre-filled link**: TLs/Mentors generate `/incident-submit?token=...` which pre-fills tutor info and locks tutor identity. Token table tracks who generated it.
- All public submissions land with `source = 'tutor_self'` and `validation_status = 'pending'`.

### Validation flow
- TL of the tutor's team **and** the assigned mentor see pending submissions in a "Pending Validation" tab.
- Validators can: **Approve** (mark valid → ready to forward to CS), **Reject** (with reason), or **Edit & Approve**.
- Approved/rejected stays in the incident table (no auto-conversion to `cs_tickets`).

### Where it lives in the UI
- New page **Session Incidents** (`/session-incidents`), accessible to TLs, Mentors, Admins. Tabs:
  - All Incidents (role-scoped)
  - My Pending Validation (TL/Mentor)
  - Generate Tutor Link
- "New Incident" button opens the form dialog.

### Technical details

**New tables**
- `session_incidents` — student_id, student_name, student_grade, tutor_external_id, tutor_name, team_leader, session_date, session_number, case_category, case_description, supporting_link, source ('staff' | 'tutor_self'), submitted_by (uuid, nullable), validation_status ('pending' | 'approved' | 'rejected'), validated_by, validated_at, rejection_reason, sent_to_cs (bool), token_id (nullable).
- `session_incident_categories` — name, display_order, is_active (admin-managed).
- `session_incident_field_config` — field_name, is_required, is_visible (admin-managed; seeded with the 9 fields).
- `session_incident_tokens` — token (random hex), tutor_external_id, tutor_name, team_leader, created_by, created_at, last_used_at.

**RLS**
- Admin: full access on all four tables.
- TL: SELECT/UPDATE incidents where `team_leader_name_matches(team_leader, get_current_user_mentor_name())`.
- Mentor: SELECT/UPDATE incidents where the tutor's mentor (from `tutor_roster` lookup, mirrored via a helper) is the current user — implemented with an `assigned_mentor_name` column populated on insert from the roster.
- Public submission via dedicated edge function `submit-session-incident` (uses service role, no RLS issues; validates token if present).
- Categories + field config: SELECT public (active rows), admin manages.

**Edge function**
- `submit-session-incident`: validates payload with zod, looks up tutor → name/TL/mentor, inserts row.

**Frontend files**
- `src/pages/SessionIncidents.tsx` (main page, tabs)
- `src/pages/IncidentSubmit.tsx` (public submit, no auth required, route added in `App.tsx`)
- `src/pages/SessionIncidentSettings.tsx` (admin config)
- `src/components/session-incidents/IncidentFormDialog.tsx`
- `src/components/session-incidents/IncidentForm.tsx` (shared form for staff + public)
- `src/components/session-incidents/IncidentValidationDialog.tsx`
- `src/components/session-incidents/GenerateTutorLinkDialog.tsx`
- `src/components/session-incidents/IncidentsTable.tsx`
- `src/hooks/useSessionIncidents.ts`, `useSessionIncidentCategories.ts`, `useSessionIncidentFieldConfig.ts`
- Sidebar entry in `AppSidebar.tsx`; feature toggle in `feature_controls`.

### Out of scope
- Auto-creating a `cs_tickets` row from approved incidents (validation answer was "stays separate"). A "Mark sent to CS" toggle is provided for tracking.
- Email notifications (can be added later).
