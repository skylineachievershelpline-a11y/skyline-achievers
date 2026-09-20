# Editable Member Name and Copyable ID

## Changes
- Add a secure profile action for signed-in members to update their own display name.
- Add a name editor to My Profile beside the existing bio and password controls.
- Add a one-tap Copy ID control with confirmation feedback.
- Use the website’s original display font for the member name on the dashboard.
- Refresh dashboard and profile data immediately after saving.

## Technical details
- Validate the name length on the server and update only the authenticated member’s profile.
- Reuse the existing button, input, toast, and query refresh patterns.
- Keep the member ID read-only; only copying is added.
