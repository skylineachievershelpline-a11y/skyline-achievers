# Keep popups in the visible screen

## Changes
- Render the notification permission popup above the page and center it in the current phone viewport.
- Render the Preferred Customer journey popup the same way, while keeping its long content internally scrollable.
- Prevent the page behind either popup from affecting its position.
- Verify both experiences at phone size and check the preview for errors.

## Technical details
- Use a body-level portal so transformed or animated parent layers cannot reposition fixed overlays.
- Use dynamic viewport height and safe-area spacing for mobile browser controls.
