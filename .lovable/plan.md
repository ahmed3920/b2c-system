# Stop the CS Tickets page from reloading all the time

## What's wrong
The CS Tickets list clears and shows "Loading…" again in three cases:
1. **Returning to the browser tab:** every time you come back from another tab, the whole list is fetched again. For "All tickets", the list is blanked while that happens.
2. **Each save or step:** after any save (status change, mentor assignment, evaluation), the full list is reloaded behind a loading screen. Your own save also sends a "ticket changed" signal, so the list reloads a second time.
3. **Other people's edits:** any change to any ticket by anyone reloads the full list for everyone with the page open.

This comes from the auto-update I added last time so mentors see team leader decisions. It works, but it's too aggressive.

## Fix
- **Loading screen only on first open.** Later updates happen quietly in the background. The table stays on screen, and your scroll position, open popup, filters and search are kept.
- **Tab switching:** only refresh when you've been away for more than 2 minutes. Quick switches do nothing.
- **Changes signal:** group bursts of changes into one quiet update (wait about 1.5 seconds), and skip it right after your own save because that save already refreshed.
- **Only one update at a time:** if an update is already running, don't start another one.

Mentors still see team leader decisions without refreshing the page.

## Technical details
File: `src/components/cs-tickets/useCSTickets.ts`
- Split into `fetchAll(scope)` and `refresh({ silent })`. Set `loading = true` only when there are no tickets yet (`hasLoadedRef`).
- Add an `inFlightRef` guard. `lastFetchRef` stores a timestamp. The realtime handler skips if the last fetch was under 2s ago, and debounces for 1500ms.
- `visibilitychange`: record `hiddenAt`. On visible, refetch silently only if the tab was hidden for 2 minutes or more.
- Realtime channel name stays stable per scope. Deps become `[scope]` only, using a ref to the latest refresh, so the channel isn't re-created.
- Returned `refresh` (used by `onUpdated` after saves) runs silently.
