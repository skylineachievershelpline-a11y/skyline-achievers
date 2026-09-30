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
- Appearance: light/dark choice persists through semantic theme tokens; member, Beginners, and Executive controls live in Settings, while admin and application controls may remain in their headers. Why: dashboard headers and landing branding stay uncluttered.
- Biometric login uses discoverable WebAuthn passkeys with server-verified challenges; only public keys are stored and successful assertions exchange for the existing account session. Why: biometric material stays on-device while accounts remain tied to current dashboards.
- Resolve `tslib` to its ESM build in Vite config. Why: Vite 8/Rolldown otherwise breaks the WebAuthn server dependency graph with undefined TypeScript helpers.
- Skyline Growth Executive uses one effective-dated settings source and server-owned verification ledger; enrollment money is per 10-lead batch and 2CC money per PKT cycle. Why: reported outcomes cannot directly create payable money.
- Growth Executive commissions become payable only after the owning FBO funds an office-approved settlement linked to those ledger rows. Why: commissions and Skyline fees must reconcile without cross-FBO leakage.
- Member and Beginners primary navigation uses the original slide-out sidebar; do not add bottom navigation. Why: the bottom bar was rejected after testing.
