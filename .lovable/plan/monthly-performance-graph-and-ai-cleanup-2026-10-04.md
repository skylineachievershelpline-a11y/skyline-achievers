# Monthly performance graph and AI cleanup

## What will change
- Remove the “Call Skyline AI” button from the FBO dashboard while keeping the existing Training Room teacher call available.
- Remove Website Guide / Website Tour from Skyline AI and stop its dashboard-wide overlay; normal private AI chat remains unchanged.
- Replace day-range graph controls with calendar-month selection. The current month opens by default, earlier available months can be selected, and each month uses only real Daily Report records.
- Present a simple reference-inspired monthly area graph with clear daily activity, working-day and report totals.
- Make Daily Report downloads monthly instead of last-7/30/90/custom ranges.
- Keep the same monthly graph inside the full Daily Report PDF and add a separate graph-only PDF for the selected month.

## Technical details
- Keep the existing 366-day report history and shared performance calculation so no records are changed or deleted.
- Reuse the selected month boundaries for the on-screen graph, report rows, full PDF, and graph-only PDF.
- Preserve member permissions, Daily Report submission, sharing, report history, and admin reports.
- Verify build health and the signed-out/public app; authenticated graph verification may require an available member session.
