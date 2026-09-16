# Objections KPI cards: show distinct tutors and reviews per waiting stage

## Goal
The "Waiting on Team Leader / Quality Coordinator / Quality Team Leader" cards currently count objected comments (one row per objection). Add how many **distinct tutors** and **distinct reviews** those objections come from, shown alongside the comment count on each stage card.

## Changes

1. **Edge query — `quality_objections_count`** (`supabase/functions/ischool-replica-query/queries.ts`)
   - Add 6 new columns alongside the existing ones, using the same stage filters and `OBJ_FROM` join (reviews = `qr.id`, tutors = `t.id`):
     - `pending_tl_reviews` / `pending_tl_tutors` — `count(distinct ...) filter (where ${OBJ_STAGE} = 'pending_tl')`
     - `pending_qc_reviews` / `pending_qc_tutors` — same for `'pending_qc'`
     - `pending_qtl_reviews` / `pending_qtl_tutors` — same for `in ('pending_qtl','pending_edit','pending_qtl_confirm')`
   - Same filters as today (dates, team leader, tutor, stage, outcome, search) apply automatically.

2. **Hook — `useQualityObjections.ts`**
   - Extend the `ObjectionSummary` type with the 6 new fields.

3. **UI — `QualityObjectionsTab.tsx`**
   - On each of the three "Waiting on …" cards, keep the big number (objected comments) and add a small line under it, e.g.:
     - "From 12 tutors · 9 reviews"
   - No layout restructuring; cards stay in the existing KPI grid.

4. **Deploy + verify**
   - Deploy `ischool-replica-query`, run `tsgo --noEmit`, then call the count query via the edge function to confirm the new numbers are returned and plausible.

## Notes
- Read-only against the iSchool system; no database or permission changes.
- Existing cards (Objections, Still open, Accepted, Rejected, Reviews with objections, Tutors with objections) are unchanged.
