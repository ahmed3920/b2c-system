## Problem

When mentor T-4218 tries to attach a file to a CS ticket, storage returns "new row violates row-level security policy".

The `cs-recordings` bucket has three policies:
- Admin: ALL
- Team Leader / Super TL: ALL
- Assigned Mentor: **SELECT only**

So assigned mentors (and any non-admin/non-TL user) cannot `INSERT` into `storage.objects`, which is exactly what `supabase.storage.from("cs-recordings").upload(...)` does. The UI in `MentorEvaluationSection` allows mentors to upload, but the storage policy blocks it.

## Fix

Add storage policies on `storage.objects` to let the assigned mentor of a ticket upload, update, and delete their own files in the `cs-recordings` bucket — scoped to that ticket's folder (`<ticket.id>/...`). Also extend access to users granted CS full access (`cs_ticket_full_access`), which already gates the UI for staff like Ghada/Kareem.

### Migration (storage policies only)

1. `cs_recordings_mentor_insert` — INSERT WITH CHECK:
   - `bucket_id = 'cs-recordings'`
   - The object path's first segment matches a ticket where `assigned_mentor_id = auth.uid()`.
2. `cs_recordings_mentor_delete` — DELETE USING the same predicate (so mentors can remove files they added; UI already restricts to their own attachments).
3. `cs_recordings_cs_full_all` — ALL for users present in `cs_ticket_full_access` (mirrors UI permission).

No changes to the existing admin / TL / mentor-read policies.

## Code

No code changes. The upload flow in `src/components/cs-tickets/MentorEvaluationSection.tsx` is correct; only the storage RLS was too strict.

## Validation

- Sign in as the assigned mentor for a CS ticket, attach a file → upload succeeds, file appears in recordings list.
- Removing a mentor-added file still works (already gated client-side to `added_by === currentUserId`).
- Admin / TL upload paths unchanged.
