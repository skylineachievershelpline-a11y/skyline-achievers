<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Skyline Growth Executive records are service-role only; authenticated FBO and Executive server functions scope every read/write by immutable FBO and Executive ownership. Why: strict cross-FBO and financial isolation.
- Job leads: job_leads table service-role only, unique (fbo_id, phone_tail = last 10 digits); Excel/CSV parsed in browser with xlsx, sent as rows to src/lib/leads.functions.ts. Why: FBO isolation + dedupe.
- Growth Executives use separate 12-digit `22` accounts linked by `job_assistants.auth_user_id`; legacy `/work/$token` links are retired. Why: secure pauseable accounts and an independent mobile dashboard.
- Appearance and the shared native PWA installer live in Member, Beginners, and Executive Settings; admin/application controls may stay in headers. Why: consistent controls without duplicate workers.
- Biometric login uses discoverable WebAuthn passkeys with server-verified challenges; only public keys are stored and successful assertions exchange for the existing account session. Why: biometric material stays on-device while accounts remain tied to current dashboards.
- Resolve `tslib` to its ESM build in Vite config. Why: Vite 8/Rolldown otherwise breaks the WebAuthn server dependency graph with undefined TypeScript helpers.
- Skyline Growth Executive uses one effective-dated settings source and server-owned verification ledger; enrollment money is per 10-lead batch and 2CC money per PKT cycle. Why: reported outcomes cannot directly create payable money.
- Growth Executive commissions become payable only after the owning FBO funds an office-approved settlement linked to those ledger rows. Why: commissions and Skyline fees must reconcile without cross-FBO leakage.
- Member and Beginners primary navigation uses the original slide-out sidebar; do not add bottom navigation. Why: the bottom bar was rejected after testing.
- Website Guide steps live in src/lib/ai-guide.ts and target real elements via data-ai-guide markers; voice, highlight and click helpers live in src/lib/guide/, and teaching turns go through guideTeach in ai-guide.functions.ts; progress is per-account in browser storage. Why: stable highlighting and swappable voice providers without rebuilding the tour.
- Skyline AI Live Call runs on GPT Live through the persistent `/api/live` relay (src/lib/live-relay.server.ts, dispatched in src/server.ts, dev via live-vite-plugin.ts); the relay verifies the account token, and screen state/annotations flow as `app.*` events with vision handled by the delegated backend model. Why: audio stays WebRTC while facts, screen reading and pointers stay server-owned and knowledge-grounded.
- The call UI is one root-mounted owner (src/components/call/LiveCallOverlay.tsx) so calls survive navigation; annotations are a pointer-events-none overlay targeting temporary `data-live-id` markers. Why: users move around the site while the AI keeps pointing at real elements.
- Mandatory FBO training: curriculum in src/lib/training/curriculum.ts, progress in service-role tables fbo_training/fbo_training_attempts via src/lib/training.server.ts; tests are scored server-side from AI per-question judgements; training no longer locks the dashboard and the teacher runs no tests (user request); the live relay runs training mode with save_progress/submit_test/draw_whiteboard/offer_page tools. Why: AI teaches naturally but pass/fail and unlocks stay server-owned.
- Training calls are voice-only and the AI Teacher "shares its own screen": a same-origin, signed-in iframe it drives via the `show_page` relay tool (allowlisted routes); screen reading and annotations target that frame, and MemberShell skips the training lock inside it. Why: learners watch the AI open every page (landing included) without sharing their own screen.
- Daily performance graph and Daily Report PDF both use analyzePerformance in src/lib/performance-trend.ts over the server report calendar (366 days). Why: dashboard and PDF must show identical numbers and wording.
- Required YouTube videos play through src/components/media/SecureYouTubePlayer.tsx (custom controls, click shield, max-watched seek cap stored per video in browser storage). Why: learners stay on Skyline and cannot skip unseen content.
- Beginner session schedule pulls forward in rollMissedSessions: once all earlier sessions are approved, the next unreviewed sessions shift back by whole days to the earliest upcoming slot at their own clock time. Why: no waiting for calendar dates while keeping configured times.
