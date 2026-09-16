# Objections: SLA explanations, volume context, decision KPIs and per-objection handling time

Four additions to the Quality → Objections tab. All read-only reporting on the iSchool replica; no database or schema changes.

## 1. Tooltips on the average SLA cards

Each of the three "Avg wait" cards gets an info icon with a hover/tap tooltip spelling out the calculation, for example:

> Average of (today − date the objection was raised), counted only for objections still waiting on the team leader. Overdue = those whose team-leader deadline has already passed. Follows the filters set above.

QC and QTL cards say the same with their own stage and deadline. The QTL card also notes it includes the "waiting for review edit" and "waiting for QTL confirmation" steps.

## 2. Volume behind each average

Each SLA card's hint line gains the tutor and review counts already returned by the summary query:

```text
31.3 days
184 of 194 overdue · 100 tutors · 120 reviews
```

## 3. New KPI row: decisions by role

Counts of how many objections each role accepted and rejected, under the same filters:

```text
Team Leader decisions      Quality Coordinator      Quality Team Leader
120 accepted · 84 rejected  96 accepted · 40 rejected  60 accepted · 31 rejected
```

"Accepted" means that role agreed to remove the objected item; "rejected" means that role turned it down. A single objection can be accepted by the TL and later rejected by the QTL, so these three cards are independent, not a split of the total.

## 4. Handling time breakdown per objection

The objection detail dialog gets a "Handling time" panel, shown for open and closed objections alike:

```text
Total: 22.4 days (raised 12 Aug → closed 3 Sep)
  Team Leader           6.1 days
  Quality Coordinator   4.0 days
  Quality Team Leader  12.3 days
```

Time is split by who was holding the objection during each period: from when it was raised until the team leader acted counts as team-leader time, from there until the quality coordinator acted counts as QC time, and so on. Still-open objections count the current stage up to today and are labelled "still open".

## Technical details

1. **Discovery step first.** The accept/reject meaning of each `activities.action` code per role is not yet confirmed. Run a temporary probe query over `activities` where `trackable_type = 'QualityObjection'`, grouping by `action` with a sample `log` template and count, to map each action code to role + accept/reject. The KPI cards in section 3 are built on that mapping and only after it is confirmed; the probe query is removed afterwards.

2. **`supabase/functions/ischool-replica-query/queries.ts`**
   - `quality_objections_count`: add six columns — `tl_accepted`, `tl_rejected`, `qc_accepted`, `qc_rejected`, `qtl_accepted`, `qtl_rejected` — as `count(*) filter (where exists (select 1 from public.activities act where act.trackable_type = 'QualityObjection' and act.trackable_id = o.id and act.action = any(<codes>)))`, using the confirmed code sets and the existing filters.
   - New `quality_objection_sla` query keyed on `objection_id`: pulls the objection's `created_at`, `resolution_date`, current status and its ordered `activities` rows with `${OBJ_ACTOR_ROLE}`; a window function (`lag(created_at)`) gives each event's segment start, and the result aggregates seconds per role into `tl_days`, `qc_days`, `qtl_days`, `total_days`, plus `closed` and `closed_at`. Open objections attribute the trailing segment (last event → `now()`) to the role implied by `${OBJ_STAGE}`.

3. **`src/hooks/useQualityObjections.ts`** — add the six decision counts to `ObjectionSummary`.

4. **`src/components/tracking/quality/QualityObjectionsTab.tsx`** — tooltips (shadcn `Tooltip` + `Info` icon next to the card label; extend `Kpi` in `QualityFilterBar.tsx` with an optional `tooltip` prop), extended hints, and the new decisions KPI row.

5. **`src/components/tracking/quality/QualityObjectionDetailDialog.tsx`** — call `quality_objection_sla` with `useReplicaQuery` (enabled when a row is open) and render the handling-time panel above the handling chain.

6. **Verify** — deploy `ischool-replica-query`, curl both queries to sanity-check the numbers (per-role days should sum to the total), run `npx tsgo --noEmit`, check the build log.
