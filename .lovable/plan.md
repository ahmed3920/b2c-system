# Quality area: status filter, new tabs, review notifications, cycle comparison

All data continues to come live from the read-only iSchool replica through the existing named-query gateway. Nothing is copied into the app database except the small notification bookkeeping described below.

## 1. Tutor current status filter (Reviews tab)

- New "Tutor status" dropdown in the Reviews filters, options in this order: Working (0), Training (1), Resigned (2), Terminated (3), Blocked (4), Withdrawal (5), plus "All statuses".
- Filters on `tutors.status` (numeric code in iSchool). Applies to the table, summary numbers, charts and CSV export, same as the review-cycle filter.
- The table also shows a "Tutor status" column with the label instead of the raw number.

## 2. Remaining Quality tabs

Tabs become: Overview | Reviews | Session Details | Mentor Comments | Summary | Cycle Comparison.

**Session Details** — one row per reviewed session: tutor, team leader, lesson, session date, session type, tutor/student join times, tutor attendance status, student feedback comment, review score, flags (remarkable / needs coaching / needs immediate action + reason), objections count, QA status. Same filter bar as Reviews; click a row to open the existing review detail dialog.

**Mentor Comments** — toggle between two views:
- *Reviewer comments*: every written comment on reviews — per-criterion free-text (`quality_evaluations.comments`) and tagged positive/negative comments (`quality_review_comments` / `quality_comments`, type 0 = positive, 1 = negative). Filter by positive/negative, criterion, tutor, team leader, date range, cycle; searchable; CSV export.
- *By mentor*: reviews grouped by the tutor's mentor (`tutors.mentor_id` → admins/tutors): review count, average score, count of positive vs negative comments, most frequent negative comment; expand a mentor to see their tutors and comments.

**Summary** — dashboard for the selected filters: total reviews, average final score, % remarkable, % needs coaching, % needs immediate action, pending objections; average per main criterion (Teaching, Attitude, Curriculum, Preparation, Feedback, Setup); score distribution; top/bottom tutors; team-leader averages; top negative and positive comment tags.

## 3. Quality review notifications

The iSchool data is read-only, so new reviews are detected by an hourly check (24 runs/day), maximum delay about one hour.

- A scheduled job calls a new `check-new-quality-reviews` function every hour. It queries the replica for reviews with `submission_date` newer than the last checkpoint (stored in `app_settings`), then inserts app notifications.
- Recipients: the tutor's team leader (matched by name using the existing `find_team_leader_user_ids`) and all admins.
- Message: "New quality review for <tutor> — score 4.2/5" (adds "needs immediate action" when flagged).
- Link: `/performance?tab=quality&review=<id>` opens the Quality area on Session Details with that review's detail dialog open (same pattern as `?ticket=` for CS tickets).
- Uses the existing realtime notification channel and chime; the bell's mute toggle applies. A new notification type `quality_review_new`.

## 4. Cycle comparison tab

- Pick 2–4 review cycles (defaults to the latest three).
- Side-by-side table: rows = overall score + each main criterion (and expandable sub-criteria); columns = selected cycles; each cell shows average score and the change vs the previous selected cycle (green/red arrow).
- Line chart of overall score and per-criterion averages across all cycles (recharts, native).
- Optional filters: team leader, tutor, tutor status, session type — so a team leader can see their team's trend per cycle.
- CSV export of the comparison table.

## Technical details

Gateway (`supabase/functions/ischool-replica-query/queries.ts`):
- Add `tutor_status` as shared filter param 10 (`$10::int is null or t.status = $10::int`); list pagination moves to 11/12. Add `t.status as tutor_status` to list output.
- New named queries: `quality_session_details`, `quality_comments_list`, `quality_comments_by_mentor`, `quality_summary_kpis`, `quality_score_distribution`, `quality_comment_tags`, `quality_cycle_criteria_matrix`, `quality_cycle_trend`, `quality_reviews_since` (for the notifier, ordered by `submission_date`, capped).
- All queries keep the existing role checks, row caps and timeouts.

Frontend:
- `src/lib/tutorStatus.ts` — code→label map shared by filter, column and exports.
- `useQualityReviews.ts` gains `tutor_status`; new hooks `useQualitySessionDetails`, `useQualityComments`, `useQualitySummary`, `useQualityCycleComparison` built on `useReplicaQuery`.
- New components under `src/components/tracking/quality/`: `QualitySessionDetailsTab`, `QualityMentorCommentsTab`, `QualitySummaryTab`, `QualityCycleComparisonTab`; `QualitySection` wires the tabs and handles the `review` query param.
- `NotificationsBell`/`useNotifications`: treat `quality_review_new` like CS tickets for the chime.

Backend (app database):
- New edge function `check-new-quality-reviews` (service role, connects to replica with the same credentials/CA as the gateway); checkpoint stored in `app_settings` key `quality_reviews_last_checked`.
- Hourly `pg_cron` + `pg_net` job invoking the function (created with run_sql, not a migration).
