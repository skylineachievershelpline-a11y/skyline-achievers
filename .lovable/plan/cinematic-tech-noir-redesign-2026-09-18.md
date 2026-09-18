# Cinematic tech-noir redesign

## Goal
Transform Skyline Achievers into a coordinated, premium animated digital experience while preserving the official logo, all current content, routes, permissions, forms, uploads, and business behavior.

## Visual system
- Build the selected cinematic tech-noir direction around near-black and midnight navy surfaces, electric royal blue, cyan light, white type, and metallic silver edges.
- Keep the supplied Skyline Achievers logo untouched and use the full brand name with `LEARN • EARN • LEAD`.
- Replace generic static surfaces with restrained depth, directional light, precision borders, connected backgrounds, and strong whitespace.
- Keep all colors inside the approved brand palette; no purple, red, orange, yellow, green, or decorative multicolor effects.

## Motion system
- Add reusable viewport-triggered reveals for headings, supporting copy, cards, lists, and media with deliberate staggered timing.
- Add lightweight scroll progress, parallax layers, navigation compression, and section-to-section background continuity using transform and opacity only.
- Add premium button press, card lift, moving-edge highlight, media-play, drawer, dialog, and tab transitions.
- Animate relevant statistics with a restrained count-up treatment.
- Reduce or disable parallax, continuous lighting, and stagger complexity on smaller screens and for reduced-motion users.

## Landing experience
- Recompose the opening screen into the selected tech-noir layout with a choreographed brand/tagline, line-by-line headline reveal, delayed copy and calls to action, subtle atmosphere, and an animated scroll cue.
- Preserve login, install, introduction video, reviews, WhatsApp, and hidden admin entrance behavior.
- Connect the introduction, story, install, and reviews sections through shared light rails and scroll reveals rather than isolated blocks.
- Make the navigation smoothly compact and increase opacity as the page scrolls; keep the mobile drawer polished and accessible.

## Member and admin experience
- Apply the same motion language to the member shell, dashboard, training, resources, team, messages, profile, Beginners Training, and admin workspace.
- Animate page headings, summary values, lists, tabs, and cards on entry without delaying core actions or data access.
- Preserve the dense compact hierarchy tables and all current controls; improve only their depth, state transitions, and entrance choreography.

## Technical details
- Use React hooks plus CSS Intersection Observer-driven classes; avoid a heavy animation dependency.
- Centralize cinematic tokens, keyframes, motion utilities, and responsive/reduced-motion rules in the existing design system.
- Add shared reveal and animated-number primitives, then integrate them into representative reusable shells and landing sections so routes inherit consistent behavior.
- Keep animations composited and avoid layout-triggering loops, large particle engines, or constant movement across the whole page.

## Validation
- Verify landing, member dashboard, training, team, Beginners Training, and admin screens at desktop and phone sizes.
- Check menu, login, install, dialogs, tabs, video, and primary actions remain usable.
- Confirm no overflow, text collisions, animation-related console errors, or build failures.
