# Quality Reviews from the iSchool replica

Build the Reviews area of Performance → Quality on top of the live iSchool connection, using the structure in the SQL you sent.

## What the data looks like

From your query, one session review is `quality_reviews`, joined to:
- the tutor (name, T-ID) and that tutor's team leader
- the session (join times, student feedback, absence), the student, the lesson and the organization
- `quality_evaluations` — one row per criterion with a score, joined to `quality_criteria`, which has a parent criterion (Teaching, Attitude, Curriculum, Preparation, Feedback, Setup) and sub-criteria under it
- `quality_review_comments` → `quality_comments`, where `comment_type` 0 is positive and 1 is negative

Each review has a final score out of 5, each main category has its own score out of 5, and the categories are derived by rolling up their sub-criteria.

## What gets built

### 1. Reviews list
A table of session reviews with filters: date range (session date), team leader, tutor (name or T-ID), session type, status, and score range. Each row shows tutor, T-ID, team leader, session date, session type, lesson, final score out of 5, flags (needs coaching / immediate action / remarkable), and objection status. Paged, with a result count and CSV export.

### 2. Review details
Clicking a row opens a dialog with:
- header: tutor, team leader, session date/type, lesson, student, final score
- the six main categories, each with its score out of 5 and a bar, expandable to show its sub-criteria scores
- comments split into two lists: Positive and Needs improvement
- session context: tutor join time, student join time, student feedback and comment, student absent

### 3. Insights
Above the list: average final score, number of reviews, share needing coaching / immediate action, plus average score per main category, and a breakdown by team leader and by tutor for the selected period. Charts use recharts directly.

## Approach

All reads stay server-side through the existing secure gateway; the browser only sends a query name plus filters, never SQL. Nothing is copied into this app's database — the numbers are live from iSchool.

## Technical notes

Add to `supabase/functions/ischool-replica-query/queries.ts`:
- `quality_reviews_list` — reviews joined to tutors, team-lead admin, sessions, lessons; params: `date_from`, `date_to`, `team_lead`, `tutor` (name or `t_id`), `session_type`, `status`, `min_score`, `max_score`, `limit`, `offset`; filtered on `quality_reviews.type = 'QualityReview'`.
- `quality_reviews_count` — same filters, returns the total for paging.
- `quality_review_detail` — one review with tutor/session/student/lesson context; param `review_id`.
- `quality_review_criteria` — `quality_evaluations` joined to `quality_criteria` and its parent, returning parent name, child name and score; param `review_id`. Main-category score = the evaluation row whose criterion has no parent when present, otherwise the average of its children.
- `quality_review_comments` — `quality_review_comments` joined to `quality_comments` and the criterion, returning body, `comment_type` and criterion; param `review_id`, `deleted_at is null`.
- `quality_summary` — aggregates over the same filters: review count, avg score, coaching/immediate-action counts.
- `quality_category_averages` — avg score per parent criterion over the filters.
- `quality_by_team_leader` and `quality_by_tutor` — avg score and review count grouped, over the filters.

Client:
- `src/hooks/useQualityReviews.ts` wrapping `useReplicaQuery` for list + count + summary with a shared filter object.
- `src/components/tracking/quality/QualityReviewsTab.tsx` rewritten as filters + insights + table (the current connection-status card moves into a small collapsed "connection" line).
- `src/components/tracking/quality/QualityReviewDetailDialog.tsx` (85vh, internal scroll).
- `src/components/tracking/quality/QualityReviewsInsights.tsx` using native recharts.
- Team-leader filter values come from the replica's admin names as-is; mapping them onto the five canonical team leaders in `src/lib/teamLeaders.ts` is a follow-up once we see the real values.

Row caps and the 20s statement timeout in the gateway stay; list queries page with `limit`/`offset`.
