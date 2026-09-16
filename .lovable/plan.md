# Average SLA KPI cards for objection stages

Add three KPI cards to the Quality → Objections tab showing how long objections have been waiting, on average, at each pending stage: Team Leader, Quality Coordinator, Quality Team Leader. Each card also shows how many of those waiting objections are already past their deadline.

## What you'll see

A new row of three cards under the existing stage cards:

```text
┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐
│ Avg wait — Team Ldr │ │ Avg wait — QC       │ │ Avg wait — QTL      │
│ 6.2 days            │ │ 4.0 days            │ │ 11.8 days           │
│ 38 of 194 overdue   │ │ 1 of 3 overdue      │ │ 9 of 16 overdue     │
└─────────────────────┘ └─────────────────────┘ └─────────────────────┘
```

- "Avg wait" = average number of days since each pending objection was raised (only objections still sitting at that stage are counted).
- "Overdue" = waiting objections whose stage deadline has already passed (`edu_deadline` for Team Leader, `qc_deadline` for QC, `qlead_deadline` for QTL).
- All three cards respect the tab's filters (dates, team leader, tutor, stage, outcome, search), like every other card.

## Technical details

1. **`supabase/functions/ischool-replica-query/queries.ts` — extend `quality_objections_count`** (same filters, one extra row of aggregates, no new queries):
   - `pending_tl_avg_days`, `pending_qc_avg_days`, `pending_qtl_avg_days`:
     `round(avg(extract(epoch from (now() - o.created_at)) / 86400.0) filter (where ${OBJ_STAGE} = 'pending_tl')::numeric, 1)` (and the QC / QTL-in-3-stages equivalents).
   - `pending_tl_overdue`, `pending_qc_overdue`, `pending_qtl_overdue`:
     `count(*) filter (where ${OBJ_STAGE} = 'pending_tl' and o.edu_deadline is not null and o.edu_deadline < now())` (QC → `qc_deadline`, QTL → `qlead_deadline`).

2. **`src/hooks/useQualityObjections.ts`** — add the six new fields to `ObjectionSummary`.

3. **`src/components/tracking/quality/QualityObjectionsTab.tsx`** — new grid row with three `Kpi` cards: value `X days` (em dash when no objections are waiting at that stage), hint `N of M overdue`, `loading={f.summaryLoading}`.

4. **Verify** — deploy `ischool-replica-query`, run `quality_objections_count` via curl to confirm the new columns return sane numbers, run `npx tsgo --noEmit`, check the build log.

No database or schema changes; read-only reporting on existing data.
