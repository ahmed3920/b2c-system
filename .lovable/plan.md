## Plan

1. **Stop the public submit request from using any browser/user JWT**
   - Change the incident submit page so the POST to `submit-session-incident` uses only the publishable anon key, not a stale logged-in session token from localStorage.
   - This avoids the Cloud gateway trying to validate a user token whose timestamp is ahead of server time.

2. **Make the public token lookup resilient too**
   - Keep using a non-persistent public client for reading the incident token.
   - Ensure it does not auto-detect or reuse existing auth state from the browser.

3. **Deploy and validate the backend function config**
   - Confirm `submit-session-incident` remains configured as a public function (`verify_jwt = false`).
   - Redeploy that function if needed so the published link uses the current public config.

4. **Improve the visible error handling**
   - Replace the browser `alert()` with the existing app toast/error handling pattern so users get a clean failure message and the form does not feel stuck.

## Technical details

- The app already has `verify_jwt = false` for `submit-session-incident`, so the edge function itself should not require a user JWT.
- The screenshot shows the error appears from the frontend `alert(e.message)` after the fetch fails.
- The most likely cause is the request still being sent through a path/header combination that causes a stale/future JWT to be checked before the function logic runs.
- I’ll keep the fix scoped to `src/pages/IncidentSubmit.tsx` and only touch function deployment/config if validation shows the deployed function is stale.