# Liquid Skyline reviews and background

## Goal
Turn the public testimonials into a premium stacked story-style experience and replace the visible grid treatment across the site with a living Skyline liquid-wave atmosphere.

## Reviews
- Show one testimonial or testimonial video at a time in a centered vertical stack, with the next cards visibly layered underneath.
- Place a large, low-contrast `SKYLINE ACHIEVERS` wordmark behind the cards, inspired by the supplied reference without embedding it.
- Keep the person, designation, rating, review text, and optional video readable inside the active card.
- Add a clear Next control, progress counter, and dots.
- Support upward finger swipe/drag on phones and pointer drag on desktop; the active card travels upward and reveals the next card.
- Loop naturally from the final review back to the first and preserve the existing review submission dialog.

## Liquid background
- Remove the square grid patterns from the landing page and shared dashboard surfaces.
- Add lightweight animated blue/cyan wave layers that continuously flow behind content, based on the supplied dark ribbon references.
- Add pointer/touch water ripples that briefly disturb the nearby wave field without blocking buttons or scrolling.
- Keep foreground content clear, maintain the existing Skyline palette and logo, and reduce/stop motion for reduced-motion users and slower phone conditions.

## Technical details
- Build a shared fixed canvas atmosphere with capped pixel density, paused rendering when hidden, and non-interactive layering behind the app.
- Use touch/pointer gesture thresholds and vertical intent detection so review swiping does not interfere with normal page scrolling.
- Use transforms and opacity for card transitions and stable card dimensions to prevent layout shifts.

## Validation
- Verify Next, swipe-up, video playback, review submission, card looping, touch scrolling, and no text clipping.
- Check the landing page and shared dashboard backgrounds on desktop and phone.
- Confirm reduced-motion behavior, no console errors, and a clean build.
