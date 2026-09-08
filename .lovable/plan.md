# Connect the iSchool read-only replica to the Quality section

## Goal
Let the app read live quality data straight from the iSchool production replica (read-only), and prepare the Quality area in Performance to grow into several tabs fed by that data.

## Step 1 — Store the connection safely
The database host, user and password you shared must never live in the app's code (the app runs in the browser, anyone could read it). They will be saved as backend secrets:
- `ISCHOOL_REPLICA_HOST`
- `ISCHOOL_REPLICA_USER`
- `ISCHOOL_REPLICA_PASSWORD`
- `ISCHOOL_REPLICA_DB`

Recommended: change this password afterwards if it has been shared elsewhere, and ideally use a dedicated read-only account rather than `postgres`.

## Step 2 — A single secure gateway
Create one backend function, `ischool-replica-query`, that:
- Verifies the caller is signed in and is an Admin, Team Leader, or Super Team Leader.
- Connects to the replica over SSL as read-only.
- Accepts only a named query key (for example `quality_reviews_by_month`) plus safe parameters such as date range, team leader, or tutor id. It never accepts raw SQL from the browser.
- Returns rows as JSON, with a row cap and a timeout so a heavy query can't hang the app.

A small registry file inside the function holds the approved SQL statements. When you send me your quality queries, each one is added to that registry as a new named key — no other change needed.

## Step 3 — Verify the connection
Before building any screen, run a connectivity check (server version, table list, one sample count) and report back what the replica exposes.

## Step 4 — Quality section prepared for multiple tabs
Restructure the Quality area in Performance into its own tabbed layout:
- Overview (the existing scores view, unchanged)
- Reviews (placeholder, fed by the first query you send)

A shared data hook (`useReplicaQuery`) calls the gateway with a query key and filters and caches results, so each new tab is a thin screen on top of one registered query.

## What I need from you next
The SQL for the quality reviews (and any other quality data you want), plus what each tab should show.

## Technical notes
- Function: `supabase/functions/ischool-replica-query/index.ts`, Deno + `npm:postgres`, `ssl: 'require'`, `max: 1`, idle timeout, statement timeout ~15s, `LIMIT` enforced.
- Auth: manual JWT verification (same pattern as the other admin functions), then role lookup.
- Client: `src/hooks/useReplicaQuery.ts` wrapping `supabase.functions.invoke`.
- UI: `src/components/tracking/quality/` with a tab shell; existing `QualityTab` becomes the Overview tab.
- No data is copied into the app's own database in this phase — reads are live. Caching or syncing can be added later if the replica proves slow.
