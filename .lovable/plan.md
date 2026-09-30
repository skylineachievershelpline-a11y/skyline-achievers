# Rebuild Skyline Growth Executive from the latest specification

## Goal
Replace the mixed old Job Assistant/Growth Executive implementation with one complete **Skyline Growth Executive** system inside every eligible FBO dashboard. The old assistant, lead, activity, access, and commission records will be permanently deleted as selected; unrelated member, trainee, training, payment, and biometric data will remain untouched.

## What will be built

### 1. One clean product and one settings source
- Remove the duplicated old Job Assistant settings, labels, calculations, and admin controls.
- Keep one English product name everywhere: **Skyline Growth Executive**.
- Keep the feature inside the FBO dashboard/sidebar, available to Assistant Supervisor and higher.
- Preserve the existing branded payment-account wallet cards, copy-number, QR, screenshot upload, paid unlock, and admin approval flow.
- Add configurable unlock fee, service fees, assistant limit, minimum daily workload, commission rules, payout windows, and effective dates in one admin settings area.

### 2. Growth Executive application and secure account
- FBO generates a private application link.
- English application form: full name, active phone, active email, CNIC, CNIC front image, profile picture, experience, qualification, city, and payout details.
- Admin verifies, approves, rejects, or requests correction.
- Approval creates a separate 12-digit Growth Executive ID starting with `22` and default password `00000000`, then sends the account details by available notification/email channels.
- Prevent duplicate phone, email, or CNIC use and enforce one Growth Executive under one FBO.
- Pausing/removing immediately blocks access while preserving history.

### 3. Dedicated mobile Growth Executive dashboard
- Secure ID/phone + password login, profile and fixed FBO ownership.
- English navigation: Home, Today’s Leads, Follow-ups, Beginners Training, Seats, Preferred Customers, Reels, Training, Resources, Earnings, Withdrawals, and Profile.
- Calling Executive permissions stop at verified Rs. 249 enrollment; Full Funnel Executive continues through training and 2CC.
- Reels remain view-only; training/resources are admin-managed.
- Daily minimum is 10 assigned leads, with visible tasks, activity timestamps, current tier, next target, motivation, and performance.

### 4. Lead intake, validation, distribution, and ownership
- Excel/CSV upload with Pakistani phone normalization, duplicate detection, invalid-row correction, and safe import preview.
- Equal distribution only in complete 10-lead batches; leftovers remain unassigned. Custom distribution can allocate 10, 20, or more.
- Golden rule: every lead/result permanently stores both Growth Executive ownership and FBO ownership.
- Direct Call and WhatsApp actions, follow-up scheduling, outcome history, and timestamps.
- Edited lead data shows original and edited values to the FBO; attribution never changes.
- Reassignment preserves the previous executive’s work and commission attribution.
- Generate a shareable/downloadable lead detail picture individually or in a batch.

### 5. Correct commission engine
- **Enrollment commission per separate 10-lead batch:** 1 enrollment = Rs. 50; 2 = Rs. 70 each; 3 = Rs. 90 each; 4 = Rs. 120 each; every next enrollment adds Rs. 30 per enrollment, capped at Rs. 200 each.
- **2CC commission per PKT 10-day cycle:** days 1–10, 11–20, and 21–month end. 1 completed 2CC = Rs. 3,000; 2 = Rs. 5,000 each; 3 = Rs. 7,000 each; each next level adds Rs. 2,000 per 2CC.
- 2CC conversion is calculated from eligible enrolled people, never total leads.
- Self-reported results do not become payable. Pipeline: Reported → Data Check → Verified/Rejected → Eligible → Ledger → Payable → Paid, with adjustments and audit history.
- FBO personal results and Growth Executive results never mix.

### 6. FBO settlements, service fees, and withdrawals
- Enrollment payouts on the 1st and 15th; FBO receives the payable summary one day before.
- 2CC settlement payment window runs from the 5th through 10th.
- Add Skyline service fees: Rs. 10 per verified enrollment and Rs. 500 per verified 2CC, admin-changeable with effective dates.
- FBO sees commission + Skyline fee, pays through the existing wallet cards, uploads proof, and waits for admin verification.
- After funding is approved, eligible Growth Executives can request withdrawal; admin marks payable and paid with payment reference.
- Growth Executive Earnings shows enrollment, 2CC, pending, verified, payable, paid, adjustments, withdrawn, and total.

### 7. FBO and admin reporting
- FBO dashboard: executives, application status, lead inventory/distribution, activity, daily performance, commissions, service fees, settlements, and withdrawals.
- Admin: all applications, accounts, FBO ownership, leads, verification queue, settings, settlements, withdrawals, access requests, and audit trail.
- Filters: Today, Yesterday, Week, Month, Custom, Personal, Growth Executives, Specific Executive, Calling, and Full Funnel.
- Export filtered reports to Excel/CSV/PDF.

## Data transition
- Permanently delete existing records only from the old Job Assistant/Growth Executive tables and associated proof files where safely identifiable.
- Add the new schema additively, lock it with server-side access checks, grants, and row-level protection, then switch all screens to the new system.
- Retire old settings and old code paths so no legacy calculation or UI remains active.

## Verification
- Test with separate FBO, Calling Executive, Full Funnel Executive, and admin accounts.
- Verify unlock payment upload, application approval, `22` ID login, 10-lead batching, custom distribution, call/WhatsApp, editing audit, role limits, enrollment and 2CC calculations, verification pipeline, FBO settlement, withdrawal, exports, phone layout, and strict cross-FBO isolation.
- Confirm existing member login, biometric device registration, training, payments, and admin functions still work.

## Technical details
- Use one server-side calculation engine and one effective-dated settings record.
- All assistant/lead/commission data remains service-controlled; browser requests never decide ownership, verification, or money.
- Monetary ledger entries are append-only; corrections use adjustment entries instead of rewriting history.
- Database cleanup is limited to the old assistant module and will not delete unrelated account or training data.
