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
- Job Assistant system: job_assistants table is service-role only (no RLS policies); all access via src/lib/assistants.functions.ts with FBO (rank_order>=2) or admin checks. Commission tiers live in platform_settings key job_assistant_settings. Why: strict FBO isolation.
