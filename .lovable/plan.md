## Plan

1. Add a database migration that recreates `public.team_leader_name_matches(text, text)`.
2. Implement the same name-normalization behavior used in the frontend: lowercase, trim, collapse whitespace, remove punctuation, and allow shorter-name tokens to match within the longer name.
3. Mark the function as `stable`, `security definer`, and set `search_path = public` so RLS policies can call it safely.
4. Grant execute access to authenticated users, then verify the function exists and can be called.

## Technical details

The error happens because existing RLS policies and helper functions call `team_leader_name_matches(text, text)`, but the database function is missing. The migration will restore this function without changing app UI or business logic.

&nbsp;

also solve all errors on all migration because I want to dp push all migrations to supabase and each time it gives me an error on different function

&nbsp;