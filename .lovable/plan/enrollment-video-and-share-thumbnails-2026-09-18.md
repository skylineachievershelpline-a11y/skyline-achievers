# Enrollment Video and Share Thumbnails

## What will change
- Add an **Enrollment Video** card at the top of the existing **Beginners Sessions** dashboard page.
- Give that card Copy, Share, and Open actions, using the same landing-page Working Overview video and thumbnail managed by the admin.
- Add a dedicated public Enrollment Video page so recipients open the video directly without logging in.
- Update each public Beginners Session page so WhatsApp and other sharing apps receive that session’s own title, description, and thumbnail instead of the general website preview.
- Give the Enrollment Video page the same video-specific sharing preview.

## Technical details
- Load lightweight public video metadata before each share page renders, allowing Open Graph and Twitter tags to contain the signed, absolute thumbnail URL.
- Keep existing access rules, session codes, video playback, dashboard styling, and admin controls unchanged.
- Verify the new links, metadata output, phone layout, and current build health.
