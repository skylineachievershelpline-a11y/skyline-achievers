# Complete dashboard, training, account, and Skyline AI update

## What will change

### Resources and training
- Restore **Files & Resources** to the earlier simple list: no category tiles or category-first browsing.
- Keep direct opening for pictures, videos, PDFs, audio, links, books, presentations, and notes.
- Fix Training so every published admin-created category, including an empty **Sales** category, appears instead of being hidden inside “More sections.”
- Preserve rank restrictions: a member only sees categories and videos allowed for their own level.

### Dashboard and landing fixes
- Keep the daily report form, chart, download controls, and report rows collapsed by default behind one clear **Show report** button; closing it returns the dashboard to its compact state.
- Fit the full 12-digit Member ID on one line when revealed, and keep the complete rank name on one line using smaller responsive text where needed.
- Correct desktop testimony video framing so portrait and landscape videos are centered and fully visible without being pushed to one side or cropped.

### Beginners Training account login
- New Beginners Training accounts will use the person’s normalized mobile number as the visible login ID and `00000000` as the initial password.
- The login form will accept existing Skyline IDs and Beginners mobile numbers, so existing accounts remain usable.
- Phone normalization and duplicate checks will prevent two accounts from receiving the same mobile login.

### Upline password reset
- Add **Reset password** to each person’s row in Team Tree.
- The action will require confirmation, then reset that direct trainee’s password to `00000000`.
- Ownership will be checked on the server: an upline can reset only a person directly registered under their account, never another team or a member/admin account.

### Skyline Achievers AI
- Add **Skyline Achievers AI** to both member and Beginners sidebars and as a visible dashboard shortcut.
- Use separate conversation threads with a new-chat action, stable thread URLs, thread switching, deletion, and account-saved history available on every device.
- Stream replies and show the user message immediately while the assistant responds.
- Answer in the same language/style the person uses.
- Limit answers to Skyline Achievers website usage and content that the signed-in person can currently access.
- Build server-side identity context for each request: Beginners receives Beginners guidance; members receive only their current-level and unlocked-area guidance.
- Refuse unrelated questions, higher-level/private content, admin-panel details, credentials, passwords, codes, member IDs, phone numbers, or another person’s data.
- Do not send sensitive profile fields to the AI model; only send a minimal role/access summary plus the conversation.
- Use the existing private account session for every AI request and save only that account’s threads/messages.

## Technical details
- Add authenticated `ai_threads` and `ai_messages` tables with explicit grants, row-level policies scoped to `auth.uid()`, timestamps, and cascading cleanup.
- Add `/ai` and `/ai/$threadId` pages plus an authenticated streaming `/api/ai-chat` handler.
- Compose the chat with installed AI Elements primitives for conversation, messages, prompt input, reasoning/loading, and controls.
- Use Lovable AI with `openai/gpt-6-astra` through the streaming Responses API, full thread history, reasoning enabled, and safe gateway error messages.
- Save the completed assistant message only after streaming finishes; verify every requested thread belongs to the caller before reading or writing.
- Add server-side phone-login resolution and upline reset functions without exposing internal auth addresses.
- Update the existing navigation and dashboard controls without changing Skyline branding or the current visual system.

## Verification
- Check Resources as a direct flat list and open each supported item type.
- Confirm a newly published empty Sales training category is visible, then add a section/video and open it.
- Verify report details remain hidden until **Show report** is pressed.
- Verify the full ID and long rank names at phone and desktop widths.
- Verify testimony videos at phone and laptop widths.
- Create/login a Beginners account with mobile number + `00000000`, then reset it from its own upline and sign in again.
- Create two AI threads, send messages in both, reload each thread URL, and confirm histories stay separate and persist.
- Test AI refusals for unrelated questions, admin details, credentials, higher-rank content, and another person’s data.
