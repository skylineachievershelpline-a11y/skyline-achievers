# Training reviews, team tree and daily report upgrade

Six connected changes across the trainee side, the upline side and the admin panel.

## 1. Review submit option comes back on Beginners Sessions

Right now the review box only appears in one narrow case: the trainee must open the
current session video from the journey card, and only while that exact session is open.
If they open a session from the sessions list, or come back after the video, no review
box is visible.

Fix: show the review box for the open session in three places —
- below the video after watching (as today),
- directly under each unlocked session in the seven-session list,
- in the "What do I do now" card when a review is the pending action.

The rule stays the same: one review per session, inside the 3-hour window, text +
picture + voice, and it disappears once the review is pending or approved.

## 2. Review requests on the upline dashboard

A new "Requests" panel at the top of the upline dashboard listing every trainee whose
review is waiting, newest first. Each row shows the trainee name, day/session, the
submitted text, picture and voice note, and Approve / Reject buttons with a note and
voice-reply box — the same decision logic already used inside the journey dialog, just
surfaced on the dashboard so nothing is missed. Final interview requests appear in the
same panel.

## 3. Team tree opens full screen

The FBO / Personal Mentorship tree gets a full-screen mode: an expand button opens the
chart edge to edge with pinch/scroll panning, and a close button returns to the page.
Person cards and the tap-to-open report card stay exactly as they are.

## 4. Personal Mentorship has no working report

A Personal Mentorship member cannot do business work before becoming Assistant
Supervisor, so:
- the daily working report, its reminders and its report cards are hidden for
  Personal Mentorship accounts (rank 1) and the account is never auto-blocked for
  missed reports at that rank,
- the admin panel loses the "working / training only" switch completely — rank alone
  decides what a member can do.

## 5. Preferred customer Journey becomes a progress record

Opening Journey from the Preferred customer tree no longer shows session scheduling.
Instead it shows one read-only progress record for that person:
- every session with its scheduled time, the time the person actually opened it, the
  time the review was submitted, whether it was on time or late, and the upline
  decision with notes,
- final interview result and Personal Mentorship / 2CC status,
- the complete review history (text, picture, voice) kept permanently.

A "Generate report link" button creates a private link the upline can send to a senior.
Opening the link shows the same read-only record with clear timings. Links can be
revoked. Session timings are still set from Seat Reservation and the master schedule —
that is unchanged.

## 6. Daily report marks Absent and Leave

Every report the upline pulls for a team member now covers every calendar day:
- a submitted day shows its numbers,
- a missed day shows **Absent** in red,
- a day inside an approved leave shows **Leave** in blue.

This applies to the team member report card, the upline report section and the admin
report export, so all three read the same day list.

## Technical notes

- New table for shared progress report links (token, trainee, created by, revoked) with
  row-level security; a public route renders the record for a valid token only.
- `trainee_session_reviews` gains opened-at / submitted-at timing columns; existing rows
  keep their created-at time as the submitted time.
- The day-by-day Absent/Leave list is built once in a shared helper on the server and
  reused by member, upline and admin report views.
- `member_profiles.working_enabled` is marked deprecated and stops being read; rank
  order drives report visibility.
