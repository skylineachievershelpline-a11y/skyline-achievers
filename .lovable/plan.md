# Secure Login, Profile Settings, Reel Upload, and Header Theme Switch

## What will be built

### 1. Fingerprint and Face ID login
- Add **Fingerprint** and **Face ID / Device Unlock** actions to the member login card.
- Use the phone/browser’s secure biometric prompt through WebAuthn/passkeys; no fingerprint image, face scan, or biometric data will be stored by Skyline Achievers.
- Allow each member or Beginners Training account to register up to **3 device credentials**.
- After successful biometric verification, open the correct Member or Beginners dashboard directly.
- Show clear unsupported/cancelled/not-registered messages when a browser or phone cannot use biometrics.

### 2. Biometric management in profile settings
- Add a **Security & Device Login** section to member profile settings and Beginners Training profile settings.
- Show enrolled devices with a user-defined device name, added date, and last-used date.
- Allow adding a new fingerprint/Face ID device and removing an old one; enforce the 3-device limit on the server.
- Require the account to already be signed in before registering or removing a device.

### 3. Beginners Training profile settings
- Add a proper Profile Settings screen inside the Beginners dashboard.
- Include profile-picture upload, password change, and biometric-device management together.
- Keep the trainee’s name read-only as requested.
- Retain account switching and logout in the existing settings area.

### 4. Reference-style FBO reel upload
- Add an **Upload Reel** action from the FBO dashboard/reels area, available only to Assistant Supervisor rank and above.
- Replace the plain picker experience with a clean reference-style upload sheet: large video drop/pick area, selected-file row, cancel control, progress bar, and Upload button.
- Keep existing moderation: member reels remain pending until admin approval.
- Preserve title, caption, automatic cover generation, upload progress, and failure recovery.

### 5. Horizontal header theme switch
- Replace the floating vertical ON/OFF control with a compact **horizontal switch** inside each top header.
- Place it between the member name/title area and notification bell, matching the supplied header reference.
- Put the same horizontal switch in the landing-page top bar beside Login.
- Keep the existing dark/light palettes, saved preference, animation, vibration, and reference-video ON/OFF voice.
- Ensure it does not cover Login, names, or header actions on small phones.

## Technical details
- Store only WebAuthn public credentials and metadata in a protected user-owned credentials table; biometric material remains inside the phone.
- Use server-generated, short-lived registration/login challenges and verify signed assertions server-side.
- Scope every credential to one existing Skyline account; prevent duplicate credential IDs and enforce the three-credential limit transactionally.
- Keep FBO reel permission enforced by the existing server-side rank check, not only by hiding the button.
- Reuse one shared theme switch and one shared biometric settings panel across member and trainee screens.

## Verification
- Test fingerprint/Face ID registration, login, removal, fourth-device rejection, cancellation, and unsupported-device states.
- Test both member and Beginners accounts reach the correct dashboard.
- Test FBO reel upload from file selection through pending-admin state; confirm lower ranks cannot upload.
- Check landing, member, Beginners, assistant, and admin headers in light/dark modes on phone and desktop.
- Confirm build/runtime logs remain clean.
