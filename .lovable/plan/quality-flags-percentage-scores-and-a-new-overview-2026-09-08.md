# Quality: flags, percentage scores, and a new Overview

## 1. Flag type (Red / Yellow)

Each review can carry flags stored separately from the review itself, each with a type number: **1 = Yellow, 2 = Red**. A review can have more than one flag.

- Every review gets a yellow-flag count, a red-flag count, and an overall flag label:
  - **Red** if it has at least one red flag
  - **Yellow** if it only has yellow flags
  - **None** otherwise
- The Reviews table gets a Flag column with a coloured badge (red / yellow / none) showing counts, e.g. "Red 1 · Yellow 2".
- Flag info is included in the CSV export and shown in the review detail dialog (type, criterion, description).

## 2. Flag filter

A new **Flag** dropdown in the shared filter bar with: Any, Red, Yellow, Any flag, No flags. It applies to all Quality tabs (Reviews, Session Details, Mentor Comments, Summary), behaves like the other filters, and participates in the dependent-dropdown logic so the other lists narrow accordingly.

## 3. Score in percentage

- Percentage = score ÷ 5 × 100, rounded to one decimal.
- Reviews table: a new **Score %** column next to the score.
- Reviews cards: the "Average score" card also shows the overall percentage, and a total percentage is displayed for the filtered set.
- Percentage is added to the CSV export.

## 4. Replace the Overview tab

The current Overview shows the older uploaded/manual quality scores. It will be replaced by an overview built on the live quality system, using the same filter bar as the other tabs:

- KPI row: total reviews, average score (with %), red-flagged reviews, yellow-flagged reviews, immediate action, needs coaching, remarkable sessions, tutors reviewed.
- Average score by main category (Teaching, Attitude, Curriculum, Preparation, Feedback, Setup).
- Score distribution chart.
- Average score by team leader.
- Flag breakdown (red vs yellow) by team leader.
- Lowest scoring tutors, with their flag counts.

The old manual/uploaded quality view stays available where it already lives on the Tracking Numbers page; only the Quality Overview tab here changes.

## Technical notes

- `supabase/functions/ischool-replica-query/queries.ts`:
  - Add a flag aggregate subquery over `quality_review_flags` (excluding soft-deleted rows) exposing `red_flags`, `yellow_flags`, `flag_level`.
  - Add a `flag` param to `QUALITY_PARAMS` / `QUALITY_CLAUSES` (values: `red`, `yellow`, `any`, `none`), shifting the existing positional placeholders.
  - Add `quality_flag_breakdown` (counts by team leader / flag type) and extend `quality_reviews_count` with red/yellow counts and average percentage.
  - Redeploy the function.
- `src/hooks/useQualityReviews.ts`: add `flag` filter state, flag fields on the row type, and flag counts on the summary type.
- `src/lib/qualityFlags.ts`: shared flag code → label/colour mapping and the percentage helper.
- `QualityFilterBar.tsx`: Flag dropdown.
- `QualityReviewsTab.tsx`: Flag and Score % columns, percentage in the cards, export fields.
- New `QualityOverviewTab.tsx` replacing `QualityTab` inside `QualitySection.tsx` (recharts used directly).
- Verification: confirm the real distribution of `flag_type` values in the replica before shipping the labels; if the data contradicts 1 = Yellow / 2 = Red, flag it rather than silently relabelling.
