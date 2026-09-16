# Landing Introduction & Testimonials

## Goal
Replace the public Skyline Path block with a clear Skyline Achievers introduction video and a polished testimonials section, both controlled from the admin panel.

## What will change
- Remove the five-level “Skyline Path” section shown in the attached screenshot.
- Add an introduction section directly after the opening/login area, explaining Skyline Achievers and how a new person can start.
- Show one admin-selected introduction video with its title and description.
- Add admin controls to upload the video or paste a YouTube, Vimeo, Google Drive, Facebook, or direct video link; edit, publish/hide, and replace it later.
- Use the existing testimonials area for admin-created testimonials, with name, role/city, review, rating, visibility, order, edit, and delete controls.
- Display only published testimonials on the public landing page while keeping visitor review approval working.

## Technical details
- Reuse the existing landing introduction and reviews data already present in Lovable Cloud.
- Store uploaded introduction media in the existing private training video storage and serve it through short-lived secure links.
- Reuse the existing video player so uploaded and supported linked videos open correctly at the selected ratio.
- Keep login, authentication, WhatsApp, and all member/admin workflows unchanged.
- Verify mobile and desktop layouts, video playback, admin controls, and the final build.