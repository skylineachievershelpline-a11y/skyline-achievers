# Skyline Achievers Landing Page Redesign

## Goal
Turn only the public home page into a premium, mobile-first learning platform that immediately explains: a phone, internet, and the right skills can create realistic work-from-home possibilities. Preserve the current logo, member login, session-code access, WhatsApp flow, authentication, admin panel, member routes, and all existing data.

## Public landing experience
- Replace the current architectural hero with a living, phone-centered digital scene using a purpose-made visual asset, restrained blue/cyan lighting, lightweight particles, and subtle motion.
- Use the core message “Your phone can be more than just a phone,” with realistic learning-focused copy and no income promises or restricted industry terminology.
- Keep the official logo circular everywhere and preserve its hidden admin gesture.
- Add a compact navigation with Home, About, How It Works, Reviews, Login, and Start Learning.
- Route “Start Learning” to the existing member/session access area and “Watch Intro” to the intro video; do not create duplicate login or registration flows.
- Build clear sections for the intro video, concise About content, the phone-to-productivity transition, Learn/Build/Grow/Earn, approved reviews, an ambient quote moment, final CTA, and footer.
- Retain the current Beginners Training session-code form and WhatsApp access without changing their behavior.
- Remove landing-page references to internal training levels/ranks and all prohibited business terminology.

## Dynamic landing content
- Add admin-managed motivational quotes with create, edit, delete, active/inactive, and display-order controls.
- Add one admin-managed intro-video record with title, description, external/uploaded video source, thumbnail, aspect ratio, and active/inactive state.
- Show graceful designed empty states when no intro video, quotes, or approved reviews exist; do not invent testimonials or placeholder claims.
- Load public landing content through a public read-only server function with explicit safe fields.

## Reviews and moderation
- Add a concise public review form with required name and review text, plus optional designation and rating.
- New reviews always enter a pending, inactive state and never appear publicly until approved.
- Add review management to the landing-content admin area: view pending/all, edit, approve/reject, activate/deactivate, reorder, and delete.
- Public queries return only approved and active reviews.

## Admin integration
- Add a single “Landing” tab to the existing admin panel rather than creating a separate CMS or authentication system.
- Reuse existing admin session validation, buttons, forms, upload helpers, progress indicators, storage signing, and query refresh patterns.
- Keep all existing admin tabs and functionality unchanged.

## Data and security
- Add focused tables for landing quotes, intro content, and reviews, with explicit grants and row-level security.
- Allow anonymous users to read only active public content and submit only pending/inactive reviews through validated server logic.
- Keep all management operations behind the existing server-validated admin session; no client-side admin checks.
- Add storage support only where needed for the intro video/thumbnail, following the project’s existing signed-upload flow.

## Visual system and motion
- Extend the existing semantic navy/black/royal-blue/cyan/silver tokens; no yellow, orange, green, red, or random multicolor gradients in landing presentation.
- Use a distinctive editorial-tech layout with strong typography, restrained glass surfaces, layered full-width sections, and no nested card clutter.
- Add lightweight CSS-based quote drift, reveal, ambient lighting, and hover motion, all disabled by reduced-motion preferences.
- Keep large media lazy-loaded below the first viewport and avoid new heavy animation libraries.

## Verification
- Verify desktop (1280px), tablet, and mobile (411px) layouts, including no horizontal overflow, readable typography, circular logo treatment, and visible next-section cues.
- Test navigation anchors, member login validation, session-code behavior, WhatsApp dialog, intro video states, quote rendering, review submission, and admin moderation.
- Confirm existing authentication and routes still work, then check runtime logs, type safety, and the final build.

## Technical details
- Main presentation: `src/routes/index.tsx` plus small landing-specific components under `src/components/landing/` and semantic additions in `src/styles.css`.
- Public reads/submission: client-safe `createServerFn` modules with server-only helpers kept behind dynamic imports.
- Admin management: one new landing tab/component wired into `src/routes/admin.index.tsx` and the existing admin function layer.
- Database changes will be additive migrations only; no existing table, route, or user data will be renamed or removed.
