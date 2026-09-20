# Admin Open Dashboard

## What will change
- Add an **Open Dashboard** action beside every member in the Admin Members list.
- Open a secure admin-only preview of that selected member’s dashboard without asking for their Member ID or password.
- Clearly label preview mode and provide a one-tap return to the Admin Panel.
- Keep the member’s real account session untouched; admin preview will be read-only for member-owned controls.

## Technical details
- Add a dedicated dynamic dashboard-preview route using the member account UUID.
- Load profile, rank, avatar, bio, activity, and dashboard tracking only after validating the existing admin session on the server.
- Reuse the established Skyline dashboard styling without impersonating or signing in as the member.
- Add route-specific private metadata and prevent indexing.
- Verify permissions, build health, and phone layout.
