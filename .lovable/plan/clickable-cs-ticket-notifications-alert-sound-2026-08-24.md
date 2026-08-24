# Clickable CS Ticket Notifications + Alert Sound

## Goal
Clicking a CS ticket notification opens that exact ticket's details, and a Freshsales-style chime plays the moment a ticket-related notification arrives.

## Current state (verified)
- The three CS notification triggers write generic links: `/performance` (assigned / validated) and `/risk-control` (new ticket). `/risk-control` no longer exists — that page was removed, so those notifications currently lead nowhere.
- `NotificationsBell` already navigates to `n.link`, so making the link specific is enough to make it useful.
- `CSTicketsTable` (rendered on the Performance page, "CS Tickets" tab) owns the `selected` state that drives `CSTicketDetailDialog`.
- `useNotifications` subscribes to realtime INSERTs but plays no sound.

## What will change

### 1. Deep links to a specific ticket
- Update the notification triggers so every CS notification links to
  `/performance?tab=cs-tickets&ticket=<ticket_number>` (replacing both `/performance` and the dead `/risk-control`).
- Performance page: read the `tab` query param and open that tab.
- `CSTicketsTable`: read the `ticket` query param, find the matching ticket once tickets are loaded, open `CSTicketDetailDialog` on it, and clear the param after opening so closing the dialog doesn't reopen it.
- If the ticket isn't visible to that user (permissions/filters), show a short "Ticket not found or not accessible" toast instead of failing silently.

### 2. Notification sound
- Add a short chime asset in `public/` and play it in `useNotifications` whenever a realtime notification arrives.
- Browsers block audio before the first user interaction: unlock the audio element on the first click/keypress, so the chime works from then on.
- Add a mute toggle (small speaker icon) in the notifications popover header, persisted in `localStorage`.
- Sound plays for all incoming notifications (CS included), not only CS ones — simpler and consistent.

### 3. Bell polish
- Distinct icon/colour for `cs_ticket_validated` and `cs_ticket_assigned` types.

## Technical notes
- Trigger changes ship as one migration updating `notify_new_cs_ticket`, `notify_cs_ticket_validated`, and `notify_cs_ticket_mentor_assigned` — link text only, no logic change.
- Existing old notifications keep their old links; only new ones are deep-linked.
