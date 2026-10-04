# Rebuild Founder Training with the real dashboards

## Result
- Remove the extra A.Q Malik Founder card from Home, leaving the original single profile exactly where it was.
- Keep Founder Training and Admin Panel only in A.Q Malik's sidebar.
- Replace the current compact simulator page with the same full-screen layouts, navigation, cards, and flows used by the real FBO, Beginners Training, and Personal Mentorship dashboards.

## Journey
1. Founder Training opens A.Q Malik's normal FBO dashboard with the normal member sidebar.
2. Seat Reservation uses the real Seat Reservation screen, prefilled only with the Skyline Achievers training person (age 18 and the safe demo number). It creates the normal welcome card/poster without creating a real member.
3. After reservation, Beginners Training appears in the Founder training menu and opens a full Beginners dashboard with its own real-style sidebar, profile, session journey, timing controls, reviews, report, and interview stages.
4. After the interview passes, Personal Mentorship appears and opens the normal mentorship-style dashboard and payment cards.
5. Back/forward and Reset remain available as small training controls without replacing the real dashboard design.

## Safety
- Training actions stay isolated from real members, payments, reports, and notifications.
- A.Q Malik remains the only member allowed to access Founder Training.
- Existing real member, Beginners, and Personal Mentorship dashboards remain unchanged for everyone else.

## Technical details
- Use one Founder Training state shared across the real-looking routes instead of the old all-in-one tab simulator.
- Reuse existing MemberShell, Beginners navigation styling, WelcomeCard, mentorship cards, and journey visual patterns.
- Add route-specific metadata and verify the phone layout, sidebar flow, reset flow, and build health.
