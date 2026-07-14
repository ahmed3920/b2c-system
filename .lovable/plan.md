# Tutor Segmentation Module — Plan

A new page `/tutor-segmentation` that classifies every tutor into **Elite / Growth / At Risk** based on a weighted Tutor Health Score, with a dashboard, filterable table, per‑tutor drill‑down, and an automated recommendations engine.

This is a sizeable module — I'll build it in phases so we can validate scoring against real data before layering UI polish. Please confirm the scope below (or trim it) before I start coding.

---

## Phase 1 — Data model & scoring engine

New tables (all admin/TL readable, service_role writeable):

- `tutor_segmentation_scores` — one row per tutor per snapshot
  - tutor_external_id, tutor_name, team_leader, language, snapshot_date
  - metric scores 0–100: quality, planned_leaves, emergency_leaves, live_issues, cs_tickets, communication, tl_feedback, engagement, parent_handling, culture_fit
  - health_score (weighted), segment (`elite|growth|at_risk`), trend (`up|flat|down`), confidence (`high|medium|low`), hard_stop_reason (nullable)
- `tutor_manual_ratings` — monthly TL inputs for the metrics that can't be computed automatically: communication, tl_feedback, parent_handling, culture_fit (1–5 scale, stored as period + score + note)
- `tutor_segmentation_recommendations` — auto‑generated action items linked to a tutor + rule id + severity + status

Scoring worker: a Supabase edge function `compute-tutor-segmentation` that

1. Pulls the latest signals from existing tables:
   - Quality → `quality_uploads`
   - Planned/emergency leaves → `tutor_leaves` (last 90 days, weighted by recency)
   - Live issues → `live_session_issues` (last 90 days)
   - CS tickets → `cs_tickets` where `mentor_validation = 'valid'`
   - Engagement → `engagement_uploads`
2. Pulls manual ratings from `tutor_manual_ratings` (latest period per tutor).
3. Applies **recency weighting** (last 30 days ×1.0, 31–60 ×0.6, 61–90 ×0.3).
4. Computes weighted health score using the weights from the spec (Quality 30, Leaves 10, Live Issues 10, CS 10, Communication 10, TL Feedback 10, Engagement 10, Parent 5, Culture 5).
5. Applies **hard‑stop rules** (e.g. 2+ valid CS tickets in 30d, 3+ emergency leaves in 30d, repeated no‑shows) → forces `at_risk` with a reason.
6. Applies **confidence rule**: <3 sessions or <2 evaluations in window → `low` confidence.
7. Computes **trend** by diffing against the previous snapshot's score.
8. Writes a new row into `tutor_segmentation_scores`, replacing "current" via a `snapshot_date = today` upsert.
9. Runs the **recommendations engine** rules from the spec and upserts into `tutor_segmentation_recommendations`.

Trigger: manual "Recompute" button (admin) + scheduled daily cron via `pg_cron` calling the function.

## Phase 2 — Dashboard page

Route: `/tutor-segmentation`, added to sidebar under **Growth & Risk** for admins + team leaders (feature‑flagged via `feature_controls`).

Top of page:
- 5 summary cards: Total Tutors, Elite, Growth, At Risk, Avg Health Score.
- Pie chart of segment distribution (recharts).
- Bar chart of average metric scores across selected filter set.
- Filters bar: Team Leader, Language, Grade Level, Date Range, Segment, Trend.

Tutor table:

| Tutor ID | Name | TL | Health | Segment | Trend | Quality | Leaves | Live Issues | CS | Engagement | Parent | Confidence | Next Action | Updated |

- Sortable + filterable on every column, color‑coded segment badges (green / blue / orange), trend arrows (📈 ➡️ 📉), a "Low Confidence" chip when applicable.
- Row click → tutor profile drawer.
- Export to Excel via existing `exportTasksToExcel`‑style helper.

## Phase 3 — Tutor profile drawer

Opened from the table. Shows:
- Header: name, TL, current segment, health score, trend, confidence.
- Metric breakdown (radial or horizontal bars with 0–100 per metric + weight).
- Score history line chart (last 12 snapshots).
- Strengths / Weaknesses auto‑derived from top and bottom 3 metrics.
- Coaching recommendations from `tutor_segmentation_recommendations` with status (open / in‑progress / resolved).
- Action history (link to related action plans, CS tickets, incidents).
- Manual rating panel (admin/TL only) to enter/update Communication, TL Feedback, Parent Handling, Culture Fit for the current month.

## Phase 4 — Recommendations engine rules

Implemented in the edge function; each rule writes a recommendation with severity + suggested next action surfaced in the "Next Action" column:

- Emergency leaves +50% MoM → **Schedule coaching**.
- Quality < 85 for 2 consecutive evaluations → **Create action plan** (deep‑link into Action Plans).
- 3+ valid CS tickets in 60 days → **Flag for TL review**.
- Engagement < 70% → **Observe a live session**.
- Communication score below threshold → **Communication training**.
- Elite for 3 consecutive snapshots → **Eligible for mentoring / bonus**.

## Access & security

- Admin: full read/write, can recompute, can edit manual ratings for anyone.
- Team leader / super_team_leader: read segmentation for their team, edit manual ratings for their tutors only, see all recommendations for their team.
- Mentor / community_moderator: no access (feature hidden).
- RLS on the three new tables scopes reads by team via existing `team_leader_name_matches` helper.

## Deferred / open questions

- Manual ratings UI (Phase 3) is the biggest source of new admin work — do you want a bulk monthly rating page, or only per‑tutor entry from the profile drawer?
- "Grade Level" and "Track" filters — we don't currently store these on tutor records; I can either add optional columns to `tutor_roster_overrides` or drop those two filters.
- For the hard‑stop "repeated no‑shows" rule, do you want to reuse `session_incidents` with a specific category, or add a new category?

If this scope looks right, reply "go" (or with edits) and I'll start with Phase 1 (migration + scoring edge function) so we can validate the numbers before I build the UI.
