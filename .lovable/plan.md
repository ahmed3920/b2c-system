# Flag Follow-up: export, full review link, objection info

Three additions to Quality → Flag Follow-up.

## 1. Export
- An **Export** button next to Refresh.
- It downloads every flag that matches the current filters, not just the page on screen. The follow-up filter is also respected.
- Columns: Tutor, T-ID, Team leader, Mentor, Reviewer, Session date, Cycle, Score, Score %, Flag (Red/Yellow), Criterion, Flag description, Objection (None / Pending / Accepted / Rejected), Objection stage, Objection decided by, Follow-up status, Action taken note, Last updated.
- File name: `flag-follow-up_<cycle or all>_<date>.csv`.

## 2. View the full review in place
- Clicking the tutor/flag cell or a new **View review** button opens the full review in a popup on the same page. It is the same review popup used in the Reviews tab, with score, criteria, comments and flags.
- The current external-link icon points to an old page address. It will be replaced by this popup.

## 3. Objection on the flag
- New **Objection** column on each row:
  - **None:** the tutor never objected to this flag.
  - **Pending:** shows a badge with who it is waiting on (TL / QC / QTL).
  - **Accepted:** the flag was removed after the objection.
  - **Rejected:** shows who rejected it (TL / QC / QTL).
- Clicking the badge opens the existing objection details popup, with the timeline, decisions and handling time.
- Rows where the review has objections on *other* items get a small "N other objections on this review" hint.
- New filter: **Objection:** All / Has objection / No objection.

## Technical details
- `queries.ts` → `quality_flags_list`: add a lateral join to `quality_objections` where `objectionable_type='QualityReviewFlag' and objectionable_id=f.id`. Take the latest one and return `objection_id`, `objection_stage` (`OBJ_STAGE`), `objection_outcome` (`OBJ_OUTCOME`) and `objection_decided_by` (last decision role from activities via `OBJ_EVENT_ROLE`). Add a scalar `review_objections_count`.
- Add an optional `has_objection` param ($19) to both `quality_flags_list` and `quality_flags_count`. Redeploy `ischool-replica-query`.
- `useQualityFlagFollowups.ts`: extend `FlagRow`, add an `objection` filter, and add `exportAll()`. It pages through `quality_flags_list` 500 rows at a time with `invokeReplica`, loads follow-ups for those flag IDs in chunks, then calls `downloadCsv`.
- `QualityFlagFollowupTab.tsx`: Export button with a spinner, Objection column and filter, and `QualityReviewDetailDialog` with `reviewId` state.
- For the objection popup, fetch the row with `quality_objections_list` filtered by objection ID (add an `objection_id` param if one doesn't exist yet). Pass the result to `QualityObjectionDetailDialog`.
