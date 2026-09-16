# Quality > Objections tab

A new read-only tab inside the Quality section that shows every objection raised on a session review, where it currently sits in the handling chain, what was accepted or rejected (and by whom), and any resulting score change.

## What the tab shows

**Filter bar** (same style and scoping as the other Quality tabs): date range, team leader, tutor (name or T-ID), stage, outcome, reviewer, and a free-text search.

**Headline numbers**
- Total objections in range
- Pending with Team Leader / Quality Coordinator / Quality Team Leader
- Resolved (accepted, partially accepted, rejected)
- Comments accepted vs rejected
- Reviews whose score changed, split into score increased / decreased, with the average change

**Objections list** — one row per objection:
- Tutor (name + T-ID), team leader, session date and type, lesson
- Original score, current score, and the change shown as +/- with an up or down arrow (no arrow when unchanged)
- Current stage badge: Pending Team Leader, Pending Quality Coordinator, Pending Quality Team Leader, or Resolved
- Who it is waiting on right now, and how long it has been waiting
- Counts of accepted and rejected comments

**Objection detail dialog** (click a row):
- Timeline of the handling chain: who acted, at which stage, what they decided, when, and their note
- Every objected comment/criterion with its status (accepted / rejected / pending), the decider's name and role (TL, QC, QTL), and the reason given
- Score panel: score before, score after, per-criterion changes where available

**Export**: CSV of the filtered objections list.

## Behaviour notes

- Data is read-only from the iSchool system; nothing is written back.
- The tab respects the existing Quality scoping, so a team leader sees their own team and a mentor sees their tutors, while admins see everything.
- Stage labels come from the iSchool objection records; any stage value we do not recognise is shown as-is rather than hidden.

## Technical approach

1. **Discovery step first.** The objection tables in the replica have not been inspected yet (only the `has_pending_objections` / `quality_objections_count` fields on `quality_reviews` are used today). The first build step lists the objection-related tables and columns through the existing `list_tables` / `list_columns` gateway queries and maps: objection record, per-comment decisions, approver role, timestamps, and score before/after. The queries below are then written against the real columns; if a field such as score-before does not exist, that panel is derived from the review's score history or dropped, and that is called out.
2. **New named queries** in `supabase/functions/ischool-replica-query/queries.ts`, reusing `QUALITY_PARAMS`/`QUALITY_CLAUSES` for filtering and scoping: `quality_objections_list` (paged), `quality_objections_count` (summary KPIs), `quality_objection_detail` (one objection: decisions timeline + per-comment rows + score change), `quality_objection_options` (filter dropdown values). Redeploy the function.
3. **New hook** `src/hooks/useQualityObjections.ts` built on `useReplicaQuery` and `useQualityFilters`, matching the pattern in `useQualityReviews.ts`.
4. **New components** `QualityObjectionsTab.tsx` and `QualityObjectionDetailDialog.tsx` under `src/components/tracking/quality/`, registered as an "Objections" tab in `QualitySection.tsx`. Charts, if any, use native recharts. Dialog capped at 85vh with internal scroll.
5. No database or schema changes in this app.
