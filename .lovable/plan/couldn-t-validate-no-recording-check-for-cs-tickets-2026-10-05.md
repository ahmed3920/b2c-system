# "Couldn't validate – no recording" check for CS tickets

## What changes
- **New checkbox on tickets**: "Couldn't validate — no session recording". Available to:
  - the mentor in the evaluation section,
  - the team leader / admin in the ticket popup when deciding the status.
  Optional short note field (e.g. "recording missing on the system"). The ticket can still be closed with any status; the flag just records why it couldn't be properly validated.
- **Badge in the CS Tickets list**: a small "No recording" tag on flagged tickets, plus it shows in the ticket popup and history log.
- **Filter in the CS Tickets list**: "Recording: All / No recording / Has recording check", with the count of flagged tickets next to it.
- **Export**: a "No recording" column in the CS tickets export.

## CS Analytics additions
- Filter: "No recording: All / Only flagged / Exclude flagged".
- KPI card: tickets that couldn't be validated due to no recording (count and % of total).
- Charts:
  - No-recording tickets over time (daily/weekly).
  - No-recording tickets by team leader (with labels).
  - Top tutors with no-recording tickets.
- Team leader table gains a "No recording" column; included in the PDF export.

## Technical details
- Migration: add to `cs_tickets` nullable/defaulted columns `no_recording boolean not null default false`, `no_recording_note text`, `no_recording_marked_by uuid`, `no_recording_marked_at timestamptz`. Existing RLS/grants cover them; the mentor update guard trigger is checked so mentors may set these fields.
- `MentorEvaluationSection.tsx` and `CSTicketDetailDialog.tsx`: checkbox + note, saved with the existing update; change logged via `logCSTicketChanges`.
- `useCSTickets.ts` type, `CSTicketsTable.tsx` filter/badge, `CSTicketsExportDialog.tsx` column.
- `useCsTicketAnalytics.ts` selects the new column; `CsTicketsAnalyticsTab.tsx` adds filter, KPI, charts (`data-chart` so PDF export picks them up).
