# Scope Quality reviews to the signed-in person's team

Today every Quality tab shows all tutors' reviews. This change limits what each person sees.

## Rules

- Admin: sees everything, team-leader filter stays free to change (no change).
- Team leader (incl. super team leader): sees only reviews of tutors on their own team. The team-leader filter is locked to their name.
- Mentor / community moderator: sees only reviews of tutors they mentor. Locked, no team-leader or mentor picker.

The lock applies to every Quality tab (Overview, Reviews, Session Details, Mentor Comments, Summary, Cycle Comparison), including the KPI cards, charts and CSV exports, since they all run through the same filter state.

## How it works

1. `queries.ts` (replica gateway): add a `mentor` parameter to `QUALITY_PARAMS` with clause
   `($13::text is null or (m.name_i18n->>'en') ilike '%' || $13::text || '%')`, appended after `flag`. Shift the pagination/comment placeholders that follow it in `quality_reviews_list`, `quality_session_details`, `quality_review_comments`, and include the new key in `quality_filter_options` exclusion logic. Redeploy the function.
2. New hook `useQualityScope()`: reads the signed-in user's role (`useUserRole`) and their `profiles.mentor_name`, returning `{ lockedTeamLead, lockedMentor, loading }`.
3. `useQualityReviews.ts`: `useQualityFilters` merges the locked values into `baseParams` (overriding whatever is in filter state), adds `mentor` to `QualityFilters`/`toBaseParams`, and holds queries until the scope has loaded so no unscoped request fires first.
4. `QualityFilterBar.tsx`: when a lock is active, hide the Team leader dropdown and show a small read-only badge such as "Team: Ahmed Hesham Helmy" (or "Mentor: <name>"). `reset()` keeps the lock.
5. Name matching uses the existing canonical team-leader normalization (`normalizeTeamLeaderName`) so profile name variants match the replica's `admins.name`.

## Verification

Sign in as a team leader in the preview, open Performance > Quality > Reviews, and confirm the row count and team-leader column show only that team; repeat for a mentor account; confirm an admin still sees all.
