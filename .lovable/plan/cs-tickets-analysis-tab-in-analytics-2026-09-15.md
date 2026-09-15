# CS Tickets analysis tab in Analytics

Add a fourth tab, "CS Tickets", to the Analytics page with a full breakdown of complaint tickets and a date-range filter.

## Filters (top bar)
- Date range on ticket date (from / to), with quick presets: last 7 days, last 30 days, this month, all time.
- Team leader (searchable), case type (CS / Edu / System), status, category, tutor search.
- All charts and numbers react to the filters.

## Headline numbers
- Total tickets in range
- Valid / Not Valid / Not a Complain / Pending counts, each with its share of the total
- Validity rate (Valid out of all decided tickets)
- Still pending and how many are past their response deadline
- Average days from ticket creation to closing

## Charts
- Tickets over time (daily or weekly line, switchable)
- Status split (donut)
- Tickets by team leader (bar, stacked by status)
- Top categories (horizontal bar, split by CS vs Edu category)
- Case type split (CS / Edu / System)
- Top 15 tutors by ticket count, and separately by valid tickets only
- Mentor evaluation workload: tickets per assigned mentor with validation outcome

## Tables
- Team leader summary: total, valid, not valid, not a complain, pending, validity %, average closing days
- Tutor summary: total, valid, categories touched
- Both sortable, each with CSV export

## Technical notes
- New tab in `src/pages/Analytics.tsx` -> `src/components/analytics/CsTicketsAnalyticsTab.tsx`.
- Data comes from our own `cs_tickets` table (not the iSchool replica), read through a new `src/hooks/useCsTicketAnalytics.ts` that pages past the 1000-row limit like `useCSTickets` does, then aggregates client-side with `useMemo`. No database or edge function changes.
- Charts use native `recharts`; CSV via `downloadCsv` from `@/lib/exportCsv`.
- Legacy statuses (`Validated` / `Rejected`) are folded into Valid / Not Valid for the analysis.
- Analytics stays admin-only, so existing ticket access rules are unchanged.
