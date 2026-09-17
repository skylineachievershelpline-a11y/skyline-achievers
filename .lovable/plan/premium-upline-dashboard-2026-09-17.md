# Premium Upline Dashboard

## What will change
- Rebuild the member home screen around the attached dashboard reference: a compact welcome header, cover-backed profile panel, circular profile picture, and a structured tracking workspace.
- Keep Skyline Achievers’ existing navy, electric blue, cyan, white, and silver identity; use raised depth and a restrained glass layer over the cover.
- Show the member’s name and rank prominently. Hide the member ID by default with an eye control to reveal it.
- Remove joining date and last-login information from the dashboard. Keep joining date in My Profile beside the existing account/password settings.
- Add a camera control for each member to upload or replace their own dashboard cover image. With no cover, show a polished branded fallback.
- Recompose earnings and investment tracking into reference-style summary tiles, progress graphics, daily activity, report controls, and history while preserving every existing calculation and action.
- Keep training-only accounts locked exactly as they are now.

## Technical details
- Add an optional `dashboard_cover_path` to member profiles and store cover images in the existing private member image storage.
- Add authenticated cover upload/save functions scoped to the signed-in member, then return a temporary secure cover URL with dashboard data.
- Build a focused cover picker and responsive dashboard layout; preserve current avatar crop, leads, absence, PDF, share, training continuation, and daily inspiration behavior.
- Verify mobile and desktop layouts, image controls, hidden-ID behavior, and the current build.
