# Clean, faster Skyline interface

## Goal
Remove the visible grid/box-heavy treatment and shift the existing Skyline interface toward a calm, polished iPhone-like finish without changing the logo, brand colors, content, or functionality.

## Visual cleanup
- Remove the square grid texture from public, member, and admin backgrounds.
- Replace heavy 3D extrusion, stacked borders, strong glass blur, and excessive card framing with flatter dark surfaces, fine separators, soft shadows, and selective rounded groups.
- Keep information grouped where needed, but avoid making every item look like a separate box.
- Preserve the existing midnight navy, blue, cyan, white, and silver identity and keep the logo unchanged.

## Speed improvements
- Remove expensive blur/filter animation effects and reduce backdrop blur across shared surfaces.
- Load landing-page introduction and testimonials only as their sections approach the viewport, so the opening screen becomes interactive sooner.
- Replace the current landing background with an optimized modern image variant and preload only that main visual.
- Keep videos from loading external players until the visitor chooses to play them where practical.
- Review the app-shell notification request so it does not compete with the first screen.

## Validation
- Check the landing page and representative member screens at phone and desktop sizes.
- Confirm no horizontal overflow, blank states, broken dialogs, or lost actions.
- Confirm the app builds cleanly and compare the main page’s initial requests and image transfer size.
