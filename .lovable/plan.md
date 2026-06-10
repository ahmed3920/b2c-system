## Goal
Confirm that admin-only edge functions (1) reject unauthenticated requests, (2) reject authenticated non-admin users with 403, and (3) accept the admin user after the recent `admin-update-user` fix — mirroring the working pattern used by `generate-weekly-plan`.

## Endpoints in scope
Admin-gated functions found in `supabase/functions/`:
- `admin-create-user`
- `admin-update-user` (the one just fixed)
- `admin-delete-user`
- `bulk-create-users`
- `generate-weekly-plan` (admin OR team_leader — used as reference)
- `seed-study-plan-sample`
- `sync-leaves-from-sheet`, `sync-live-issues-from-sheet`, `sync-quality-from-sheet`, `sync-study-plan-sheet`
- `import-csv-data`, `import-json-data`, `import-from-storage`
- `generate-login-token`
- `cms-admin-create-user`, `cms-admin-update-user` (CMS admin role — separate gate)

## Verification matrix
For each function, three probes via `supabase--curl_edge_functions`:

```text
                    | no auth | non-admin JWT | admin JWT
admin-update-user   |  401    |     403       |  200/safe-noop
admin-create-user   |  401    |     403       |  200
admin-delete-user   |  401    |     403       |  200 (dry payload)
bulk-create-users   |  401    |     403       |  200
generate-weekly-plan|  401    |  403 (mentor) |  200 / 400 valid
seed-study-plan...  |  401    |     403       |  200
sync-*-from-sheet   |  401    |     403       |  200
import-*-data       |  401    |     403       |  200
generate-login-token|  401    |     403       |  200
cms-admin-*         |  401    | 403 (non-cms) |  200 as cms_admin
```

Each call uses a payload that is either a no-op (e.g. `dryRun: true` if supported) or a syntactically invalid body so admin requests return 400 from validation rather than mutating data — confirming the auth gate passed without changing state.

## Identities used
- **no auth**: omit `Authorization` header.
- **non-admin**: sign in via a mentor test account → use that JWT in `Authorization: Bearer …`.
- **admin**: rely on the preview session (currently `admin@ischool.com`) which the curl tool injects automatically; for explicit checks, mint a fresh token by signing in as admin.

Test credentials are taken from `mem://tech/test-credentials`.

## Expected outcomes & reporting
Produce a single results table noting status code + response body snippet for each (function × identity). A green run = every cell matches the matrix above. Any 200 in the "non-admin" column or 403 in the "admin" column is a finding to fix.

## Out of scope
- No code changes unless a gap is found.
- No database mutations: payloads are crafted to either dry-run or fail validation after the auth check.

## Next step after approval
Switch to build mode, run the curl probes in parallel batches per identity, and report the results table.
