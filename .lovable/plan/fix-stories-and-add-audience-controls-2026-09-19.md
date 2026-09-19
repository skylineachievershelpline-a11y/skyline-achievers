# Fix stories and add audience controls

## What will change
- Fix active story loading so published stories reliably appear on both dashboards.
- Add an audience selector for Beginners Training, individual ranks, or everyone.
- Add an audio story type with the existing voice recorder and in-story audio playback.
- Replace the circular logo ring with a clear **Watch Story** tag beside the Skyline logo.

## Technical details
- Extend story records with an audience type and optional rank reference, including safe database grants and validation.
- Filter stories server-side for the signed-in member or Beginners Training account while retaining a safe public fallback where applicable.
- Update the admin story composer, story list labels, dashboard entry points, and viewer media handling.
- Validate the phone layout, story opening flow, and current build.
