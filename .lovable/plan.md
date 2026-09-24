# Senior report, daily history and install polish

## What will change

1. **Scored seven-session progress report**
   - Add marks to every session review, assigned by the upline while approving it.
   - Split the full journey into **100 marks**: Sessions 1–2 allow 15 marks each, Sessions 3–7 allow 14 marks each.
   - Show each session’s marks, attendance timing, review timing, approval note, text, all pictures and voice recording.
   - Calculate a clear overall performance label from the total score and timing record, so a senior can quickly understand the person’s category.
   - Keep old approved reviews visible and let the upline add their marks without losing any history.

2. **Complete FBO daily report dates**
   - Use the existing calendar-day result instead of only saved report rows.
   - Every selected date will show one of: submitted figures, **Absent**, or approved **Leave**.
   - Use the same rows for the on-screen table, PDF, share file and printed slip.

3. **Stable app background**
   - Repair the animated background when the app returns from the background by resizing and drawing it again on resume, orientation change and page restore.
   - Prevent duplicate animation frames after repeated app switches.

4. **Premium hanging install tag**
   - Remove the large install section lower on the landing page.
   - Attach a compact, premium hanging tag beside the Skyline logo with a natural cord, metal eyelet and gentle swing.
   - Tapping the tag starts the native install prompt when the phone supports it.
   - If the phone/browser cannot open that prompt, show the correct short instructions for iPhone or Android instead of a confusing browser message.
   - Keep the normal website landing page and the installed app’s direct login/dashboard behavior unchanged.

## Technical details

- Add a nullable, range-checked review score column through a database migration; no existing review content is removed.
- Extend review approval and WhatsApp approval with score validation based on each session’s maximum.
- Keep report links private and revocable; only signed, time-limited review media URLs are returned.
- Reuse the existing manifest and install-prompt capture; no second app-shell worker is introduced.
- Verify the public report, daily report range, landing tag/fallback and app-resume behavior on phone and desktop widths.