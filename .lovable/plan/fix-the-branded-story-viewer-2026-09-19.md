# Fix the branded story viewer

## What will change
- Render the story viewer above the whole app so dashboard motion and containers cannot crop it.
- Open it as a premium panel that floats down from the top, matching the shared reference.
- Add a clear Skyline Achievers branded header with the official logo, story label, progress bars, and close control.
- Keep text, picture, video, and voice stories visible for their correct duration, with reliable next/previous controls.

## Technical details
- Move the full-screen viewer into a document-level portal.
- Add a dedicated top-entry animation and stable mobile viewport sizing with safe-area spacing.
- Prevent invisible tap layers from covering media controls.
- Verify story display and phone layout, then confirm the build remains healthy.
