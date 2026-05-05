## Problem

`ERROR: function gen_random_bytes(integer) does not exist (SQLSTATE 42883)`

The `pgcrypto` extension is installed in the `extensions` schema (not `public`), so calls to `gen_random_bytes(...)` without a schema prefix fail. One past migration (`20260313145937_*.sql`, the `login_tokens` table) defines its `token` column default as:

```sql
token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex')
```

Every `INSERT` into that table that relies on the default triggers this error. The newer `session_incident_tokens` migration already uses the correct `extensions.gen_random_bytes(...)` form.

This matches the symptom: the error appears when an admin generates a login link (e.g. `generate-login-token` edge function inserts into `login_tokens`).

## Fix

Write a small migration that updates the default on `public.login_tokens.token` to use the schema-qualified function:

```sql
ALTER TABLE public.login_tokens
  ALTER COLUMN token SET DEFAULT encode(extensions.gen_random_bytes(32), 'hex');
```

No data is touched and no other code changes are needed. Existing rows keep their tokens; new inserts will work.

## Verification

- After the migration, generate a login link from the admin UI (or call `generate-login-token`) and confirm a row is inserted with a fresh token and no SQL error.

## Notes

If you actually hit this error from a different action (not login-link generation), let me know which screen/action triggered it so I can check whether another object also has a bare `gen_random_bytes` reference.