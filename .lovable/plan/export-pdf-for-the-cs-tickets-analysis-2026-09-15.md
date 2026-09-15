# Export PDF for the CS Tickets analysis

Add an "Export PDF" button next to the existing CSV exports on the Analytics > CS Tickets tab. It produces a clean, printable report of exactly what is on screen: the filters applied, the headline numbers, the charts, and the summary tables.

## What the PDF contains

1. Header: "CS Tickets Analysis", the iSchool wordmark/colours, generation date, and the active filter summary (date range, team leader, case type, status, category, tutor search) plus "Showing X of Y tickets".
2. Headline numbers: total tickets, Valid / Not Valid / Not a Complain / Pending with their shares, validity rate, pending overdue, average closing time.
3. Charts, captured from the page as images and placed full width: trend over time, status split, tickets by team leader, case type, top categories, top tutors, mentor workload.
4. Tables: team leader summary and tutor summary, paginated automatically with repeated headers.
5. Footer on every page: page number and "© 2026 iSchool – All rights reserved".

File name: `cs-tickets-analysis_<from>_<to>.pdf` (or `all-time` when no range is set).

## Behaviour

- Button sits with the existing export buttons, disabled while data is loading or when no tickets match the filters.
- Shows a spinner while the PDF renders, then downloads.
- Charts are captured from the live rendered tab, so the PDF always matches the current filters.

## Technical notes

- Uses `jspdf` + `jspdf-autotable`, already in the project.
- Chart capture: wrap each chart card in a ref and serialise its `<svg>` (recharts renders SVG) to a PNG via an offscreen canvas — no new dependency needed, avoids adding html2canvas.
- New file `src/utils/exportCsTicketsToPdf.ts` holding the document build; `CsTicketsAnalyticsTab.tsx` gains refs, the button, and passes the already-computed KPI/table data.
- A4 landscape for table readability; no database or backend changes.
