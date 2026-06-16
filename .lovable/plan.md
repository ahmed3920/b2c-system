## CS Tickets: Parent Attachments + Close/History

### Database migration
Add to `cs_tickets`:
- `parent_attachments jsonb default '[]'` — files & links uploaded by parent/staff
- `created_by_name text` — backfilled from `profiles.full_name` via `created_by`
- `closed_at timestamptz`, `closed_by uuid`, `closed_by_name text`

Update `cs_ticket_mentor_update_guard()` so mentors cannot modify these new fields (already partially staged earlier — will be re-applied cleanly).

Backfill `created_by_name` for existing rows by joining on `created_by`.

### Storage
Reuse existing `cs-recordings` private bucket under path `<ticket_id>/parent/<filename>`. No new bucket.

### Frontend
**`CSTicketFormDialog`**
- New "Parent Attachments" section: file picker (multi) + add-link input.
- Two-step save when files are present: insert ticket first → upload to storage → patch `parent_attachments` with `[{type:'file'|'link', name, path|url, size, mime, uploaded_at}]`.
- Stamp `created_by` (auth.uid) and `created_by_name` on insert.

**`CSTicketDetailDialog`**
- Header: "Created by {name} on {date}" and, when closed, "Closed by {name} on {date}".
- Parent Attachments panel: list files (signed-url view/download) and links; staff (admin/TL/CS full-access) can add/remove.
- **Close Ticket** button (admin / TL / CS full-access) → sets `closed_at=now()`, `closed_by=auth.uid`, `closed_by_name`, status `Closed`. **Reopen** clears them.
- Log close/reopen events to `cs_ticket_audit`.

### Permissions recap
- Mentors: read attachments, cannot add/remove, cannot close.
- Admin / TL / CS full-access: full control.

### Out of scope
No change to mentor validation auto-fill trigger (already in place from prior migration).
