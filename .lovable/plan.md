# Complete build list — Skyline Achievers

## A. Review flow (upline + trainee)
1. "Action Required" list: remove the "View" button — only trainees with a submitted review appear, with "Review now".
2. Trainee journey record: every session has a "Show review" button (hidden by default). Opens text, all pictures, or the voice note player. Approve / Reject right there.
3. Reject reason box is optional — reject works with one click.
4. When a trainee submits a review: alert card at the top of the upline dashboard + phone notification even when the app is closed ("Name ne Session 01 ka review bhej diya hai").
5. Session rules after submitting:
   - Session stays open for the full 3-hour window after submitting.
   - After 3 hours with the review still pending: video closes, shows "Review pending — your upline is checking it".
   - Rejected: message "Aap ka review reject ho gaya hai. Kal aap ne yehi session dobara dekhna hai, ya upline se rabta kar ke recorded session dekh sakte hain." Session rolls to the next day.
   - Approved: that session stays open permanently.

## B. Journey opens at the top
6. Clicking "Journey" on a person opens a full-screen panel from the top (not a half-hidden drawer at the bottom).

## C. Settings in the side menu
7. Replace the standalone Logout with a "Settings" option.
8. Settings shows: current profile (name, ID, rank pin), Switch account (saved accounts on this device, one tap), Add account (registered ID + password), Log out.

## D. Opens like a real app
9. Signed-in members opening the app go straight to their Dashboard (Beginners Training for trainees) — no landing page.
10. Landing page only for new visitors or after Log out.

## E. Offline mode
11. Saved copies of dashboard, team tree, sessions status, announcements and reports so the app opens and shows them without internet.
12. "Offline — viewing saved data" banner; videos, uploads and new reviews show "Internet connection zaroori hai".

## F. Separate Admin app
13. Separate installable "Skyline Admin" app with its own icon and name, opening directly at the Admin panel behind the secret passcode.
14. Admin notifications (payment proofs, new members, approval requests) go only to devices signed into the Admin app, separate from the personal member app — so both can be installed and signed in on one phone.

## Technical details
- Review: `UplineActionQueue` filter to `pendingReviewSession`; `TraineeProgressRecord` collapsible review blocks with signed image/voice URLs; `reviewSessionSubmission` reason optional; push to upline in `submitSessionReview`; open-window logic in `journey.ts` keyed on scheduled_at + 3h rather than review status; rejected → `rollMissedSessions` next day.
- Journey panel: `items-start` full-height dialog.
- Accounts: device-stored account list (ID + session tokens only, no passwords stored in plain text) in `MemberShell` settings sheet.
- Launch: root/index checks stored session and redirects before landing renders.
- Offline: service worker caches app shell + assets; TanStack Query cache persisted to local storage; online/offline banner.
- Admin app: `/admin-manifest.webmanifest` with `start_url: /admin`, separate icons, admin push subscriptions stored with an `admin` audience flag and sent from admin events.
