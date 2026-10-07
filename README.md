# Skyline Achievers 

SKYLINE ACHIEVERS — PRIVATE TRAINING & MENTORSHIP PLATFORM



You are an expert full-stack product development team consisting of a Senior Full-Stack Developer, UI/UX Designer, Software Architect, Database Architect, Security Engineer, QA Engineer, and Product Designer.



Build a real, production-ready web application called Skyline Achievers.



This is NOT a simple landing page or basic video website.



It is a private training, mentorship, and educational content platform for the Skyline Achievers team.



The platform should feel like a premium combination of a modern streaming platform and a high-end iOS-inspired application.



The primary goal is to give Skyline Achievers members one centralized place where they can access their authorized training videos, lectures, PDFs, audio, presentations, books, and important links without needing to search YouTube, Instagram, WhatsApp, or other platforms.



---



1. CORE PRODUCT CONCEPT



Skyline Achievers is a private learning platform with rank-based access control.



The platform has six main training levels:



1. Beginners Training

2. Personal Mentorship

3. Assistant Supervisor

4. Supervisor

5. Assistant Manager

6. Manager



Each level is a separate section.



Inside each level there can be multiple training series.



Example:



Assistant Supervisor



- Prospecting Mastery

- Objection Handling

- Follow-Up Mastery

- Closing Mastery

- Communication Skills

- Leadership Basics



Each series contains multiple lectures.



Example:



Objection Handling



- Lecture 01

- Lecture 02

- Lecture 03

- Lecture 04



Lectures may be long-form videos, including videos of 1–2 hours or longer.



The system must support long-form video content.



---



2. VERY IMPORTANT — ACCESS CONTROL



The platform must have proper role/rank-based authorization.



Members must NOT automatically see all content.



Each member has an assigned level/rank.



The administrator controls the member's level.



When a member's level changes, their available training content should update according to the access rules.



Design the authorization system so that access is controlled by the backend/database, NOT only by hiding frontend UI elements.



Never rely on frontend-only permissions.



Unauthorized members must not be able to access protected content by manually changing URLs.



---



3. MEMBER ACCOUNT SYSTEM



Members must NOT log in using email or username.



Members will log in using:



- Member ID

- Password



The system automatically generates a unique Member ID when the administrator creates a member.



Example:



SKA-10482



The Member ID must be unique.



Passwords must be securely generated and securely stored.



Never store plaintext passwords in the database.



Use proper authentication/security practices.



---



4. ADMIN MEMBER CREATION



Only administrators can create member accounts.



Create an admin interface:



Admin Dashboard → Members → Add New Member



Member creation form:



- Full Name

- Age

- CNIC

- Email

- Phone Number

- Assigned Level/Rank

- Account Status



Available account statuses:



- Active

- Temporarily Blocked

- Permanently Removed



When the administrator creates the account:



1. Generate a unique Member ID automatically.

2. Generate a secure temporary password automatically.

3. Create the member account.

4. Assign the selected level.

5. Apply the correct content permissions.

6. Generate a professional English welcome/credentials message.

7. Show a prominent "Copy Message" button.



The administrator should be able to copy the complete message with one click and send it to the member through WhatsApp or another communication channel.



---



5. MEMBER CREDENTIAL MESSAGE



The generated message must be professional English.



Do NOT use emojis.



Example structure:



Subject: Welcome to Skyline Achievers — Your Training Account



Dear [Member Name],



Congratulations on successfully joining Skyline Achievers.



Your official training account has been created. Please use the credentials below to access the Skyline Achievers Training Platform.



Member ID: [MEMBER_ID]



Password: [PASSWORD]



Assigned Level: [LEVEL]



Please keep your login credentials confidential and do not share them with unauthorized individuals.



You can now log in to access the training resources available for your assigned level.



Regards,



Skyline Achievers

Training & Development Team



The administrator must be able to copy this entire message with one button.



---



6. MEMBER MANAGEMENT



Admin must be able to:



- View all members

- Search members

- Filter members

- Add members

- Edit member details

- Change member level

- Block members temporarily

- Unblock members

- Permanently remove members

- View member profile

- View account status

- Reset password

- Generate new credentials when required



Member information:



- Full Name

- Age

- CNIC

- Email

- Phone Number

- Member ID

- Assigned Level

- Account Status

- Account Creation Date

- Last Login



Protect sensitive information such as CNIC with proper authorization.



Only authorized administrators should be able to access sensitive member information.



---



7. MAIN MEMBER DASHBOARD



The member dashboard should be inspired by the provided Netflix-style dashboard reference.



Do NOT copy Netflix branding.



Create an original Skyline Achievers design.



The dashboard should feel like a premium private streaming/learning platform.



Dashboard sections can include:



- Welcome section

- Featured Training

- Continue Watching

- Your Training

- Personal Mentorship

- Latest Lectures

- Recently Added

- Recommended Training

- Training Resources



The dashboard should dynamically show content available to the logged-in member.



---



8. CONTINUE WATCHING



Include a "Continue Watching" feature.



This is NOT a progress-tracking system.



Do not show percentage-based course completion.



Instead, simply remember the last playback position of a video so the member can continue watching from where they stopped.



Example:



Objection Handling Mastery

Continue from 43:18



Store playback position securely in the database.



---



9. NO COURSE PROGRESS TRACKING



Do NOT create:



- Course completion percentages

- Progress bars

- "70% completed"

- Achievement progress systems



The user specifically does not want progress tracking.



Only implement video resume/continue-watching functionality.



---



10. TRAINING LEVEL STRUCTURE



Create a scalable hierarchy:



LEVEL

↓

SERIES

↓

LECTURES

↓

RESOURCES



Example:



Assistant Supervisor

→ Objection Handling

→ Lecture 01

→ Lecture 02

→ Lecture 03



Each level should have a visually premium card on the dashboard.



The system must allow administrators to create additional series and lectures without changing the code.



---



11. TRAINING CONTENT TYPES



The platform must support:



- Video lectures

- PDFs

- Audio

- Presentations

- Books

- Important links

- Notes/supporting materials



A lecture or series may have multiple resources attached to it.



Example:



Lecture 01



Video

PDF Notes

Presentation

Audio Version

Important Links



---



12. VIDEO SYSTEM



Long-form videos are extremely important.



The platform must support video lectures of approximately 1–2 hours or longer.



Do not design the system around short videos only.



Use a scalable/private video delivery architecture.



Do NOT expose permanent public video URLs where possible.



Do NOT expose secret storage keys in frontend code.



Implement proper authorization before allowing video playback.



The video system should support:



- Play

- Pause

- Seek

- Volume

- Fullscreen

- Playback position saving

- Resume watching



Avoid providing an obvious download button.



Implement appropriate protection against unauthorized direct access.



Understand that no web platform can completely prevent screen recording, but make unauthorized downloading and direct sharing as difficult as reasonably possible.



---



13. LECTURE PAGE



Create a premium lecture detail page.



Structure:



Large video player



Lecture title



Series name



Level name



Description



Resources section



Available resources may include:



- PDF

- Audio

- Presentation

- Book

- Important Links

- Notes



The page should be clean, minimal, and distraction-free.



---



14. SEARCH SYSTEM



Create a global search feature.



Members should be able to search:



- Levels

- Series

- Lectures

- Videos

- PDFs

- Audio

- Presentations

- Books

- Important Links



Example:



Search:

"Objection Handling"



Results should show relevant content grouped logically.



Search should be fast and mobile-friendly.



---



15. NOTIFICATION SYSTEM



Notifications are mandatory.



Members should receive in-platform notifications for things such as:



- New training uploaded

- New lecture added

- New series added

- Important announcement

- Admin message



Create:



Notification icon



Unread notification indicator



Notification panel/page



Mark as read functionality



Admin should be able to create announcements.



---



16. ADMIN PANEL



Create a separate secure Admin Panel.



Admin navigation should include:



Dashboard

Members

Training Levels

Series

Lectures

Videos

Resources

Notifications

Announcements

Settings



The admin dashboard should show useful statistics such as:



Total Members

Active Members

Blocked Members

Total Training Levels

Total Series

Total Lectures

Total Resources



Use clean cards and charts only where they provide actual value.



---



17. ADMIN TRAINING MANAGEMENT



Admin must be able to manage the complete training library without developer assistance.



Admin should be able to:



Create Level

Edit Level

Delete/Archive Level



Create Series

Edit Series

Delete/Archive Series



Create Lecture

Edit Lecture

Delete/Archive Lecture



Upload/Add Video

Attach Resources

Reorder Content

Publish/Unpublish Content



Each content item should have appropriate metadata.



Example:



Title

Description

Thumbnail

Level

Series

Video

Resources

Status

Created Date



---



18. CONTENT VISIBILITY



Admin should be able to control which rank/level can access each piece of content.



Do not assume every piece of content automatically belongs to only one rank.



Design the database so that content access can be extended in the future.



For example, a training resource may be available to:



- Assistant Supervisor

- Supervisor

- Assistant Manager

- Manager



without requiring duplicate copies of the resource.



---



19. MOBILE-FIRST EXPERIENCE



This is extremely important.



The majority of members may use mobile devices.



The website must feel like a premium mobile application.



Support:



- Mobile

- Tablet

- Laptop

- Desktop

- Large screens



On mobile, use a premium floating bottom navigation inspired by the provided Pinterest/iOS-style reference.



Possible navigation:



Home

Training

Search

Notifications

Profile



Use rounded floating glass navigation.



Active navigation item should have a clear visual state.



Do not make the mobile UI feel like a compressed desktop website.



Design mobile first.



---



20. DESKTOP EXPERIENCE



On desktop, use a premium glass-style sidebar/navigation system.



The desktop dashboard should provide more horizontal space for:



- Hero sections

- Training cards

- Series

- Continue Watching

- Resource sections



Maintain consistent visual language between mobile and desktop.



---



21. UI / UX DESIGN SYSTEM



The design must be:



Premium

Modern

Minimal

Elegant

Professional

High-end

Responsive



Primary inspiration:



- Premium iOS interfaces

- Modern SaaS products

- Streaming platforms

- Glassmorphism

- Modern educational platforms



Do NOT make the interface look like a generic template.



---



22. GLASSMORPHISM



Use refined glassmorphism.



Important:



Do NOT overuse transparency.



Use:



- Backdrop blur

- Semi-transparent surfaces

- Subtle borders

- Soft shadows

- Layered surfaces

- Gentle gradients

- Soft highlights



The interface should feel similar to premium Apple/iOS design language without copying Apple's proprietary interface.



---



23. ROUNDED DESIGN



Use rounded UI throughout the platform.



Rounded:



- Cards

- Buttons

- Inputs

- Search bars

- Video containers

- Navigation

- Modals

- Profile elements

- Resource cards



Use different radius levels according to component size.



Avoid excessive sharp corners.



---



24. COLORS



Do NOT finalize the brand color palette yet.



The Skyline Achievers logo and final brand colors will be provided later.



Create a centralized design-token system so colors can easily be changed later.



Use neutral glass surfaces and a configurable primary brand accent.



When the logo and colors are provided, update the entire design system consistently.



Do NOT hard-code colors across individual components.



---



25. TYPOGRAPHY



Use a modern professional sans-serif typography system.



Prefer:



Poppins

or

Inter



Use clear hierarchy for:



- Headings

- Subheadings

- Body

- Metadata

- Buttons

- Labels



Typography must remain highly readable on mobile.



---



26. MICRO-INTERACTIONS



Use subtle premium animations.



Examples:



- Card hover

- Button hover

- Navigation transitions

- Page transitions

- Modal animations

- Notification animations

- Loading states



Animations should be smooth and subtle.



Do not over-animate the platform.



---



27. RESPONSIVE DESIGN



Test every major component at:



- Small mobile

- Large mobile

- Tablet

- Laptop

- Desktop

- Large desktop



Pay particular attention to:



- Bottom navigation

- Sidebar

- Video player

- Search

- Training cards

- Horizontal carousels

- Tables

- Admin dashboard

- Forms

- Modals



---



28. SECURITY



Security is mandatory.



Implement:



- Secure authentication

- Role-based authorization

- Backend access control

- Protected admin routes

- Protected member routes

- Input validation

- Secure password hashing

- Rate limiting where appropriate

- Secure API routes

- Environment variables

- Database security policies

- Protection against unauthorized content access

- Protection against injection attacks

- XSS protection

- Proper file upload validation



Never expose:



- API keys

- Database credentials

- Service-role keys

- Private storage credentials



in client-side code.



---



29. DATABASE



Use a relational database such as PostgreSQL.



Prefer Supabase if appropriate because it provides:



- PostgreSQL

- Authentication

- Storage

- Row Level Security

- Backend functionality



Design a scalable relational structure.



Potential entities:



users

member_profiles

levels

series

lectures

videos

resources

resource_types

member_access

notifications

announcements

watch_history

admin_users



Use proper:



- Primary keys

- Foreign keys

- Indexes

- Constraints

- Relationships

- Timestamps



Avoid unnecessary duplication.



---



30. ACCESS CONTROL DATABASE LOGIC



The system should support:



Member → Assigned Level



Level → Series



Series → Lectures



Lecture → Resources



Member → Authorized Content



Use backend authorization policies to ensure a member can only access content they are authorized to view.



If a member changes rank, access should update without manually duplicating content.



---



31. ADMIN AUTHENTICATION



Admin authentication must be completely separate from normal member authentication/authorization.



Create protected admin routes.



Normal members must never be able to access admin functionality.



Never rely only on frontend route hiding.



Verify admin permissions on the backend.



---



32. ACCOUNT STATES



Member accounts must support:



Active



Temporarily Blocked



Permanently Removed



Blocked members must not be able to access protected content.



For permanent removal, handle related data safely according to the database design.



Do not accidentally destroy important training content when deleting a member.



---



33. SETTINGS



Create an admin settings area for future configuration.



Include architecture for:



- Platform settings

- Branding

- Notifications

- Security

- Content settings

- Admin management



Keep it extensible.



---



34. ERROR STATES



Every important action must have proper:



Loading state

Success state

Error state

Empty state



Examples:



No training available

No search results

Video failed to load

Network error

Unauthorized access

Invalid credentials

Account blocked

Resource unavailable



Never leave the user staring at a blank screen.



---



35. UX COPY



Use professional English throughout the application interface unless content is entered by the administrator.



Examples:



Welcome back

Continue Watching

Featured Training

Your Training

Recently Added

Search Training

Notifications

Profile

Resources

Access Restricted

Invalid Credentials

Your account has been temporarily blocked



Keep wording concise and professional.



---



36. SEO



The public-facing portions of the platform should have:



- Proper metadata

- Semantic HTML

- SEO-friendly structure

- Open Graph metadata where relevant



Private member content does not need to be publicly indexed.



Do not expose private training content to search engines.



---



37. PERFORMANCE



Optimize for:



- Fast initial loading

- Lazy loading

- Optimized images

- Efficient database queries

- Pagination where required

- Caching where appropriate

- Efficient video loading

- Minimal unnecessary API calls

- Mobile performance



Do not load the entire training library unnecessarily.



---



38. FILE / PROJECT ARCHITECTURE



Use a maintainable architecture.



Prefer a structure similar to:



src/

components/

pages/

layouts/

features/

hooks/

lib/

services/

types/

utils/



database/

migrations/



public/

assets/



Adapt the structure to the chosen framework.



Use reusable components.



Do not duplicate UI unnecessarily.



---



39. TECH STACK



Prefer the following stack unless there is a strong technical reason to use an alternative:



Frontend:

React

TypeScript

Tailwind CSS



Backend:

Supabase / secure server-side functions



Database:

PostgreSQL



Authentication:

Secure authentication system with separate member/admin authorization



Storage:

Private object storage / secure video storage appropriate for long-form videos



Deployment:

Use a production-ready deployment platform compatible with the chosen stack.



Do not select technologies merely because they are popular.



---



40. IMPORTANT: DO NOT BUILD A FAKE DEMO



This must be a real application architecture.



Do not create fake login logic.



Do not create fake database records as if they were real.



Do not create fake video upload functionality.



Do not create fake authentication.



Do not claim that a feature works if it has not been implemented.



If a service requires configuration, create the correct integration structure and clearly identify the required environment variables/configuration.



---



41. LOGO



The Skyline Achievers logo will be provided separately.



For now:



Create a clean logo placeholder component.



Do NOT invent a final logo.



The logo must be replaceable from one centralized location without modifying every page.



---



42. ORIGINAL DESIGN



Use the attached UI references only as design inspiration.



The first reference represents a Netflix-style content dashboard.



The second reference represents a modern floating navigation / app-style design.



The third reference represents a premium glass folder/icon aesthetic.



Do NOT copy any company's branding, logos, copyrighted assets, or exact layouts.



Create an original Skyline Achievers interface inspired by the design principles:



Premium

Glass

Rounded

Minimal

Modern

Elegant

Streaming-style

iOS-inspired



---



43. INITIAL PAGES



Create at minimum:



PUBLIC / AUTH



1. Login Page



MEMBER



2. Member Dashboard

3. Training Levels

4. Level Detail

5. Series Detail

6. Lecture Detail

7. Search

8. Notifications

9. Profile

10. Resources



ADMIN



11. Admin Login

12. Admin Dashboard

13. Members Management

14. Add/Edit Member

15. Training Levels Management

16. Series Management

17. Lectures Management

18. Video Management

19. Resources Management

20. Notifications/Announcements

21. Admin Settings



---



44. MEMBER LOGIN UX



Login page should be extremely simple.



Fields:



Member ID

Password



Button:



Login



Include:



Forgot Password / Contact Administrator



Do not provide normal public registration.



Only administrators can create accounts.



---



45. MEMBER DASHBOARD PERSONALIZATION



After login:



Display:

Welcome back, [Name]



Show:



Current Level: [Rank]



Then dynamically show authorized training.



The member should never see locked content that they are not authorized to access unless we intentionally decide to show a locked preview.



If locked previews are shown, they must not reveal protected content or allow unauthorized access.



46. ADMIN MEMBER CREATION UX



Make the member creation flow extremely easy.



Admin fills:



Name

Age

CNIC

Email

Phone

Level



Then clicks:



Create Member



System generates:



Member ID

Password



Then show a professional credential card with:



Member Name

Member ID

Password

Assigned Level



And:



Copy Message



button.



Also provide:



Copy Member ID

Copy Password



if useful.



47. FUTURE SCALABILITY



Build the architecture so the platform can later support:



Certificates



Quizzes



Assignments



Live sessions



Events



Team announcements



AI training assistant



Leaderboards



Advanced analytics



Mobile app



Subscription/access plans



Do not build these features now unless required.



Only make the architecture extensible for them.



48. FINAL QUALITY STANDARD



Before considering the application complete, verify:



Functional:

Does authentication work?

Does member creation work?

Does rank-based access work?

Does video access work?

Does resource access work?

Does search work?

Do notifications work?

Does continue watching work?

Does admin management work?



Security:

Can unauthorized members access protected content?

Can members access admin routes?

Are passwords secure?

Are private storage resources protected?

Are sensitive member details protected?



UI:

Does it look premium?

Does the glass effect look polished?

Are all cards properly rounded?

Does mobile look like an app?

Does desktop look professional?



Responsive:

Test mobile, tablet, laptop and desktop layouts.



Error handling:

Test invalid login, blocked account, missing content, video failure, network failure and unauthorized access.



Performance:

Avoid unnecessary requests and loading of unused content.



49. DEVELOPMENT APPROACH



Do NOT try to create everything as one huge fragile implementation.



Build in logical phases.



Phase 1:

Project foundation

Design system

Authentication

Database

Admin authentication



Phase 2:

Member management

Member ID generation

Password generation

Rank management

Access control



Phase 3:

Training levels

Series

Lectures

Resources



Phase 4:

Video system

Private video access

Continue Watching



Phase 5:

Member dashboard

Netflix-inspired content browsing

Search

Notifications

Profile



Phase 6:

Admin training management

Content management

Announcements

Settings



Phase 7:

Security hardening

Responsive optimization

Performance optimization

Error handling

Testing



50. MOST IMPORTANT PRODUCT RULE



Do not blindly follow an implementation if there is a better technical solution.



If any requested feature creates:



Security problems



Poor UX



Scalability problems



Excessive cost



Performance problems



tell me clearly and propose a better solution.



The objective is to build a real professional platform, not merely to satisfy a checklist.



FINAL INSTRUCTION



Start by creating the complete application foundation and design system according to this specification.



Use the Skyline Achievers name throughout the application.



Create a premium, original, glassmorphism-based, iOS-inspired interface with rounded components and a Netflix-inspired content browsing experience.



Do not invent the final logo or final brand colors yet.



Keep the branding system centralized so the logo and colors can be replaced later.



Prioritize mobile-first design.



Prioritize security.



Prioritize real backend functionality.



Prioritize scalable architecture.



Do not create fake/demo functionality where production functionality is required.



Build the platform as if it will be used by a real growing organization with hundreds or thousands of members.

Or bro website ko proper database ho or supabase sy connected ho sab live work kar raha ho Baki logo ya ho same theme ho color etc or bro ak imp cheez admin panel ko login karny KY lia koi account login karny ki need ni waha bas ak kam ho Yar hidden ho ya bas Jo koi logo py 5 bar click kry foran admin panel open ho jay aisy ho

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://skyline-achievers.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/cbea53df-1b5b-4eb0-adae-f502963be09a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
