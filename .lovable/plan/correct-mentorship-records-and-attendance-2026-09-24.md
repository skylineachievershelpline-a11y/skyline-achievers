# Correct mentorship records and attendance

## Changes
- Replace working-report figures inside Personal Mentorship tree profiles with verified payment, required amount, remaining balance, due date, and payment history.
- Keep daily working reports unchanged for FBO profiles only.
- Treat an upline-approved website or WhatsApp review as session attendance, even when no video-open timestamp exists.
- Apply the corrected attendance status to the journey record and senior shared report.
- Verify the phone view and preview health.

## Technical details
- Extend the existing team-tree response with the member's payment fields and verified ledger rows; no new table or duplicate account flow.
- Derive attendance from `review === "approved" || openedAt`, while retaining actual timing categories when an open timestamp exists.
