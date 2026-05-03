
## Problem

A user on their laptop cannot log in: after submitting credentials the app loads, then bounces back to the login page. Network shows:

```
POST /auth/v1/token?grant_type=refresh_token  →  429 Too Many Requests
```

This means the Supabase auth client on that laptop is hammering the refresh-token endpoint until Supabase rate-limits it. Once rate-limited, no session can be established and the app redirects back to `/auth`.

## Root cause analysis

Looking at `src/integrations/supabase/client.ts` we use the default `autoRefreshToken: true` + `persistSession: true` with `localStorage`. The auth logs confirm the pattern:

```
400: Invalid Refresh Token: Refresh Token Not Found
```

So the laptop has a **stale/invalid refresh token cached in localStorage** (likely from an old session, another environment like the preview vs published domain, or a manually cleared user on the server). On every page load:

1. Supabase JS reads the stale refresh token from localStorage
2. Tries to exchange it → 400 `refresh_token_not_found`
3. Our `AppLayout` sees no session → redirects to `/auth`
4. `/auth` mounts, Supabase JS retries refresh again
5. Possibly multiple tabs / React StrictMode double-mount amplify it
6. After enough retries in a short window → **429 Too Many Requests**
7. Even a fresh `signInWithPassword` then competes with the throttled endpoint, so the new session never sticks → loop

The user's local state is poisoned; the app has no recovery path that clears it.

## Plan

Two fixes — one the user can do right now, one in the code so this never traps another user.

### 1. Immediate user-side recovery (no code change)

Tell the user to do **one** of these on the affected laptop:
- Open DevTools → Application → Storage → "Clear site data" for `b2c-system.lovable.app` (and the preview domain), then retry login, **or**
- Open the site in a private/incognito window and log in there.

This clears the stale refresh token and the 429 throttle window expires within a minute.

### 2. Code change — auto-recover from invalid refresh tokens

Add a small bootstrap in `src/integrations/supabase/client.ts` (or a new `src/integrations/supabase/authRecovery.ts` imported from `main.tsx`) that:

- Subscribes to `supabase.auth.onAuthStateChange`
- On `TOKEN_REFRESHED` failure / `SIGNED_OUT` triggered by an invalid refresh token, calls `supabase.auth.signOut({ scope: 'local' })` to wipe the bad token from localStorage
- Wraps the initial `getSession()` call: if it returns an error whose code is `refresh_token_not_found` or `invalid_refresh_token`, clear the `sb-*-auth-token` keys from localStorage and redirect to `/auth` cleanly (no further retries)

Also harden `Auth.tsx`:
- On mount, if there is no valid session AND the URL has no `login_token`, proactively call `supabase.auth.signOut({ scope: 'local' })` once before showing the form. This guarantees a clean slate so a fresh `signInWithPassword` is not racing a background refresh loop.

Harden `AppLayout.tsx`:
- When `getSession()` returns null, also clear any leftover `sb-*-auth-token` localStorage keys before navigating to `/auth`, so the next visit does not re-trigger the bad refresh.

### 3. Optional: surface a friendly message on 429

In `Auth.tsx` `handleSubmit`, detect the Supabase error message containing `rate limit` / status `429` and show a toast: "Too many login attempts from this device. Please wait a minute and try again, or clear your browser site data."

## Technical details

Files to touch:
- `src/integrations/supabase/client.ts` — keep config as-is, but export a small `clearStaleAuth()` helper that removes `localStorage` keys matching `/^sb-.*-auth-token$/`.
- `src/main.tsx` — call a one-shot `bootstrapAuth()` that listens for refresh failures and calls `clearStaleAuth()` + redirects.
- `src/pages/Auth.tsx` — pre-clear local auth state on mount when no `login_token`; map 429 errors to a clear toast.
- `src/components/layout/AppLayout.tsx` — call `clearStaleAuth()` before `navigate("/auth")` when no session.

No database, RLS, or edge function changes are needed.

## Out of scope

- Changing Supabase rate-limit settings (not user-configurable from Lovable Cloud).
- Replacing `localStorage` with another storage — `localStorage` is required by our existing token-login flow.
