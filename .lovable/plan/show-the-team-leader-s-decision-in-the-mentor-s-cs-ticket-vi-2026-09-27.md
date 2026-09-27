# Show the team leader's decision in the mentor's CS ticket view

## What's going on
The team leader's or admin's changes do save. In the database, 270 mentor-assigned tickets are already marked Valid, Not Valid or Not a Complain, but the mentor never submitted an evaluation for them.

The problem is the mentor's "Assigned CS Evaluations" list. It never shows the ticket's real status. Its only status column is "Evaluation", which says "Pending" until the mentor writes their own notes. So even after the team leader closes a ticket, the mentor still sees "Pending". The list also only loads when the page opens, so changes don't show up until a refresh.

## Changes
1. **New "Ticket Status" column** in the mentor's list. It shows the team leader's decision as a coloured badge: Pending, Valid, Not Valid or Not a Complain. It uses the same colours as the main CS tickets table.
2. **Clearer "Evaluation" column:**
   - "Submitted" when the mentor has written an evaluation.
   - "Closed by TL" when the ticket is decided but the mentor never evaluated it.
   - "Pending" only when the ticket is still open and has no evaluation.
3. **Status filter** (All / Open / Closed) and counts, so mentors can find tickets that still need their action.
4. **Automatic updates:** the list listens for changes to the mentor's tickets and refreshes on its own. It also refreshes when the mentor comes back to the browser tab. Status and description edits then show up without reloading the page.
5. **Ticket detail popup (mentor view):** shows the current status and the team leader's response/description at the top. If the ticket is already closed, it says who closed it and when.

## Technical details
- `AssignedCSEvaluations.tsx`: add the status badge column (reuse the status colour map from `CSTicketsTable`), the new evaluation logic, and the Open/Closed filter.
- `useCSTickets.ts`: add a realtime subscription on `cs_tickets` (filtered by `assigned_mentor_id=eq.<uid>` for the `assigned_to_me` scope) and a `visibilitychange` refetch. A migration adds `cs_tickets` to the `supabase_realtime` publication if it isn't already there.
- `CSTicketDetailDialog.tsx`: make sure the status and `team_leader_response` read-only block shows for mentors.
- The database function and security rules stay as they are. The mentor already receives the full saved row.
