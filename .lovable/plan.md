# Quality: coverage dashboard, review progress, red-flag follow-up

Three additions to Performance → Quality.

## 1. Missing reviews per team leader

A new card at the top of the Review Coverage tab (and on the Quality Overview tab) showing, for the selected cycle, one row per team leader with:

- tutors due a review, reviewed, missing, and no-session counts
- a bar showing the share reviewed
- a "View" link that opens the Coverage tab already filtered to that team leader and to "Missing review"

It respects the same access rules as the rest of Quality: team leaders see only their own team, mentors only their tutors, admins see everyone.

## 2. Review progress on each tutor row

Each tutor row in the Coverage tab gets a small progress bar: reviews done out of active (held) sessions in the cycle, with the numbers next to it. Where the tutor already has a review, the row gets a link that opens that review's detail directly (the newest one for the cycle).

## 3. Red-flag follow-up tab

A new "Flag Follow-up" tab listing every red-flagged review in the selected cycle: tutor, team leader, session date, score, the flag's criterion and description, and a link to the full review.

Next to each flag, a status (Open / In progress / Done) and a free-text note field so team leaders can record the action taken. Entries save to our own database (not the read-only iSchool copy) with who wrote them and when. Team leaders and mentors can add notes for tutors in their scope; admins for anyone.

Yellow flags can be shown too via a filter on the same tab, defaulting to red only.

## Technical notes

Replica gateway (`supabase/functions/ischool-replica-query/queries.ts`), all reusing `COVERAGE_CTE` / `QUALITY_JOINS` so filters and scope behave identically:

- `quality_coverage_by_team_leader` — group `classified` by `team_leader`, returning total/reviewed/missing/no_sessions.
- Extend `quality_coverage_list` with `last_review_id` (newest `quality_reviews.id` for the tutor in the cycle) for the row link.
- `quality_flags_list` / `quality_flags_count` — join `quality_review_flags` to `quality_reviews` + tutor/TL/mentor/org joins, filtered by cycle, flag type (2 red, 1 yellow) and the standard quality filters.

Local database (Lovable Cloud) migration:

- `quality_flag_followups` (`id`, `flag_id bigint`, `review_id bigint`, `tutor_tid`, `team_leader`, `status text default 'open'`, `note text`, `created_by uuid`, `updated_at`), unique on `flag_id`.
- GRANTs for `authenticated` + `service_role`, RLS on: admins full access via `has_role`; team leaders and mentors read/write rows whose `team_leader` matches theirs (same normalization used elsewhere).

Frontend:

- `useQualityCoverage.ts` — add team-leader breakdown query + `last_review_id` in the row type.
- New `QualityCoverageByTeamLeader.tsx` card, used in `QualityCoverageTab.tsx` and `QualityOverviewTab.tsx`.
- New `useQualityFlagFollowups.ts` (replica flags + local notes merged by `flag_id`) and `QualityFlagFollowupTab.tsx`, registered as a `followup` subtab in `QualitySection.tsx`.
- Progress bar via existing `Progress` component; review links reuse `/performance?tab=quality&review=<id>`.
