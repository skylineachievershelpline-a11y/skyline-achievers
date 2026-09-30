# Premium App Install Window in Landing and Settings

## Build
- Refine the existing landing install window to match the reference: centered dark glass card, large Skyline logo, title/subtitle, close control, inset installation area, and blue/cyan Install App button.
- Keep the existing browser-native PWA installation prompt and automatic installed-state detection; show browser-menu instructions when direct installation is unavailable.
- Reuse the same install window from Settings on Member/FBO, Beginners Training, and Growth Executive dashboards.
- Keep Appearance and Log out in each Settings area.
- For Beginners Training, show only its own account information, app install, appearance, and log out; remove Add account and Switch account.

## Keep unchanged
- Existing logo, colors, typography, dashboards, navigation, authentication, and service-worker configuration.
- No fake download, fake percentage, duplicate service worker, or duplicate install logic.

## Verification
- Check the install window on mobile and desktop.
- Check landing and all dashboard Settings entry points.
- Confirm direct-install, installed, preview, and manual-instruction states render correctly.
- Confirm the app builds without errors.
