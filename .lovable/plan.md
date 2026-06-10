## Plan

1. **Remove the forced token purge on startup**
   - `IncidentSubmit` is imported eagerly by `App.tsx`, so its module-level `purgeStaleAuth()` runs on every app load, not just on the public incident form.
   - Remove that startup purge so refresh/reopen no longer deletes the stored auth session.

2. **Keep the public incident form isolated without logging users out**
   - Keep using a separate non-persistent client inside `IncidentSubmit` for public token reads.
   - Remove the global auth client dependency from that page where it is only used to clear auth storage.

3. **Harden auth restoration on app startup**
   - Add a small `useAuthReady` hook that waits for `supabase.auth.getSession()` before protected layouts make redirect decisions.
   - Update the shared B2C and CMS layouts to redirect only after auth restoration is complete, preventing false redirects during page refresh.

4. **Preserve explicit logout behavior**
   - Keep logout buttons as the only normal path that clears the session.
   - Avoid any automatic localStorage/session token deletion outside explicit logout.

5. **Validate the fix**
   - Confirm auth client still uses `localStorage`, `persistSession: true`, and `autoRefreshToken: true`.
   - Verify there are no remaining module-level token-clearing side effects.
   - Test refresh behavior on protected B2C and CMS routes.